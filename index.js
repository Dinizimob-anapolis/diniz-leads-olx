const express = require('express');
const fs = require('fs');
const { Readable } = require('stream');
const { Pool } = require('pg');
const { google } = require('googleapis');
const { DASHBOARD_HTML } = require('./dashboard-template');
const { CRM_HTML } = require('./crm-template');
const app = express();
app.use(express.json());

// ─── OAUTH DO GOOGLE DRIVE ────────────────────────────────────
const GOOGLE_OAUTH_REDIRECT_PATH = '/api/admin/drive-auth/callback';

function getOAuthClient() {
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) return null;
  const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : (process.env.APP_BASE_URL || '');
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${baseUrl}${GOOGLE_OAUTH_REDIRECT_PATH}`
  );
}

// ─── CONFIGURAÇÕES ───────────────────────────────────────────
const EVOLUTION_URL = 'https://evolution-api-production-5e4f.up.railway.app';
const EVOLUTION_INSTANCE = 'diniz-leads-olx';
const EVOLUTION_INSTANCE_TIKTOK = 'diniz-tiktok';
const EVOLUTION_TOKEN = 'A0929C1CF6C5-4E04-9FFB-3A4B073EE943';

const JULIANE_LL = '5562992166458';
const CYDA       = '5562993652226';

// ─── CORRETORES NO ROUND-ROBIN ───────────────────────────────
const CORRETORES = [
  { nome: 'Laís',   fone: '5562992754858' },
  { nome: 'Renata', fone: '5562992670935' },
  { nome: 'Junior', fone: '5562981625610' },
];

const CORRETORES_EXTRA_DASHBOARD = ['Amanda', 'Juliane', 'Bruno', 'Nalcio', 'Thayná'];

// ─── CRMs FIXOS PARA LAÍS ────────────────────────────────────
// Qualquer lead com CRM contendo "LAIS" ou com um desses códigos vai direto pra Laís,
// sem entrar no round-robin.
const CRMS_LAIS = [
  '1096','1095','1094','1093','1092','1091','1090',
  '1089','1088','1087','1086','1085','1083','1037',
  '1082','1081'
];

function definirCorretor(codigoImovel) {
  const codigo = String(codigoImovel || '').toUpperCase();
  if (codigo.includes('LAIS') || CRMS_LAIS.includes(String(codigoImovel))) {
    console.log(`CRM ${codigoImovel} → Laís (fixo)`);
    return { nome: 'Laís', fone: '5562992754858' };
  }
  const indexAtual = lerIndice();
  const corretor = CORRETORES[indexAtual];
  salvarIndice((indexAtual + 1) % CORRETORES.length);
  return corretor;
}

// ─── BANCO DE DADOS ──────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

const THROTTLE_AVISO_MS = 6 * 60 * 60 * 1000;

const CAMPOS_EDITAVEIS = ['nome', 'origem', 'corretor', 'interesse', 'status', 'aprovado', 'visita', 'proposta', 'venda', 'imovel_desc', 'sem_retorno', 'em_andamento', 'notas_sdr'];

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL não configurada — recursos de lead router desativados.');
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      whatsapp TEXT UNIQUE NOT NULL,
      nome TEXT,
      email TEXT,
      corretor TEXT,
      imovel_codigo TEXT,
      imovel_desc TEXT,
      distribuido_em TIMESTAMPTZ DEFAULT now(),
      contatou BOOLEAN DEFAULT false,
      primeiro_contato_em TIMESTAMPTZ,
      avisado_em TIMESTAMPTZ
    );
  `);

  await pool.query(`
    ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS origem TEXT,
      ADD COLUMN IF NOT EXISTS interesse TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Novo',
      ADD COLUMN IF NOT EXISTS ultimo_contato DATE,
      ADD COLUMN IF NOT EXISTS aprovado BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS visita BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS proposta BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS venda BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS numero_invalido BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS whatsapp_bruto TEXT,
      ADD COLUMN IF NOT EXISTS outros_corretores TEXT,
      ADD COLUMN IF NOT EXISTS sem_retorno BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS em_andamento BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS notas_sdr TEXT,
      ADD COLUMN IF NOT EXISTS reaquecido_em TIMESTAMPTZ;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS backups_leads (
      id SERIAL PRIMARY KEY,
      criado_em TIMESTAMPTZ DEFAULT now(),
      total_leads INTEGER,
      dados JSONB
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS config_sistema (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads_nao_identificados (
      id SERIAL PRIMARY KEY,
      whatsapp TEXT UNIQUE NOT NULL,
      mensagem TEXT,
      corretor TEXT,
      criado_em TIMESTAMPTZ DEFAULT now(),
      avisado_em TIMESTAMPTZ
    );
  `);
  await pool.query(`ALTER TABLE leads_nao_identificados ADD COLUMN IF NOT EXISTS corretor TEXT;`);
  console.log('✅ Tabelas do lead router prontas (leads, leads_nao_identificados)');

  try {
    const corrigidos = await pool.query(`
      UPDATE leads
      SET origem = 'Patrocinado'
      WHERE origem = 'OLX/Canal Pro'
        AND (imovel_codigo ~* '[A-Z]{2}[0-9]{2,}' OR imovel_desc ~* '[A-Z]{2}[0-9]{2,}')
        AND COALESCE(interesse, '') !~* 'CRM'
        AND COALESCE(imovel_codigo, '') !~* 'CRM'
        AND COALESCE(imovel_desc, '') !~* 'CRM'
      RETURNING id
    `);
    if (corrigidos.rowCount > 0) {
      console.log(`✅ Correção automática de origem: ${corrigidos.rowCount} lead(s) corrigidos para 'Patrocinado'.`);
    }
  } catch (err) {
    console.error('Erro na correção automática de origens antigas:', err);
  }

  try {
    const corrigidosCanal = await pool.query(`
      UPDATE leads
      SET origem = 'OLX/Canal Pro'
      WHERE origem IN ('Telefone', 'Chat OLX', 'Formulário', 'WhatsApp')
      RETURNING id
    `);
    if (corrigidosCanal.rowCount > 0) {
      console.log(`✅ Correção automática: ${corrigidosCanal.rowCount} lead(s) com canal interno da OLX corrigidos.`);
    }
  } catch (err) {
    console.error('Erro na correção de canais internos da OLX:', err);
  }

  try {
    const corrigidosNull = await pool.query(`UPDATE leads SET origem = NULL WHERE origem = 'null' RETURNING id`);
    if (corrigidosNull.rowCount > 0) {
      console.log(`✅ Correção automática: ${corrigidosNull.rowCount} lead(s) com origem literal "null" limpos.`);
    }
  } catch (err) {
    console.error('Erro na correção da origem literal "null":', err);
  }
}

function inferirOrigemDeTexto(texto, imovelCodigoJaExtraido) {
  if (!texto) return null;
  if (/\bCRM\b/i.test(texto)) return 'OLX/Canal Pro';
  if (imovelCodigoJaExtraido) return 'Patrocinado';
  if (/[A-Z]{2}\d{2,}/i.test(texto)) return 'Patrocinado';
  return null;
}

function normalizarTexto(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function canonicalizarWhatsapp(bruto) {
  let d = String(bruto || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2);
  if (d.length < 10) return null;
  return '55' + d;
}

let contadorSemNumero = 0;
function gerarPlaceholderSemNumero() {
  contadorSemNumero++;
  return `SEMNUM-${Date.now()}-${contadorSemNumero}-${Math.random().toString(36).slice(2, 7)}`;
}

function gerarChaveSemNumero(nome, email) {
  const base = normalizarTexto(`${nome || ''}|${email || ''}`);
  if (!base.replace(/\|/g, '')) return gerarPlaceholderSemNumero();
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return `SEMNUM-${hash.toString(36)}`;
}

function mapearColunas(headers) {
  const mapa = {
    nome: ['nome', 'cliente', 'nome do cliente'],
    whatsapp: ['whatsapp', 'telefone', 'fone', 'celular'],
    origem: ['origem', 'canal'],
    corretor: ['corretor'],
    imovelDesc: ['interesse', 'imovel', 'imóvel'],
    dataChegada: ['data', 'data do lead', 'data de criacao', 'data do ultimo lead gerado', 'data do ultimo lead'],
  };
  const idx = {};
  headers.forEach((h, i) => {
    const hn = normalizarTexto(h);
    for (const [campo, nomes] of Object.entries(mapa)) {
      if (nomes.includes(hn) && idx[campo] === undefined) idx[campo] = i;
    }
  });
  return idx;
}

function parseDataChegada(valor) {
  if (!valor) return null;
  if (valor instanceof Date && !isNaN(valor)) return valor;
  const s = String(valor).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d)) return d;
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, dia, mes, ano, hora, min, seg] = m;
    const d = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hora || 0), Number(min || 0), Number(seg || 0));
    if (!isNaN(d)) return d;
  }
  return null;
}

async function importarLeadsEmLote(leads) {
  let inseridos = 0, jaExistiam = 0, incompletos = 0;
  const linhasIncompletas = [], erros = [];

  leads.forEach((item, i) => {
    if (!(item.nome || '').trim()) {
      incompletos++;
      linhasIncompletas.push(`linha ${i + 2} (sem nome)`);
    }
  });

  for (const item of leads) {
    const nome = (item.nome || '').trim();
    const whatsappBruto = (item.whatsapp || '').trim();
    if (!nome) continue;

    const whatsappValido = canonicalizarWhatsapp(whatsappBruto);
    const numeroInvalido = !whatsappValido;
    const whatsapp = whatsappValido || gerarChaveSemNumero(nome, item.email);
    const dataReal = parseDataChegada(item.dataChegada);
    if (!dataReal && item.dataChegada) {
      console.log(`[DIAGNÓSTICO DATA] Não consegui entender a data de "${nome}". Valor: ${JSON.stringify(item.dataChegada)}`);
    }
    const dataFinal = dataReal || new Date();
    const origemFinal = item.origem || inferirOrigemDeTexto(item.imovelDesc) || null;

    try {
      const result = await pool.query(
        `INSERT INTO leads (whatsapp, nome, corretor, origem, imovel_desc, numero_invalido, whatsapp_bruto, distribuido_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (whatsapp) DO UPDATE SET
           origem = COALESCE(leads.origem, EXCLUDED.origem),
           corretor = COALESCE(leads.corretor, EXCLUDED.corretor),
           distribuido_em = COALESCE($9, leads.distribuido_em),
           outros_corretores = CASE
             WHEN leads.corretor IS NOT NULL AND EXCLUDED.corretor IS NOT NULL
                  AND leads.corretor <> EXCLUDED.corretor
                  AND (leads.outros_corretores IS NULL OR position(EXCLUDED.corretor IN leads.outros_corretores) = 0)
             THEN COALESCE(leads.outros_corretores || ', ', '') || EXCLUDED.corretor
             ELSE leads.outros_corretores
           END
         RETURNING id, (xmax = 0) AS inserido_agora`,
        [whatsapp, nome, item.corretor || null, origemFinal, item.imovelDesc || null, numeroInvalido, numeroInvalido ? whatsappBruto : null, dataFinal, dataReal]
      );
      if (result.rows.length > 0 && result.rows[0].inserido_agora) inseridos++;
      else jaExistiam++;
    } catch (err) {
      erros.push(`${nome} (${whatsappBruto}): ${err.message}`);
    }
  }

  return { inseridos, jaExistiam, incompletos, linhasIncompletas, erros };
}

// ─── GOOGLE SHEETS ───────────────────────────────────────────
let googleAuthCache = null;
let sheetsClientCache = null;

async function getGoogleAuth() {
  if (googleAuthCache) return googleAuthCache;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return null;
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.JWT(
    credentials.client_email, null, credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets.readonly']
  );
  await auth.authorize();
  googleAuthCache = auth;
  return googleAuthCache;
}

async function getSheetsClient() {
  if (sheetsClientCache) return sheetsClientCache;
  const auth = await getGoogleAuth();
  if (!auth) return null;
  sheetsClientCache = google.sheets({ version: 'v4', auth });
  return sheetsClientCache;
}

async function sincronizarPlanilhaGoogle() {
  if (!process.env.GOOGLE_SHEET_ID) return { ok: false, erro: 'GOOGLE_SHEET_ID não configurada' };
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, erro: 'GOOGLE_SERVICE_ACCOUNT_KEY não configurada' };

  const range = process.env.GOOGLE_SHEET_RANGE || 'A1:Z10000';
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range });
  const linhas = response.data.values || [];
  if (linhas.length < 2) return { ok: true, inseridos: 0, ignorados: 0, erros: [] };

  const headers = linhas[0];
  const idx = mapearColunas(headers);
  console.log('[DIAGNÓSTICO PLANILHA] Cabeçalhos:', JSON.stringify(headers));
  console.log('[DIAGNÓSTICO PLANILHA] Mapeamento:', JSON.stringify(idx));

  const leads = linhas.slice(1).map(linha => ({
    nome: idx.nome !== undefined ? linha[idx.nome] : '',
    whatsapp: idx.whatsapp !== undefined ? linha[idx.whatsapp] : '',
    origem: idx.origem !== undefined ? linha[idx.origem] : null,
    corretor: idx.corretor !== undefined ? linha[idx.corretor] : null,
    imovelDesc: idx.imovelDesc !== undefined ? linha[idx.imovelDesc] : null,
    dataChegada: idx.dataChegada !== undefined ? linha[idx.dataChegada] : null,
  }));

  const resultado = await importarLeadsEmLote(leads);
  console.log(`[Google Sheets] Sincronizado: ${resultado.inseridos} novos, ${resultado.jaExistiam} já existiam, ${resultado.incompletos} incompletos`);
  return { ok: true, ...resultado };
}

function extrairCodigoImovel(imovelCodigo, imovelDesc) {
  const texto = `${imovelCodigo || ''} ${imovelDesc || ''}`.toUpperCase();
  const match = texto.match(/[A-Z]{2}\d{2,}/);
  if (match) return match[0];
  return normalizarTexto(imovelDesc || imovelCodigo || 'sem-identificacao');
}

function agruparCampanhas(linhas) {
  const grupos = new Map();
  for (const linha of linhas) {
    const chave = extrairCodigoImovel(linha.imovel_codigo, linha.imovel_desc);
    const total = parseInt(linha.total, 10) || 0;
    const totalContataram = parseInt(linha.total_contataram, 10) || 0;
    if (!grupos.has(chave)) grupos.set(chave, { imovel_codigo: linha.imovel_codigo, imovel_desc: linha.imovel_desc, total: 0, total_contataram: 0 });
    const grupo = grupos.get(chave);
    grupo.total += total;
    grupo.total_contataram += totalContataram;
    if ((linha.imovel_desc || '').length > (grupo.imovel_desc || '').length) {
      grupo.imovel_codigo = linha.imovel_codigo || grupo.imovel_codigo;
      grupo.imovel_desc = linha.imovel_desc;
    }
  }
  return Array.from(grupos.values()).sort((a, b) => b.total - a.total);
}

// ─── ÍNDICE PERSISTENTE ──────────────────────────────────────
const INDEX_FILE = '/tmp/index.json';

function lerIndice() {
  try { const data = fs.readFileSync(INDEX_FILE, 'utf8'); return JSON.parse(data).index || 0; }
  catch { return 0; }
}

function salvarIndice(index) {
  try { fs.writeFileSync(INDEX_FILE, JSON.stringify({ index })); }
  catch (e) { console.error('Erro ao salvar índice:', e); }
}

// ─── BUFFER DE MENSAGENS (agrupamento 10 min) ────────────────
const bufferMensagens = {};
let timerResumo = null;

function adicionarAoBuffer(de, conteudo) {
  if (!bufferMensagens[de]) bufferMensagens[de] = [];
  bufferMensagens[de].push(conteudo);
  if (!timerResumo) {
    timerResumo = setTimeout(enviarResumo, 10 * 60 * 1000);
    console.log('Timer de resumo iniciado (10 min)');
  }
}

async function enviarResumo() {
  timerResumo = null;
  const contatos = Object.keys(bufferMensagens);
  if (contatos.length === 0) return;
  let texto = `📱 *Resumo de mensagens*\n_Últimos 10 minutos_\n`;
  for (const numero of contatos) {
    const msgs = bufferMensagens[numero];
    texto += `\n👤 *${numero}*\n`;
    for (const msg of msgs) texto += `• ${msg}\n`;
    delete bufferMensagens[numero];
  }
  await enviarWhatsApp(JULIANE_LL, texto);
  console.log('Resumo enviado para Juliane LL');
}

// ─── FUNÇÃO: ENVIAR MENSAGEM WHATSAPP ────────────────────────
async function enviarWhatsApp(fone, mensagem, instancia = EVOLUTION_INSTANCE) {
  const res = await fetch(`${EVOLUTION_URL}/message/sendText/${instancia}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_TOKEN },
    body: JSON.stringify({ number: fone, text: mensagem }),
  });
  return res.json();
}

function formatarTelefone(ddd, phone) {
  if (ddd && phone) {
    const p = phone.replace(/\D/g, '');
    if (p.length === 9) return `(${ddd}) ${p.slice(0,5)}-${p.slice(5)}`;
    if (p.length === 8) return `(${ddd}) ${p.slice(0,4)}-${p.slice(4)}`;
    return `(${ddd}) ${p}`;
  }
  return 'Não informado';
}

function limparMensagem(msg) {
  if (!msg) return '';
  const corte = msg.indexOf('A seguir, dados para contato');
  if (corte !== -1) return msg.substring(0, corte).trim();
  return msg.trim();
}

// ─── BACKUP DIÁRIO ───────────────────────────────────────────
async function fazerBackupDiario() {
  if (!process.env.DATABASE_URL) return { ok: false, erro: 'DATABASE_URL não configurada' };
  try {
    const leadsResult = await pool.query('SELECT * FROM leads ORDER BY id');
    await pool.query(`INSERT INTO backups_leads (total_leads, dados) VALUES ($1, $2)`, [leadsResult.rows.length, JSON.stringify(leadsResult.rows)]);
    await pool.query(`DELETE FROM backups_leads WHERE id NOT IN (SELECT id FROM backups_leads ORDER BY criado_em DESC LIMIT 30)`);
    console.log(`✅ Backup diário salvo: ${leadsResult.rows.length} leads`);
    const nomeArquivo = `backup-leads-${new Date().toISOString().slice(0, 10)}.json`;
    const resultadoDrive = await salvarBackupNoDrive(leadsResult.rows, nomeArquivo);
    return { ok: true, totalLeads: leadsResult.rows.length, drive: resultadoDrive };
  } catch (err) {
    console.error('Erro ao fazer backup diário:', err);
    return { ok: false, erro: err.message };
  }
}

async function lerConfig(chave) {
  const result = await pool.query('SELECT valor FROM config_sistema WHERE chave = $1', [chave]);
  return result.rows[0]?.valor || null;
}

async function salvarConfig(chave, valor) {
  await pool.query(
    `INSERT INTO config_sistema (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
    [chave, valor]
  );
}

let driveOAuthClientCache = null;
async function getDriveClientOAuth() {
  const refreshToken = await lerConfig('google_drive_refresh_token');
  if (!refreshToken) return null;
  const oauthClient = getOAuthClient();
  if (!oauthClient) return null;
  if (!driveOAuthClientCache || driveOAuthClientCache._refreshToken !== refreshToken) {
    oauthClient.setCredentials({ refresh_token: refreshToken });
    driveOAuthClientCache = google.drive({ version: 'v3', auth: oauthClient });
    driveOAuthClientCache._refreshToken = refreshToken;
  }
  return driveOAuthClientCache;
}

async function salvarBackupNoDrive(dados, nomeArquivo) {
  const drive = await getDriveClientOAuth();
  if (!drive) {
    const msg = 'Drive ainda não autorizado — acesse /api/admin/drive-auth pra autorizar uma vez';
    console.warn(`⚠️  ${msg}`);
    return { ok: false, erro: msg };
  }
  try {
    const requestBody = { name: nomeArquivo };
    if (process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID) requestBody.parents = [process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID];
    await drive.files.create({ requestBody, media: { mimeType: 'application/json', body: Readable.from(JSON.stringify(dados, null, 2)) } });
    console.log(`✅ Backup também salvo no Google Drive: ${nomeArquivo}`);
    return { ok: true };
  } catch (err) {
    const detalhe = err?.errors?.[0]?.message || err.message;
    console.error('Erro ao salvar backup no Google Drive:', detalhe);
    return { ok: false, erro: detalhe };
  }
}

// ─── PARSER DE DISTRIBUIÇÃO ──────────────────────────────────
function parseDistribuicao(texto) {
  if (!texto) return null;
  const corretorMatch = texto.match(/corretor\s*[:\-]?\s*(.+)/i);
  const whatsappMatch = texto.match(/(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}/);
  if (!corretorMatch || !whatsappMatch) return null;
  const nomeMatch = texto.match(/nome\s*[:\-]?\s*(.+)/i);
  const emailMatch = texto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const origemMatch = texto.match(/(?:origem|canal|veio de)\s*[:\-]?\s*(.+)/i);
  const primeiraLinha = texto.split('\n')[0].trim();
  let imovelDesc = primeiraLinha;
  const prefixMatch = primeiraLinha.match(/interessado\s+(.+)/i);
  if (prefixMatch) imovelDesc = prefixMatch[1].trim();
  let imovelCodigo = '';
  const codigoMatch = imovelDesc.match(/^([A-Z]{2}\d+)\s*-?\s*(.*)$/);
  if (codigoMatch) { imovelCodigo = codigoMatch[1]; imovelDesc = codigoMatch[2].trim(); }
  return {
    nome: nomeMatch ? nomeMatch[1].trim() : 'Sem nome',
    email: emailMatch ? emailMatch[0] : null,
    whatsapp: canonicalizarWhatsapp(whatsappMatch[0]),
    corretor: corretorMatch[1].trim(),
    origem: origemMatch ? origemMatch[1].trim() : inferirOrigemDeTexto(texto, imovelCodigo),
    imovelCodigo, imovelDesc, mensagemOriginal: texto,
  };
}

async function salvarDistribuicao(dados, origemPadrao = null) {
  const origem = dados.origem || origemPadrao || null;
  const numeroInvalido = !dados.whatsapp;
  const whatsappFinal = dados.whatsapp || gerarChaveSemNumero(dados.nome, dados.email);
  const whatsappBruto = numeroInvalido ? (dados.whatsappBruto || null) : null;
  const interesse = dados.mensagemOriginal || null;
  await pool.query(
    `INSERT INTO leads (whatsapp, nome, email, corretor, imovel_codigo, imovel_desc, origem, numero_invalido, whatsapp_bruto, interesse)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (whatsapp) DO UPDATE SET
       nome = EXCLUDED.nome, email = EXCLUDED.email, corretor = EXCLUDED.corretor,
       imovel_codigo = EXCLUDED.imovel_codigo, imovel_desc = EXCLUDED.imovel_desc,
       origem = COALESCE(leads.origem, EXCLUDED.origem),
       interesse = COALESCE(EXCLUDED.interesse, leads.interesse),
       distribuido_em = now(), contatou = false, primeiro_contato_em = NULL, avisado_em = NULL,
       outros_corretores = CASE
         WHEN leads.corretor IS NOT NULL AND EXCLUDED.corretor IS NOT NULL
              AND leads.corretor <> EXCLUDED.corretor
              AND (leads.outros_corretores IS NULL OR position(leads.corretor IN leads.outros_corretores) = 0)
         THEN COALESCE(leads.outros_corretores || ', ', '') || leads.corretor
         ELSE leads.outros_corretores
       END`,
    [whatsappFinal, dados.nome, dados.email, dados.corretor, dados.imovelCodigo, dados.imovelDesc, origem, numeroInvalido, whatsappBruto, interesse]
  );
  console.log(`Lead distribuído salvo: ${dados.nome} → ${dados.corretor} (${whatsappFinal}) [origem: ${origem || 'pendente'}]`);
}

async function registrarLeadAutomatico(whatsapp, nome, mensagem, origemPadrao) {
  const existente = await pool.query('SELECT id FROM leads WHERE whatsapp = $1', [whatsapp]);
  if (existente.rows.length > 0) return false;
  await pool.query(
    `INSERT INTO leads (whatsapp, nome, corretor, origem, interesse) VALUES ($1, $2, NULL, $3, $4) ON CONFLICT (whatsapp) DO NOTHING`,
    [whatsapp, nome || 'Sem nome', origemPadrao, mensagem || null]
  );
  console.log(`[Auto] Novo contato registrado: ${nome || whatsapp} (${whatsapp}) [origem: ${origemPadrao}]`);
  return true;
}

function precisaAvisar(avisadoEm) {
  if (!avisadoEm) return true;
  return (Date.now() - new Date(avisadoEm).getTime()) > THROTTLE_AVISO_MS;
}

async function identificarLead(whatsapp, mensagemTexto) {
  const leadResult = await pool.query('SELECT * FROM leads WHERE whatsapp = $1', [whatsapp]);
  if (leadResult.rows.length > 0) {
    const lead = leadResult.rows[0];
    await pool.query(`UPDATE leads SET contatou = true, primeiro_contato_em = COALESCE(primeiro_contato_em, now()) WHERE whatsapp = $1`, [whatsapp]);
    if (precisaAvisar(lead.avisado_em)) {
      const imovel = [lead.imovel_codigo, lead.imovel_desc].filter(Boolean).join(' - ') || 'não informado';
      await enviarWhatsApp(JULIANE_LL, `✅ Lead identificado\nNome: ${lead.nome}\nWhatsApp: +${whatsapp}\nCorretor: ${lead.corretor}\nImóvel: ${imovel}`);
      await pool.query('UPDATE leads SET avisado_em = now() WHERE whatsapp = $1', [whatsapp]);
      console.log(`Juliane avisada: ${lead.nome} → ${lead.corretor}`);
    }
    return;
  }
  const naoIdentResult = await pool.query('SELECT * FROM leads_nao_identificados WHERE whatsapp = $1', [whatsapp]);
  const existente = naoIdentResult.rows[0];
  if (existente) await pool.query('UPDATE leads_nao_identificados SET mensagem = $1 WHERE whatsapp = $2', [mensagemTexto, whatsapp]);
  else await pool.query('INSERT INTO leads_nao_identificados (whatsapp, mensagem) VALUES ($1, $2)', [whatsapp, mensagemTexto]);
  if (precisaAvisar(existente?.avisado_em)) {
    await enviarWhatsApp(JULIANE_LL, `⚠️ Lead SEM corretor identificado\nWhatsApp: +${whatsapp}\nMensagem: "${mensagemTexto}"`);
    await pool.query('UPDATE leads_nao_identificados SET avisado_em = now() WHERE whatsapp = $1', [whatsapp]);
    console.log(`Juliane avisada: lead sem corretor (${whatsapp})`);
  }
}

// ─── ROTA: WEBHOOK DO CANAL PRO ──────────────────────────────
app.post('/lead-canalpro', async (req, res) => {
  try {
    const body = req.body;
    console.log('Lead recebido:', JSON.stringify(body, null, 2));
    const transactionType = body?.transactionType || '';
    const codigoImovel = body?.clientListingId || 'Não informado';
    const nomeCliente  = body?.name  || 'Não informado';
    const emailCliente = body?.email || 'Não informado';
    const ddd   = body?.ddd   || '';
    const phone = body?.phone || '';
    const telefone   = formatarTelefone(ddd, phone);
    const msgCliente = limparMensagem(body?.message);

    if (transactionType === 'RENT') {
      const texto = `Segue um lead de ALUGUEL via Canal Pro\n\nCRM : ${codigoImovel}\nNome : ${nomeCliente}\n${telefone}\n${emailCliente}\nOBS: ${msgCliente}`;
      await enviarWhatsApp(CYDA, texto);
      console.log('Lead de aluguel enviado para Cyda');
      return res.status(200).json({ ok: true, msg: 'Aluguel enviado para Cyda' });
    }

    // ─── DEFINE CORRETOR (fixo para Laís ou round-robin) ─────
    const corretor = definirCorretor(codigoImovel);

    const texto = `Segue um lead que veio através do Canal Pro\n\nCRM : ${codigoImovel}\nNome : ${nomeCliente}\n${telefone}\n${emailCliente}\nOBS: ${msgCliente}\nENVIADO CORRETOR ${corretor.nome.toUpperCase()}`;
    await enviarWhatsApp(corretor.fone, texto);

    const textoControle = `✅ Lead de venda distribuído\n\nCRM : ${codigoImovel}\nNome : ${nomeCliente}\n${telefone}\nCorretor: ${corretor.nome}`;
    await enviarWhatsApp(JULIANE_LL, textoControle);

    if (process.env.DATABASE_URL) {
      await salvarDistribuicao({
        whatsapp: canonicalizarWhatsapp(telefone),
        whatsappBruto: telefone,
        nome: nomeCliente,
        email: emailCliente,
        corretor: corretor.nome,
        imovelCodigo: codigoImovel,
        imovelDesc: '',
      }, 'OLX/Canal Pro');
    }

    console.log(`Lead enviado para ${corretor.nome} (${corretor.fone})`);
    res.status(200).json({ ok: true, corretor: corretor.nome });
  } catch (err) {
    console.error('Erro ao processar lead:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: ESPELHO DE MENSAGENS ──────────────────────────────
app.post('/webhook-mensagens', async (req, res) => {
  try {
    const body = req.body;
    const fromMe = body?.data?.key?.fromMe || body?.key?.fromMe || false;
    const jid = body?.data?.key?.remoteJid || body?.key?.remoteJid || '';
    if (jid.includes('@g.us')) { console.log('Mensagem de grupo ignorada'); return res.status(200).json({ ok: true }); }
    const de = canonicalizarWhatsapp(jid.replace('@s.whatsapp.net', '').replace('@c.us', ''));
    const msg = body?.data?.message || body?.message || {};
    const conteudo = msg?.conversation || msg?.extendedTextMessage?.text || msg?.imageMessage?.caption || '[mídia]';
    if (fromMe) {
      if (process.env.DATABASE_URL) {
        const distribuicao = parseDistribuicao(conteudo);
        if (distribuicao) {
          await salvarDistribuicao(distribuicao, null);
          await enviarWhatsApp(JULIANE_LL, `📋 Nova distribuição de lead:\n\n${conteudo}`);
          console.log(`Distribuição espelhada pra Juliane: ${distribuicao.nome} → ${distribuicao.corretor}`);
        }
      }
      return res.status(200).json({ ok: true });
    }
    adicionarAoBuffer(de, conteudo);
    console.log(`Mensagem de ${de} adicionada ao buffer`);
    if (process.env.DATABASE_URL) await identificarLead(de, conteudo);
    res.status(200).json({ ok: true });
  } catch (err) { console.error('Erro ao processar mensagem:', err); res.status(500).json({ ok: false, erro: err.message }); }
});

// ─── ROTA: WEBHOOK TIKTOK ────────────────────────────────────
app.post('/webhook-mensagens-tiktok', async (req, res) => {
  try {
    const body = req.body;
    const fromMe = body?.data?.key?.fromMe || body?.key?.fromMe || false;
    const jid = body?.data?.key?.remoteJid || body?.key?.remoteJid || '';
    if (jid.includes('@g.us')) { console.log('[TikTok] Mensagem de grupo ignorada'); return res.status(200).json({ ok: true }); }
    const de = canonicalizarWhatsapp(jid.replace('@s.whatsapp.net', '').replace('@c.us', ''));
    const msg = body?.data?.message || body?.message || {};
    const conteudo = msg?.conversation || msg?.extendedTextMessage?.text || msg?.imageMessage?.caption || '[mídia]';
    if (fromMe) {
      if (process.env.DATABASE_URL) {
        const distribuicao = parseDistribuicao(conteudo);
        if (distribuicao) {
          await salvarDistribuicao(distribuicao, 'TikTok');
          await enviarWhatsApp(JULIANE_LL, `📋 Nova distribuição de lead (TikTok):\n\n${conteudo}`);
          console.log(`[TikTok] Distribuição espelhada pra Juliane: ${distribuicao.nome} → ${distribuicao.corretor}`);
        }
      }
      return res.status(200).json({ ok: true });
    }
    if (process.env.DATABASE_URL) {
      const pushName = body?.data?.pushName || body?.pushName || null;
      await registrarLeadAutomatico(de, pushName, conteudo, 'TikTok');
    }
    res.status(200).json({ ok: true });
  } catch (err) { console.error('[TikTok] Erro:', err); res.status(500).json({ ok: false, erro: err.message }); }
});

// ─── AUTENTICAÇÃO ─────────────────────────────────────────────
function basicAuth(req, res, next) {
  const user = process.env.DASHBOARD_USER || 'diniz';
  const pass = process.env.DASHBOARD_PASS;
  if (!pass) { console.warn('⚠️  DASHBOARD_PASS não configurada — painel SEM senha.'); req.authTipo = 'admin'; return next(); }
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) { res.set('WWW-Authenticate', 'Basic realm="Painel de Leads"'); return res.status(401).send('Autenticação necessária'); }
  const [u, p] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
  if (u === user && p === pass) { req.authTipo = 'admin'; return next(); }
  res.set('WWW-Authenticate', 'Basic realm="Painel de Leads"');
  return res.status(401).send('Credenciais inválidas');
}

function basicAuthAdminOuSdr(req, res, next) {
  const adminUser = process.env.DASHBOARD_USER || 'diniz';
  const adminPass = process.env.DASHBOARD_PASS;
  const sdrUser = process.env.CRM_USER || 'sdr';
  const sdrPass = process.env.CRM_PASS;
  if (!adminPass && !sdrPass) { console.warn('⚠️  Nenhuma senha configurada — CRM SEM senha.'); req.authTipo = 'admin'; return next(); }
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) { res.set('WWW-Authenticate', 'Basic realm="Painel de Leads"'); return res.status(401).send('Autenticação necessária'); }
  const [u, p] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
  if (adminPass && u === adminUser && p === adminPass) { req.authTipo = 'admin'; return next(); }
  if (sdrPass && u === sdrUser && p === sdrPass) { req.authTipo = 'sdr'; return next(); }
  res.set('WWW-Authenticate', 'Basic realm="Painel de Leads"');
  return res.status(401).send('Credenciais inválidas');
}

const CAMPOS_EDITAVEIS_SDR = ['status', 'notas_sdr'];

// ─── ROTA: API DE LEADS ──────────────────────────────────────
app.get('/api/leads', basicAuthAdminOuSdr, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  try {
    const leadsResult = await pool.query(
      `SELECT id, whatsapp, nome, email, corretor, imovel_codigo, imovel_desc,
              distribuido_em, contatou, primeiro_contato_em,
              origem, interesse, status, ultimo_contato, aprovado, visita, proposta, venda,
              numero_invalido, whatsapp_bruto, outros_corretores, sem_retorno, em_andamento,
              notas_sdr, reaquecido_em
       FROM leads ORDER BY distribuido_em DESC LIMIT 1000`
    );
    const naoIdentResult = await pool.query(
      `SELECT id, whatsapp, mensagem, corretor, criado_em FROM leads_nao_identificados WHERE criado_em > now() - interval '7 days' ORDER BY criado_em DESC LIMIT 50`
    );
    const statsResult = await pool.query(`
      SELECT
        count(*) FILTER (WHERE distribuido_em > now() - interval '7 days') AS total_distribuidos,
        count(*) FILTER (WHERE distribuido_em > now() - interval '7 days' AND contatou) AS total_contataram,
        count(*) FILTER (WHERE distribuido_em > now() - interval '24 hours') AS distribuidos_24h,
        count(*) FILTER (WHERE distribuido_em > now() - interval '7 days' AND aprovado) AS total_aprovados,
        count(*) FILTER (WHERE distribuido_em > now() - interval '7 days' AND visita) AS total_visitas,
        count(*) FILTER (WHERE distribuido_em > now() - interval '7 days' AND venda) AS total_vendas,
        avg(primeiro_contato_em - distribuido_em) FILTER (WHERE contatou AND distribuido_em > now() - interval '7 days') AS tempo_medio_contato
      FROM leads
    `);
    const semCorretor24hResult = await pool.query(`SELECT count(*) AS total FROM leads_nao_identificados WHERE criado_em > now() - interval '24 hours'`);
    const porCorretorResult = await pool.query(`SELECT corretor, count(*) AS total FROM leads GROUP BY corretor ORDER BY total DESC`);
    const porCorretorDetalhadoResult = await pool.query(`
      SELECT corretor, count(*) AS total,
        count(*) FILTER (WHERE contatou) AS contataram,
        count(*) FILTER (WHERE aprovado) AS aprovados,
        count(*) FILTER (WHERE visita) AS visitas,
        count(*) FILTER (WHERE proposta) AS propostas,
        count(*) FILTER (WHERE venda) AS vendas
      FROM leads WHERE corretor IS NOT NULL GROUP BY corretor ORDER BY total DESC
    `);
    const totalGeralResult = await pool.query(`
      SELECT count(*) AS total, count(*) FILTER (WHERE contatou) AS contataram,
        count(*) FILTER (WHERE aprovado) AS aprovados, count(*) FILTER (WHERE visita) AS visitas,
        count(*) FILTER (WHERE proposta) AS propostas, count(*) FILTER (WHERE venda) AS vendas,
        count(*) FILTER (WHERE numero_invalido) AS sem_numero_valido FROM leads
    `);
    const porCampanhaResult = await pool.query(`
      SELECT imovel_codigo, imovel_desc, count(*) AS total, count(*) FILTER (WHERE contatou) AS total_contataram
      FROM leads GROUP BY imovel_codigo, imovel_desc ORDER BY total DESC
    `);
    const porOrigemResult = await pool.query(`SELECT COALESCE(origem, 'Não informado') AS origem, count(*) AS total FROM leads GROUP BY origem ORDER BY total DESC`);

    res.json({
      ok: true,
      leads: leadsResult.rows,
      naoIdentificados: naoIdentResult.rows,
      stats: {
        totalDistribuidos: parseInt(statsResult.rows[0].total_distribuidos, 10) || 0,
        totalContataram: parseInt(statsResult.rows[0].total_contataram, 10) || 0,
        distribuidos24h: parseInt(statsResult.rows[0].distribuidos_24h, 10) || 0,
        totalAprovados: parseInt(statsResult.rows[0].total_aprovados, 10) || 0,
        totalVisitas: parseInt(statsResult.rows[0].total_visitas, 10) || 0,
        totalVendas: parseInt(statsResult.rows[0].total_vendas, 10) || 0,
        semCorretor24h: parseInt(semCorretor24hResult.rows[0].total, 10) || 0,
        tempoMedioContatoSegundos: statsResult.rows[0].tempo_medio_contato
          ? Math.round(statsResult.rows[0].tempo_medio_contato.hours * 3600 + statsResult.rows[0].tempo_medio_contato.minutes * 60 + (statsResult.rows[0].tempo_medio_contato.seconds || 0))
          : null,
      },
      porCorretor: porCorretorResult.rows,
      porCorretorDetalhado: porCorretorDetalhadoResult.rows.map(r => ({
        corretor: r.corretor, total: parseInt(r.total, 10) || 0,
        contataram: parseInt(r.contataram, 10) || 0, aprovados: parseInt(r.aprovados, 10) || 0,
        visitas: parseInt(r.visitas, 10) || 0, propostas: parseInt(r.propostas, 10) || 0, vendas: parseInt(r.vendas, 10) || 0,
      })),
      totalGeral: {
        total: parseInt(totalGeralResult.rows[0].total, 10) || 0,
        contataram: parseInt(totalGeralResult.rows[0].contataram, 10) || 0,
        aprovados: parseInt(totalGeralResult.rows[0].aprovados, 10) || 0,
        visitas: parseInt(totalGeralResult.rows[0].visitas, 10) || 0,
        propostas: parseInt(totalGeralResult.rows[0].propostas, 10) || 0,
        vendas: parseInt(totalGeralResult.rows[0].vendas, 10) || 0,
        semNumeroValido: parseInt(totalGeralResult.rows[0].sem_numero_valido, 10) || 0,
      },
      porCampanha: agruparCampanhas(porCampanhaResult.rows),
      porOrigem: porOrigemResult.rows,
      corretoresDisponiveis: [...CORRETORES.map(c => c.nome), ...CORRETORES_EXTRA_DASHBOARD],
    });
  } catch (err) { console.error('Erro ao buscar leads:', err); res.status(500).json({ ok: false, erro: err.message }); }
});

app.post('/api/leads/import', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  const { leads } = req.body;
  if (!Array.isArray(leads) || leads.length === 0) return res.status(400).json({ ok: false, erro: 'Nenhum lead recebido' });
  const resultado = await importarLeadsEmLote(leads);
  console.log(`Importação manual: ${resultado.inseridos} inseridos, ${resultado.jaExistiam} já existiam, ${resultado.incompletos} incompletos`);
  res.json({ ok: true, ...resultado });
});

app.post('/api/sincronizar-planilha', basicAuth, async (req, res) => {
  try { const resultado = await sincronizarPlanilhaGoogle(); if (!resultado.ok) return res.status(400).json(resultado); res.json(resultado); }
  catch (err) { console.error('Erro ao sincronizar planilha:', err); res.status(500).json({ ok: false, erro: err.message }); }
});

app.post('/api/leads', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  const { nome, whatsapp, origem, corretor, imovelDesc } = req.body;
  if (!nome || !whatsapp || !corretor) return res.status(400).json({ ok: false, erro: 'nome, whatsapp e corretor são obrigatórios' });
  const whatsappValido = canonicalizarWhatsapp(whatsapp);
  const numeroInvalido = !whatsappValido;
  const whatsappNormalizado = whatsappValido || gerarPlaceholderSemNumero();
  try {
    const result = await pool.query(
      `INSERT INTO leads (whatsapp, nome, corretor, imovel_desc, origem, numero_invalido, whatsapp_bruto) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [whatsappNormalizado, nome, corretor, imovelDesc || null, origem || null, numeroInvalido, numeroInvalido ? whatsapp : null]
    );
    console.log(`Lead adicionado manualmente: ${nome} → ${corretor} (${whatsappNormalizado})`);
    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, erro: 'Já existe um lead com esse WhatsApp' });
    console.error('Erro ao adicionar lead manual:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

app.patch('/api/leads-nao-identificados/:id', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  const { id } = req.params;
  const { campo, valor } = req.body;
  if (!CAMPOS_EDITAVEIS.includes(campo)) return res.status(400).json({ ok: false, erro: `Campo '${campo}' não é editável` });
  try {
    const naoIdentResult = await pool.query('SELECT whatsapp, mensagem FROM leads_nao_identificados WHERE id = $1', [id]);
    if (naoIdentResult.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Não encontrado' });
    const { whatsapp, mensagem } = naoIdentResult.rows[0];
    const nomeInicial = campo === 'nome' ? valor : 'Sem nome';
    const colunaExtra = campo === 'nome' ? null : campo;
    const colunas = ['whatsapp', 'nome', 'interesse'];
    const valores = [whatsapp, nomeInicial, mensagem || null];
    if (colunaExtra) { colunas.push(colunaExtra); valores.push(valor); }
    let setClauseOrigem = '';
    if (campo !== 'origem') {
      const origemInferida = inferirOrigemDeTexto(mensagem);
      if (origemInferida) { colunas.push('origem'); valores.push(origemInferida); setClauseOrigem = ', origem = COALESCE(leads.origem, EXCLUDED.origem)'; }
    }
    const placeholders = valores.map((_, i) => `$${i + 1}`).join(', ');
    const setClause = (colunaExtra ? `${colunaExtra} = EXCLUDED.${colunaExtra}` : 'nome = EXCLUDED.nome') + setClauseOrigem;
    const insertResult = await pool.query(
      `INSERT INTO leads (${colunas.join(', ')}) VALUES (${placeholders}) ON CONFLICT (whatsapp) DO UPDATE SET ${setClause} RETURNING id`,
      valores
    );
    await pool.query('DELETE FROM leads_nao_identificados WHERE id = $1', [id]);
    console.log(`Contato promovido a lead: ${whatsapp} [${campo} = ${valor}]`);
    res.json({ ok: true, promovido: true, id: insertResult.rows[0].id });
  } catch (err) { console.error('Erro ao editar não identificado:', err); res.status(500).json({ ok: false, erro: err.message }); }
});

app.post('/api/admin/inferir-origens-pendentes', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  try {
    const pendentes = await pool.query(`SELECT id, imovel_codigo, imovel_desc, interesse FROM leads WHERE origem IS NULL`);
    let atualizados = 0;
    for (const lead of pendentes.rows) {
      const codigo = (lead.imovel_codigo || '').trim();
      let origemInferida = /^\d+$/.test(codigo) ? 'OLX/Canal Pro' : inferirOrigemDeTexto([lead.imovel_codigo, lead.imovel_desc, lead.interesse].filter(Boolean).join(' '));
      if (origemInferida) { await pool.query('UPDATE leads SET origem = $1 WHERE id = $2', [origemInferida, lead.id]); atualizados++; }
    }
    console.log(`Inferência de origem em massa: ${atualizados} de ${pendentes.rows.length} atualizados`);
    res.json({ ok: true, atualizados, totalPendentes: pendentes.rows.length });
  } catch (err) { console.error('Erro ao inferir origens pendentes:', err); res.status(500).json({ ok: false, erro: err.message }); }
});

app.post('/api/admin/mesclar-duplicados-numero-formato', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  try {
    const todos = await pool.query(`SELECT id, whatsapp, distribuido_em, corretor, outros_corretores FROM leads WHERE numero_invalido = false`);
    const grupos = new Map();
    for (const lead of todos.rows) {
      const chave = canonicalizarWhatsapp(lead.whatsapp) || lead.whatsapp;
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(lead);
    }
    let mesclados = 0;
    for (const [chave, leads] of grupos) {
      if (leads.length <= 1) continue;
      leads.sort((a, b) => new Date(a.distribuido_em) - new Date(b.distribuido_em));
      const [sobrevivente, ...restantes] = leads;
      const corretoresExtras = new Set((sobrevivente.outros_corretores || '').split(',').map(s => s.trim()).filter(Boolean));
      for (const l of restantes) {
        if (l.corretor && l.corretor !== sobrevivente.corretor) corretoresExtras.add(l.corretor);
        await pool.query('DELETE FROM leads WHERE id = $1', [l.id]);
        mesclados++;
      }
      const novosOutrosCorretores = corretoresExtras.size > 0 ? Array.from(corretoresExtras).join(', ') : null;
      if (sobrevivente.whatsapp !== chave || novosOutrosCorretores !== sobrevivente.outros_corretores) {
        await pool.query('UPDATE leads SET whatsapp = $1, outros_corretores = $2 WHERE id = $3', [chave, novosOutrosCorretores, sobrevivente.id]);
      }
    }
    const obsoletosResult = await pool.query(`DELETE FROM leads inv USING leads bom WHERE inv.numero_invalido = true AND bom.numero_invalido = false AND inv.nome = bom.nome RETURNING inv.id`);
    mesclados += obsoletosResult.rowCount;
    console.log(`Mesclagem de duplicados: ${mesclados} removidos`);
    res.json({ ok: true, mesclados });
  } catch (err) { console.error('Erro ao mesclar duplicados:', err); res.status(500).json({ ok: false, erro: err.message }); }
});

const DADOS_CORRIGIDOS_CANALPRO = [
  { whatsapp: '5511997771727', corretor: 'Laís', data: '26/08/2026 19:39' },{ whatsapp: '5562993767420', corretor: 'Laís', data: '25/08/2026 12:40' },
  { whatsapp: '5541988481366', corretor: 'Laís', data: '24/08/2026 11:55' },{ whatsapp: '5562992699641', corretor: 'Junior', data: '23/08/2026 21:45' },
  { whatsapp: '5562994442693', corretor: 'Nalcio', data: '22/08/2026 19:22' },{ whatsapp: '5562992671240', corretor: 'Laís', data: '21/08/2026 12:55' },
  { whatsapp: '5562994084045', corretor: 'Nalcio', data: '20/08/2026 10:45' },{ whatsapp: '5562994546023', corretor: 'Laís', data: '19/08/2026 14:32' },
  { whatsapp: '5562991071195', corretor: 'Renata', data: '19/08/2026 12:37' },{ whatsapp: '5516988505505', corretor: 'Laís', data: '17/08/2026 23:17' },
  { whatsapp: '5562996448898', corretor: 'Renata', data: '17/08/2026 08:48' },{ whatsapp: '5562991814817', corretor: 'Junior', data: '14/08/2026 07:35' },
  { whatsapp: '5562992295892', corretor: 'Nalcio', data: '14/08/2026 04:09' },{ whatsapp: '5562982679938', corretor: 'Laís', data: '12/08/2026 22:25' },
  { whatsapp: '5562981224201', corretor: 'Junior', data: '10/08/2026 10:07' },{ whatsapp: '5562992795220', corretor: 'Renata', data: '09/08/2026 16:17' },
  { whatsapp: '5562992402227', corretor: 'Nalcio', data: '08/08/2026 19:24' },{ whatsapp: '5535383361855', corretor: 'Laís', data: '08/08/2026 17:41' },
  { whatsapp: '5562984111295', corretor: 'Nalcio', data: '08/08/2026 08:52' },{ whatsapp: '5561984172632', corretor: 'Laís', data: '05/08/2026 16:02' },
  { whatsapp: '5511945655849', corretor: 'Nalcio', data: '05/08/2026 10:43' },{ whatsapp: '5562996973237', corretor: 'Laís', data: '04/08/2026 16:02' },
  { whatsapp: '5562994069875', corretor: 'Nalcio', data: '04/08/2026 06:28' },{ whatsapp: '5562992638241', corretor: 'Nalcio', data: '02/08/2026 21:48' },
  { whatsapp: '5564996432984', corretor: 'Nalcio', data: '02/08/2026 16:53' },{ whatsapp: '5562991481170', corretor: 'Laís', data: '31/07/2026 19:01' },
  { whatsapp: '5562994891474', corretor: 'Nalcio', data: '29/07/2026 12:01' },{ whatsapp: '5562982249292', corretor: 'Laís', data: '27/07/2026 15:40' },
  { whatsapp: '5562991681084', corretor: 'Renata', data: '27/07/2026 13:57' },{ whatsapp: '5562991876319', corretor: 'Nalcio', data: '25/07/2026 08:10' },
  { whatsapp: '5563999167720', corretor: 'Nalcio', data: '23/07/2026 08:01' },{ whatsapp: '5562995393451', corretor: 'Renata', data: '21/07/2026 11:54' },
  { whatsapp: '5562992296303', corretor: 'Nalcio', data: '20/07/2026 09:22' },{ whatsapp: '5562981007075', corretor: 'Nalcio', data: '16/07/2026 19:35' },
  { whatsapp: '5562991754544', corretor: 'Laís', data: '16/07/2026 19:14' },{ whatsapp: '5562985993485', corretor: 'Renata', data: '15/07/2026 13:34' },
  { whatsapp: '5511951268877', corretor: 'Nalcio', data: '14/07/2026 12:09' },{ whatsapp: '5562993908306', corretor: 'Laís', data: '12/07/2026 06:57' },
  { whatsapp: '5562992118453', corretor: 'Nalcio', data: '12/07/2026 00:14' },{ whatsapp: '5562991075395', corretor: 'Laís', data: '11/07/2026 12:38' },
  { whatsapp: '5562991724840', corretor: 'Nalcio', data: '10/07/2026 18:30' },{ whatsapp: '5562993456060', corretor: 'Nalcio', data: '09/07/2026 14:20' },
  { whatsapp: '5562992474585', corretor: 'Nalcio', data: '09/07/2026 00:03' },{ whatsapp: '5562994933970', corretor: 'Laís', data: '07/07/2026 18:09' },
  { whatsapp: '5562993580158', corretor: 'Laís', data: '02/07/2026 09:46' },{ whatsapp: '5562998368040', corretor: 'Nalcio', data: '01/07/2026 12:44' },
  { whatsapp: '5562994057532', corretor: 'Laís', data: '01/07/2026 04:55' },{ whatsapp: '5562995675744', corretor: 'Nalcio', data: '30/06/2026 10:00' },
  { whatsapp: '5562981502498', corretor: 'Laís', data: '30/06/2026 02:12' },{ whatsapp: '5562994679355', corretor: 'Nalcio', data: '29/06/2026 11:41' },
  { whatsapp: '5511982795830', corretor: 'Laís', data: '28/06/2026 21:32' },{ whatsapp: '5562996986440', corretor: 'Laís', data: '23/06/2026 19:44' },
];

app.post('/api/admin/corrigir-canalpro-fixo', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  try {
    let corrigidos = 0, naoEncontrados = 0;
    for (const item of DADOS_CORRIGIDOS_CANALPRO) {
      const result = await pool.query(`UPDATE leads SET corretor = $1, distribuido_em = $2 WHERE whatsapp = $3 RETURNING id`, [item.corretor, parseDataChegada(item.data), item.whatsapp]);
      if (result.rowCount > 0) corrigidos++; else naoEncontrados++;
    }
    console.log(`Correção fixa Canal Pro: ${corrigidos} corrigidos, ${naoEncontrados} não encontrados`);
    res.json({ ok: true, corrigidos, naoEncontrados, total: DADOS_CORRIGIDOS_CANALPRO.length });
  } catch (err) { console.error('Erro ao corrigir Canal Pro:', err); res.status(500).json({ ok: false, erro: err.message }); }
});

app.post('/api/admin/limpar-duplicados-sem-numero', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  try {
    const result = await pool.query(`DELETE FROM leads a USING leads b WHERE a.numero_invalido = true AND b.numero_invalido = true AND a.nome = b.nome AND COALESCE(a.email, '') = COALESCE(b.email, '') AND a.id > b.id RETURNING a.id`);
    console.log(`Limpeza de duplicados sem número: ${result.rowCount} removidos`);
    res.json({ ok: true, removidos: result.rowCount });
  } catch (err) { console.error('Erro ao limpar duplicados:', err); res.status(500).json({ ok: false, erro: err.message }); }
});

app.patch('/api/leads/:id/corrigir-whatsapp', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  const { id } = req.params;
  const { whatsapp } = req.body;
  const whatsappValido = canonicalizarWhatsapp(whatsapp);
  if (!whatsappValido) return res.status(400).json({ ok: false, erro: 'Esse número não parece válido. Confere o DDD e os dígitos.' });
  try {
    const leadResult = await pool.query('SELECT numero_invalido FROM leads WHERE id = $1', [id]);
    if (leadResult.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Lead não encontrado' });
    if (!leadResult.rows[0].numero_invalido) return res.status(400).json({ ok: false, erro: 'Esse lead já tem um WhatsApp válido — não dá pra editar por aqui.' });
    await pool.query(`UPDATE leads SET whatsapp = $1, numero_invalido = false, whatsapp_bruto = NULL WHERE id = $2`, [whatsappValido, id]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, erro: 'Já existe outro lead com esse WhatsApp — pode ser a mesma pessoa duplicada.' });
    console.error('Erro ao corrigir WhatsApp:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

app.patch('/api/leads/:id', basicAuthAdminOuSdr, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  const { id } = req.params;
  const { campo, valor } = req.body;
  if (!CAMPOS_EDITAVEIS.includes(campo)) return res.status(400).json({ ok: false, erro: `Campo '${campo}' não é editável` });
  if (req.authTipo === 'sdr' && !CAMPOS_EDITAVEIS_SDR.includes(campo)) return res.status(403).json({ ok: false, erro: `Login da SDR não pode editar o campo '${campo}'` });
  try {
    if (campo === 'status' && valor === 'Reaquecendo') {
      await pool.query(`UPDATE leads SET status = $1, reaquecido_em = now() WHERE id = $2`, [valor, id]);
    } else {
      await pool.query(`UPDATE leads SET ${campo} = $1 WHERE id = $2`, [valor, id]);
    }
    res.json({ ok: true });
  } catch (err) { console.error('Erro ao editar lead:', err); res.status(500).json({ ok: false, erro: err.message }); }
});

app.get('/dashboard', basicAuth, (req, res) => { res.send(DASHBOARD_HTML); });
app.get('/crm', basicAuthAdminOuSdr, (req, res) => { res.send(CRM_HTML); });

// ─── ROTAS: BACKUPS ──────────────────────────────────────────
app.get('/api/admin/drive-auth', basicAuth, (req, res) => {
  const oauthClient = getOAuthClient();
  if (!oauthClient) return res.status(503).send('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET não configuradas.');
  const url = oauthClient.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: ['https://www.googleapis.com/auth/drive.file'] });
  res.redirect(url);
});

app.get(GOOGLE_OAUTH_REDIRECT_PATH, basicAuth, async (req, res) => {
  const oauthClient = getOAuthClient();
  if (!oauthClient) return res.status(503).send('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET não configuradas.');
  const { code, error } = req.query;
  if (error) return res.status(400).send(`Autorização recusada: ${error}`);
  if (!code) return res.status(400).send('Código de autorização não recebido.');
  try {
    const { tokens } = await oauthClient.getToken(code);
    if (!tokens.refresh_token) return res.status(400).send('Token permanente não recebido. Remova o acesso em myaccount.google.com/permissions e tente de novo.');
    await salvarConfig('google_drive_refresh_token', tokens.refresh_token);
    res.send('✅ Google Drive autorizado com sucesso!');
  } catch (err) { console.error('Erro ao trocar código por token:', err); res.status(500).send(`Erro ao autorizar: ${err.message}`); }
});

app.get('/api/admin/backups', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  try {
    const result = await pool.query(`SELECT id, criado_em, total_leads FROM backups_leads ORDER BY criado_em DESC`);
    res.json({ ok: true, backups: result.rows });
  } catch (err) { res.status(500).json({ ok: false, erro: err.message }); }
});

app.get('/api/admin/backups/:id/download', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  try {
    const result = await pool.query('SELECT * FROM backups_leads WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Backup não encontrado' });
    const backup = result.rows[0];
    const dataFormatada = new Date(backup.criado_em).toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="backup-leads-${dataFormatada}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(backup.dados, null, 2));
  } catch (err) { res.status(500).json({ ok: false, erro: err.message }); }
});

app.all('/api/admin/backups/agora', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  try { const resultado = await fazerBackupDiario(); res.json(resultado); }
  catch (err) { res.status(500).json({ ok: false, erro: err.message }); }
});

app.get('/', (req, res) => { res.send('✅ Diniz Leads OLX rodando!'); });

// ─── INICIA SERVIDOR ─────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  await initDb();

  if (process.env.DATABASE_URL) {
    fazerBackupDiario().catch(err => console.error('Erro no backup inicial:', err));
    setInterval(() => { fazerBackupDiario().catch(err => console.error('Erro no backup automático:', err)); }, 24 * 60 * 60 * 1000);
  }

  if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const INTERVALO_SYNC_MS = 10 * 60 * 1000;
    console.log('✅ Sincronização automática com Google Sheets ativada (a cada 10 min)');
    sincronizarPlanilhaGoogle().catch(err => console.error('Erro na sincronização inicial:', err));
    setInterval(() => { sincronizarPlanilhaGoogle().catch(err => console.error('Erro na sincronização automática:', err)); }, INTERVALO_SYNC_MS);
  } else {
    console.warn('⚠️  Sincronização com Google Sheets desativada — configure GOOGLE_SHEET_ID e GOOGLE_SERVICE_ACCOUNT_KEY pra ativar.');
  }
});
