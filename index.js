const express = require('express');
const fs = require('fs');
const { Pool } = require('pg');
const { google } = require('googleapis');
const { DASHBOARD_HTML } = require('./dashboard-template');
const app = express();
app.use(express.json());

// ─── CONFIGURAÇÕES ───────────────────────────────────────────
const EVOLUTION_URL = 'https://evolution-api-production-5e4f.up.railway.app';
const EVOLUTION_INSTANCE = 'diniz-leads-olx';
const EVOLUTION_INSTANCE_TIKTOK = 'diniz-tiktok';
const EVOLUTION_TOKEN = 'A0929C1CF6C5-4E04-9FFB-3A4B073EE943';

const JULIANE_LL = '5562992166458';
const CYDA       = '5562993652226';

const CORRETORES = [
  { nome: 'Laís',   fone: '5562992754858' },
  { nome: 'Nalcio', fone: '5562982077466' },
  { nome: 'Renata', fone: '5562992670935' },
  { nome: 'Junior', fone: '5562981625610' },
  { nome: 'Thayná', fone: '5562991749547' },
];

// Nomes extras que aparecem como opção no dropdown de corretor do dashboard,
// mas NÃO entram na fila de distribuição automática (round-robin) do Canal Pro
// — pra isso precisaria do telefone de cada um, cadastrado em CORRETORES acima.
const CORRETORES_EXTRA_DASHBOARD = ['Amanda', 'Juliane', 'Bruno'];

// ─── BANCO DE DADOS (leads distribuídos por texto) ───────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

const THROTTLE_AVISO_MS = 6 * 60 * 60 * 1000; // 6 horas

// Campos do funil que podem ser editados manualmente pelo dashboard
const CAMPOS_EDITAVEIS = ['nome', 'origem', 'corretor', 'interesse', 'status', 'aprovado', 'visita', 'proposta', 'venda', 'imovel_desc'];

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

  // ─── Migração: novas colunas do funil completo ─────────────
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
      ADD COLUMN IF NOT EXISTS outros_corretores TEXT;
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
}

// ─── IMPORTAÇÃO EM LOTE (reutilizada pelo upload manual e pela sincronização com Google Sheets) ─
// Origem inferida a partir de um texto livre (mensagem original ou distribuição):
// se tiver "CRM" escrito, é lead do OLX/Canal Pro; se tiver um código de imóvel
// (ex: VD01) sem CRM, é lead Patrocinado (Insta/Face); senão, fica pendente.
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

// Normaliza qualquer número de WhatsApp pro MESMO formato sempre (55 + DDD + 9 dígitos),
// resolvendo o problema clássico do "9º dígito" do celular no Brasil, que causa
// duplicidade de contatos quando o número chega em formatos diferentes por canais diferentes.
// Retorna null quando o número não tem dígitos suficientes pra ser válido (em vez de
// devolver algo incompleto que colidiria com outros leads sem número).
function canonicalizarWhatsapp(bruto) {
  let d = String(bruto || '').replace(/\D/g, '');
  if (!d) return null;

  // Remove o código do país se já vier com ele, pra normalizar a partir do DDD
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);

  // DDD (2 dígitos) + 8 dígitos = celular sem o "9" na frente — adiciona
  if (d.length === 10) {
    d = d.slice(0, 2) + '9' + d.slice(2);
  }

  // Precisa de pelo menos DDD (2) + 8 dígitos = 10 dígitos locais pra ser um número real
  if (d.length < 10) return null;

  return '55' + d;
}

// Gera um identificador único pra leads sem número de WhatsApp válido — assim eles não
// colidem uns com os outros (cada um vira sua própria linha, editável depois no dashboard)
let contadorSemNumero = 0;
function gerarPlaceholderSemNumero() {
  contadorSemNumero++;
  return `SEMNUM-${Date.now()}-${contadorSemNumero}-${Math.random().toString(36).slice(2, 7)}`;
}

// Gera um identificador ESTÁVEL (sempre igual pra mesma pessoa) quando não há WhatsApp válido,
// baseado em nome + email. Isso evita que a mesma linha, sem telefone, vire um lead novo
// toda vez que a planilha for sincronizada de novo (a cada 10 min).
function gerarChaveSemNumero(nome, email) {
  const base = normalizarTexto(`${nome || ''}|${email || ''}`);
  if (!base.replace(/\|/g, '')) return gerarPlaceholderSemNumero(); // nada pra basear, usa aleatório mesmo
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return `SEMNUM-${hash.toString(36)}`;
}

// Reconhece a coluna certa pelo nome do cabeçalho, mesmo com variações (acento, maiúscula, espaço)
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

// Entende data tanto em formato ISO (2026-08-26T19:39:00.000Z) quanto brasileiro
// (26/08/2026 19:39, com ou sem hora). Retorna null se não conseguir entender.
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
  let inseridos = 0;
  let jaExistiam = 0;
  let incompletos = 0;
  const linhasIncompletas = [];
  const erros = [];

  leads.forEach((item, i) => {
    const nome = (item.nome || '').trim();
    const whatsappBruto = (item.whatsapp || '').trim();
    if (!nome) {
      incompletos++;
      linhasIncompletas.push(`linha ${i + 2} (sem nome)`); // +2: cabeçalho + índice base 1
    }
  });

  for (const item of leads) {
    const nome = (item.nome || '').trim();
    const whatsappBruto = (item.whatsapp || '').trim();

    if (!nome) continue;

    const whatsappValido = canonicalizarWhatsapp(whatsappBruto);
    const numeroInvalido = !whatsappValido;
    const whatsapp = whatsappValido || gerarChaveSemNumero(nome, item.email);
    // dataReal: só preenchida quando o arquivo trouxe uma data que deu pra entender de verdade.
    // dataFinal: sempre tem um valor (cai pra agora se não tiver data), usada só na criação do lead novo.
    const dataReal = parseDataChegada(item.dataChegada);
    if (!dataReal && item.dataChegada) {
      console.log(`[DIAGNÓSTICO DATA] Não consegui entender a data de "${nome}". Valor bruto recebido: ${JSON.stringify(item.dataChegada)} (tipo: ${typeof item.dataChegada})`);
    }
    const dataFinal = dataReal || new Date();

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
        [whatsapp, nome, item.corretor || null, item.origem || 'Patrocinado', item.imovelDesc || null, numeroInvalido, numeroInvalido ? whatsappBruto : null, dataFinal, dataReal]
      );
      if (result.rows.length > 0 && result.rows[0].inserido_agora) inseridos++;
      else jaExistiam++;
    } catch (err) {
      erros.push(`${nome} (${whatsappBruto}): ${err.message}`);
    }
  }

  return { inseridos, jaExistiam, incompletos, linhasIncompletas, erros };
}

// ─── SINCRONIZAÇÃO AUTOMÁTICA COM GOOGLE SHEETS ──────────────
let sheetsClientCache = null;

async function getSheetsClient() {
  if (sheetsClientCache) return sheetsClientCache;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return null;

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets.readonly']
  );
  await auth.authorize();
  sheetsClientCache = google.sheets({ version: 'v4', auth });
  return sheetsClientCache;
}

async function sincronizarPlanilhaGoogle() {
  if (!process.env.GOOGLE_SHEET_ID) {
    return { ok: false, erro: 'GOOGLE_SHEET_ID não configurada' };
  }

  const sheets = await getSheetsClient();
  if (!sheets) {
    return { ok: false, erro: 'GOOGLE_SERVICE_ACCOUNT_KEY não configurada' };
  }

  const range = process.env.GOOGLE_SHEET_RANGE || 'A1:Z10000';
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range,
  });

  const linhas = response.data.values || [];
  if (linhas.length < 2) return { ok: true, inseridos: 0, ignorados: 0, erros: [] };

  const headers = linhas[0];
  const idx = mapearColunas(headers);
  console.log('[DIAGNÓSTICO PLANILHA] Cabeçalhos encontrados:', JSON.stringify(headers));
  console.log('[DIAGNÓSTICO PLANILHA] Mapeamento de colunas:', JSON.stringify(idx));

  const leads = linhas.slice(1).map(linha => ({
    nome: idx.nome !== undefined ? linha[idx.nome] : '',
    whatsapp: idx.whatsapp !== undefined ? linha[idx.whatsapp] : '',
    origem: idx.origem !== undefined ? linha[idx.origem] : null,
    corretor: idx.corretor !== undefined ? linha[idx.corretor] : null,
    imovelDesc: idx.imovelDesc !== undefined ? linha[idx.imovelDesc] : null,
    dataChegada: idx.dataChegada !== undefined ? linha[idx.dataChegada] : null,
  }));

  console.log('[DIAGNÓSTICO PLANILHA] 3 primeiras linhas brutas:', JSON.stringify(linhas.slice(1, 4)));
  console.log('[DIAGNÓSTICO PLANILHA] 3 primeiras datas extraídas:', JSON.stringify(leads.slice(0, 3).map(l => ({ nome: l.nome, dataChegada: l.dataChegada }))));

  const resultado = await importarLeadsEmLote(leads);
  console.log(`[Google Sheets] Sincronizado: ${resultado.inseridos} novos, ${resultado.jaExistiam} já existiam, ${resultado.incompletos} incompletos (sem nome/whatsapp)`);
  return { ok: true, ...resultado };
}

// Reconhece o código do imóvel (ex: VD01, AP02) dentro do código já salvo ou da descrição,
// e agrupa por esse código — assim "VD01" e "PATRICIA VD01 - GRAN VENEZA" viram a mesma campanha.
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

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        imovel_codigo: linha.imovel_codigo,
        imovel_desc: linha.imovel_desc,
        total: 0,
        total_contataram: 0,
      });
    }

    const grupo = grupos.get(chave);
    grupo.total += total;
    grupo.total_contataram += totalContataram;
    // Mantém a descrição mais completa (mais longa) como a exibida pro grupo
    const descAtual = (grupo.imovel_desc || '').length;
    const descNova = (linha.imovel_desc || '').length;
    if (descNova > descAtual) {
      grupo.imovel_codigo = linha.imovel_codigo || grupo.imovel_codigo;
      grupo.imovel_desc = linha.imovel_desc;
    }
  }

  return Array.from(grupos.values()).sort((a, b) => b.total - a.total);
}

// ─── ÍNDICE PERSISTENTE ──────────────────────────────────────
const INDEX_FILE = '/tmp/index.json';

function lerIndice() {
  try {
    const data = fs.readFileSync(INDEX_FILE, 'utf8');
    return JSON.parse(data).index || 0;
  } catch { return 0; }
}

function salvarIndice(index) {
  try {
    fs.writeFileSync(INDEX_FILE, JSON.stringify({ index }));
  } catch (e) { console.error('Erro ao salvar índice:', e); }
}

// ─── BUFFER DE MENSAGENS (agrupamento 10 min) ────────────────
const bufferMensagens = {}; // { numero: [{ texto, hora }] }
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

  let texto = `📱 *Resumo de mensagens*\n`;
  texto += `_Últimos 10 minutos_\n`;

  for (const numero of contatos) {
    const msgs = bufferMensagens[numero];
    texto += `\n👤 *${numero}*\n`;
    for (const msg of msgs) {
      texto += `• ${msg}\n`;
    }
    delete bufferMensagens[numero];
  }

  await enviarWhatsApp(JULIANE_LL, texto);
  console.log('Resumo enviado para Juliane LL');
}

// ─── FUNÇÃO: ENVIAR MENSAGEM WHATSAPP ────────────────────────
// instancia opcional — usa a instância principal por padrão
async function enviarWhatsApp(fone, mensagem, instancia = EVOLUTION_INSTANCE) {
  const res = await fetch(`${EVOLUTION_URL}/message/sendText/${instancia}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_TOKEN,
    },
    body: JSON.stringify({ number: fone, text: mensagem }),
  });
  return res.json();
}

// ─── FUNÇÃO: FORMATAR TELEFONE ───────────────────────────────
function formatarTelefone(ddd, phone) {
  if (ddd && phone) {
    const p = phone.replace(/\D/g, '');
    if (p.length === 9) return `(${ddd}) ${p.slice(0,5)}-${p.slice(5)}`;
    if (p.length === 8) return `(${ddd}) ${p.slice(0,4)}-${p.slice(4)}`;
    return `(${ddd}) ${p}`;
  }
  return 'Não informado';
}

// ─── FUNÇÃO: LIMPAR MENSAGEM DO CLIENTE ──────────────────────
function limparMensagem(msg) {
  if (!msg) return '';
  const corte = msg.indexOf('A seguir, dados para contato');
  if (corte !== -1) return msg.substring(0, corte).trim();
  return msg.trim();
}

// ─── LEAD ROUTER: PARSER DA MENSAGEM DE DISTRIBUIÇÃO ─────────
function parseDistribuicao(texto) {
  if (!texto) return null;

  const corretorMatch = texto.match(/corretor\s*[:\-]?\s*(.+)/i);
  const whatsappMatch = texto.match(/(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}/);

  if (!corretorMatch || !whatsappMatch) return null;

  const nomeMatch = texto.match(/nome\s*[:\-]?\s*(.+)/i);
  const emailMatch = texto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

  // Origem: reconhece se a própria mensagem de distribuição já disser de onde veio o lead
  // (ex: "origem: TikTok", "canal: Instagram", "veio de: Patrocinado")
  const origemMatch = texto.match(/(?:origem|canal|veio de)\s*[:\-]?\s*(.+)/i);

  const primeiraLinha = texto.split('\n')[0].trim();
  let imovelDesc = primeiraLinha;
  const prefixMatch = primeiraLinha.match(/interessado\s+(.+)/i);
  if (prefixMatch) imovelDesc = prefixMatch[1].trim();

  let imovelCodigo = '';
  const codigoMatch = imovelDesc.match(/^([A-Z]{2}\d+)\s*-?\s*(.*)$/);
  if (codigoMatch) {
    imovelCodigo = codigoMatch[1];
    imovelDesc = codigoMatch[2].trim();
  }

  const whatsappNormalizado = canonicalizarWhatsapp(whatsappMatch[0]);

  // Origem inferida quando a mensagem não diz explicitamente ("origem:"):
  // se tiver "CRM" escrito, é lead do OLX/Canal Pro (padrão dessas mensagens);
  // se tiver só o código do imóvel (ex: VD01) sem CRM, é lead Patrocinado (Insta/Face).
  let origemInferida = inferirOrigemDeTexto(texto, imovelCodigo);

  return {
    nome: nomeMatch ? nomeMatch[1].trim() : 'Sem nome',
    email: emailMatch ? emailMatch[0] : null,
    whatsapp: whatsappNormalizado,
    corretor: corretorMatch[1].trim(),
    origem: origemMatch ? origemMatch[1].trim() : origemInferida,
    imovelCodigo,
    imovelDesc,
    mensagemOriginal: texto,
  };
}

// origemPadrao: usada só se a mensagem em si não tiver a origem escrita (dados.origem).
// Prioridade: origem escrita na própria mensagem > origem padrão do canal > pendente (null)
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
       nome = EXCLUDED.nome,
       email = EXCLUDED.email,
       corretor = EXCLUDED.corretor,
       imovel_codigo = EXCLUDED.imovel_codigo,
       imovel_desc = EXCLUDED.imovel_desc,
       origem = COALESCE(leads.origem, EXCLUDED.origem),
       interesse = COALESCE(EXCLUDED.interesse, leads.interesse),
       distribuido_em = now(),
       contatou = false,
       primeiro_contato_em = NULL,
       avisado_em = NULL,
       outros_corretores = CASE
         WHEN leads.corretor IS NOT NULL AND EXCLUDED.corretor IS NOT NULL
              AND leads.corretor <> EXCLUDED.corretor
              AND (leads.outros_corretores IS NULL OR position(leads.corretor IN leads.outros_corretores) = 0)
         THEN COALESCE(leads.outros_corretores || ', ', '') || leads.corretor
         ELSE leads.outros_corretores
       END`,
    [whatsappFinal, dados.nome, dados.email, dados.corretor, dados.imovelCodigo, dados.imovelDesc, origem, numeroInvalido, whatsappBruto, interesse]
  );
  console.log(`Lead distribuído salvo: ${dados.nome} → ${dados.corretor} (${whatsappFinal}) [origem: ${origem || 'pendente'}]${numeroInvalido ? ' [SEM NÚMERO VÁLIDO]' : ''}`);
}

// ─── REGISTRO AUTOMÁTICO DE NOVO CONTATO (número do TikTok) ──
// Diferente do fluxo do Canal Pro/Juliane, esse número não recebe mensagem de
// distribuição formatada — então todo contato novo já vira uma linha no funil,
// com origem = 'TikTok' e corretor em branco (editável no dashboard).
async function registrarLeadAutomatico(whatsapp, nome, mensagem, origemPadrao) {
  const existente = await pool.query('SELECT id FROM leads WHERE whatsapp = $1', [whatsapp]);
  if (existente.rows.length > 0) return false; // já está na base, não sobrescreve

  await pool.query(
    `INSERT INTO leads (whatsapp, nome, corretor, origem, interesse)
     VALUES ($1, $2, NULL, $3, $4)
     ON CONFLICT (whatsapp) DO NOTHING`,
    [whatsapp, nome || 'Sem nome', origemPadrao, mensagem || null]
  );
  console.log(`[Auto] Novo contato registrado: ${nome || whatsapp} (${whatsapp}) [origem: ${origemPadrao}]`);
  return true;
}

// ─── LEAD ROUTER: IDENTIFICAÇÃO QUANDO O LEAD ESCREVE ────────
function precisaAvisar(avisadoEm) {
  if (!avisadoEm) return true;
  return (Date.now() - new Date(avisadoEm).getTime()) > THROTTLE_AVISO_MS;
}

async function identificarLead(whatsapp, mensagemTexto) {
  const leadResult = await pool.query('SELECT * FROM leads WHERE whatsapp = $1', [whatsapp]);

  if (leadResult.rows.length > 0) {
    const lead = leadResult.rows[0];

    await pool.query(
      `UPDATE leads SET contatou = true, primeiro_contato_em = COALESCE(primeiro_contato_em, now())
       WHERE whatsapp = $1`,
      [whatsapp]
    );

    if (precisaAvisar(lead.avisado_em)) {
      const imovel = [lead.imovel_codigo, lead.imovel_desc].filter(Boolean).join(' - ') || 'não informado';
      const texto =
        `✅ Lead identificado\n` +
        `Nome: ${lead.nome}\n` +
        `WhatsApp: +${whatsapp}\n` +
        `Corretor: ${lead.corretor}\n` +
        `Imóvel: ${imovel}`;
      await enviarWhatsApp(JULIANE_LL, texto);
      await pool.query('UPDATE leads SET avisado_em = now() WHERE whatsapp = $1', [whatsapp]);
      console.log(`Juliane avisada: ${lead.nome} → ${lead.corretor}`);
    }
    return;
  }

  const naoIdentResult = await pool.query(
    'SELECT * FROM leads_nao_identificados WHERE whatsapp = $1',
    [whatsapp]
  );
  const existente = naoIdentResult.rows[0];

  if (existente) {
    await pool.query(
      'UPDATE leads_nao_identificados SET mensagem = $1 WHERE whatsapp = $2',
      [mensagemTexto, whatsapp]
    );
  } else {
    await pool.query(
      'INSERT INTO leads_nao_identificados (whatsapp, mensagem) VALUES ($1, $2)',
      [whatsapp, mensagemTexto]
    );
  }

  if (precisaAvisar(existente?.avisado_em)) {
    const texto =
      `⚠️ Lead SEM corretor identificado\n` +
      `WhatsApp: +${whatsapp}\n` +
      `Mensagem: "${mensagemTexto}"`;
    await enviarWhatsApp(JULIANE_LL, texto);
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
    const nomeCliente  = body?.name            || 'Não informado';
    const emailCliente = body?.email           || 'Não informado';
    const ddd          = body?.ddd             || '';
    const phone        = body?.phone           || '';
    const telefone     = formatarTelefone(ddd, phone);
    const msgCliente   = limparMensagem(body?.message);

    if (transactionType === 'RENT') {
      const texto =
        `Segue um lead de ALUGUEL via Canal Pro\n\n` +
        `CRM : ${codigoImovel}\n` +
        `Nome : ${nomeCliente}\n` +
        `${telefone}\n` +
        `${emailCliente}\n` +
        `OBS: ${msgCliente}`;

      await enviarWhatsApp(CYDA, texto);
      console.log('Lead de aluguel enviado para Cyda');
      return res.status(200).json({ ok: true, msg: 'Aluguel enviado para Cyda' });
    }

    const indexAtual = lerIndice();
    const corretor = CORRETORES[indexAtual];
    salvarIndice((indexAtual + 1) % CORRETORES.length);

    const texto =
      `Segue um lead que veio através do Canal Pro\n\n` +
      `CRM : ${codigoImovel}\n` +
      `Nome : ${nomeCliente}\n` +
      `${telefone}\n` +
      `${emailCliente}\n` +
      `OBS: ${msgCliente}\n` +
      `ENVIADO CORRETOR ${corretor.nome.toUpperCase()}`;

    await enviarWhatsApp(corretor.fone, texto);

    const textoControle =
      `✅ Lead de venda distribuído\n\n` +
      `CRM : ${codigoImovel}\n` +
      `Nome : ${nomeCliente}\n` +
      `${telefone}\n` +
      `Corretor: ${corretor.nome}`;

    await enviarWhatsApp(JULIANE_LL, textoControle);

    // Registra no funil já com a origem conhecida
    if (process.env.DATABASE_URL) {
      const whatsappNormalizado = canonicalizarWhatsapp(telefone);
      await salvarDistribuicao({
        whatsapp: whatsappNormalizado,
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

// ─── ROTA: ESPELHO DE MENSAGENS + LEAD ROUTER (Juliane) ──────
app.post('/webhook-mensagens', async (req, res) => {
  try {
    const body = req.body;

    const fromMe = body?.data?.key?.fromMe || body?.key?.fromMe || false;
    const jid = body?.data?.key?.remoteJid || body?.key?.remoteJid || '';

    if (jid.includes('@g.us')) {
      console.log('Mensagem de grupo ignorada');
      return res.status(200).json({ ok: true });
    }

    const de = canonicalizarWhatsapp(jid.replace('@s.whatsapp.net', '').replace('@c.us', ''));
    const msg = body?.data?.message || body?.message || {};
    const conteudo = msg?.conversation || msg?.extendedTextMessage?.text || msg?.imageMessage?.caption || '[mídia]';

    if (fromMe) {
      if (process.env.DATABASE_URL) {
        const distribuicao = parseDistribuicao(conteudo);
        if (distribuicao) {
          // Distribuição feita pelo WhatsApp da Juliane — esse canal é usado pra repassar
          // leads patrocinados (Insta/Facebook), então assume 'Patrocinado' como origem padrão
          // quando a mensagem não disser outra origem explicitamente. Segue editável no dashboard.
          await salvarDistribuicao(distribuicao, 'Patrocinado');
          await enviarWhatsApp(JULIANE_LL, `📋 Nova distribuição de lead:\n\n${conteudo}`);
          console.log(`Distribuição espelhada pra Juliane: ${distribuicao.nome} → ${distribuicao.corretor}`);
        }
      }
      return res.status(200).json({ ok: true });
    }

    adicionarAoBuffer(de, conteudo);
    console.log(`Mensagem de ${de} adicionada ao buffer`);

    if (process.env.DATABASE_URL) {
      await identificarLead(de, conteudo);
    }

    res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Erro ao processar mensagem:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: WEBHOOK DO NÚMERO DO TIKTOK ───────────────────────
// Aponte o webhook da instância `diniz-tiktok` na Evolution API pra essa rota.
// Reaproveita o mesmo parser de distribuição — quando o número do TikTok manda
// a mensagem de distribuição pro corretor, o sistema já grava o lead com origem = 'TikTok'.
app.post('/webhook-mensagens-tiktok', async (req, res) => {
  try {
    const body = req.body;

    const fromMe = body?.data?.key?.fromMe || body?.key?.fromMe || false;
    const jid = body?.data?.key?.remoteJid || body?.key?.remoteJid || '';

    if (jid.includes('@g.us')) {
      console.log('[TikTok] Mensagem de grupo ignorada');
      return res.status(200).json({ ok: true });
    }

    const de = canonicalizarWhatsapp(jid.replace('@s.whatsapp.net', '').replace('@c.us', ''));
    const msg = body?.data?.message || body?.message || {};
    const conteudo = msg?.conversation || msg?.extendedTextMessage?.text || msg?.imageMessage?.caption || '[mídia]';

    if (fromMe) {
      if (process.env.DATABASE_URL) {
        const distribuicao = parseDistribuicao(conteudo);
        if (distribuicao) {
          // Origem já conhecida: veio pelo número do TikTok.
          // Se quiser diferenciar TikTok / Instagram / Comentário manualmente,
          // deixe origem = null aqui e ajuste depois pelo dashboard.
          await salvarDistribuicao(distribuicao, 'TikTok');
          await enviarWhatsApp(JULIANE_LL, `📋 Nova distribuição de lead (TikTok):\n\n${conteudo}`);
          console.log(`[TikTok] Distribuição espelhada pra Juliane: ${distribuicao.nome} → ${distribuicao.corretor}`);
        }
      }
      return res.status(200).json({ ok: true });
    }

    // Mensagem recebida de fora no número do TikTok — registra como lead automaticamente,
    // mesmo sem formato de distribuição (esse número não dispara aquela mensagem padrão)
    if (process.env.DATABASE_URL) {
      const pushName = body?.data?.pushName || body?.pushName || null;
      await registrarLeadAutomatico(de, pushName, conteudo, 'TikTok');
    }

    res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[TikTok] Erro ao processar mensagem:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── AUTENTICAÇÃO BÁSICA DO PAINEL ───────────────────────────
function basicAuth(req, res, next) {
  const user = process.env.DASHBOARD_USER || 'diniz';
  const pass = process.env.DASHBOARD_PASS;

  if (!pass) {
    console.warn('⚠️  DASHBOARD_PASS não configurada — painel está SEM proteção por senha.');
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Painel de Leads"');
    return res.status(401).send('Autenticação necessária');
  }

  const [u, p] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
  if (u === user && p === pass) return next();

  res.set('WWW-Authenticate', 'Basic realm="Painel de Leads"');
  return res.status(401).send('Credenciais inválidas');
}

// ─── ROTA: API DE LEADS (alimenta o dashboard) ───────────────
app.get('/api/leads', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const leadsResult = await pool.query(
      `SELECT id, whatsapp, nome, email, corretor, imovel_codigo, imovel_desc,
              distribuido_em, contatou, primeiro_contato_em,
              origem, interesse, status, ultimo_contato, aprovado, visita, proposta, venda,
              numero_invalido, whatsapp_bruto, outros_corretores
       FROM leads
       ORDER BY distribuido_em DESC
       LIMIT 1000`
    );

    const naoIdentResult = await pool.query(
      `SELECT id, whatsapp, mensagem, corretor, criado_em
       FROM leads_nao_identificados
       WHERE criado_em > now() - interval '7 days'
       ORDER BY criado_em DESC
       LIMIT 50`
    );

    const statsResult = await pool.query(`
      SELECT
        count(*) FILTER (WHERE distribuido_em > now() - interval '7 days') AS total_distribuidos,
        count(*) FILTER (WHERE distribuido_em > now() - interval '7 days' AND contatou) AS total_contataram,
        count(*) FILTER (WHERE distribuido_em > now() - interval '24 hours') AS distribuidos_24h,
        count(*) FILTER (WHERE distribuido_em > now() - interval '7 days' AND aprovado) AS total_aprovados,
        count(*) FILTER (WHERE distribuido_em > now() - interval '7 days' AND visita) AS total_visitas,
        count(*) FILTER (WHERE distribuido_em > now() - interval '7 days' AND venda) AS total_vendas,
        avg(primeiro_contato_em - distribuido_em)
          FILTER (WHERE contatou AND distribuido_em > now() - interval '7 days') AS tempo_medio_contato
      FROM leads
    `);

    const semCorretor24hResult = await pool.query(`
      SELECT count(*) AS total
      FROM leads_nao_identificados
      WHERE criado_em > now() - interval '24 hours'
    `);

    const porCorretorResult = await pool.query(`
      SELECT corretor, count(*) AS total
      FROM leads
      WHERE distribuido_em > now() - interval '7 days'
      GROUP BY corretor
      ORDER BY total DESC
    `);

    // Sem limite de tempo — usado nas abas de "Atividade por corretor", pra bater
    // com o total real (a lista principal de leads é limitada a 100 linhas, essa não)
    const porCorretorDetalhadoResult = await pool.query(`
      SELECT
        corretor,
        count(*) AS total,
        count(*) FILTER (WHERE contatou) AS contataram,
        count(*) FILTER (WHERE aprovado) AS aprovados,
        count(*) FILTER (WHERE visita) AS visitas,
        count(*) FILTER (WHERE proposta) AS propostas,
        count(*) FILTER (WHERE venda) AS vendas
      FROM leads
      WHERE corretor IS NOT NULL
      GROUP BY corretor
      ORDER BY total DESC
    `);

    const totalGeralResult = await pool.query(`
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE contatou) AS contataram,
        count(*) FILTER (WHERE aprovado) AS aprovados,
        count(*) FILTER (WHERE visita) AS visitas,
        count(*) FILTER (WHERE proposta) AS propostas,
        count(*) FILTER (WHERE venda) AS vendas,
        count(*) FILTER (WHERE numero_invalido) AS sem_numero_valido
      FROM leads
    `);

    const porCampanhaResult = await pool.query(`
      SELECT
        imovel_codigo,
        imovel_desc,
        count(*) AS total,
        count(*) FILTER (WHERE contatou) AS total_contataram
      FROM leads
      WHERE distribuido_em > now() - interval '7 days'
      GROUP BY imovel_codigo, imovel_desc
      ORDER BY total DESC
    `);
    const campanhasAgrupadas = agruparCampanhas(porCampanhaResult.rows);

    const porOrigemResult = await pool.query(`
      SELECT COALESCE(origem, 'Não informado') AS origem, count(*) AS total
      FROM leads
      WHERE distribuido_em > now() - interval '7 days'
      GROUP BY origem
      ORDER BY total DESC
    `);

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
          ? Math.round(statsResult.rows[0].tempo_medio_contato.hours * 3600
              + statsResult.rows[0].tempo_medio_contato.minutes * 60
              + (statsResult.rows[0].tempo_medio_contato.seconds || 0))
          : null,
      },
      porCorretor: porCorretorResult.rows,
      porCorretorDetalhado: porCorretorDetalhadoResult.rows.map(r => ({
        corretor: r.corretor,
        total: parseInt(r.total, 10) || 0,
        contataram: parseInt(r.contataram, 10) || 0,
        aprovados: parseInt(r.aprovados, 10) || 0,
        visitas: parseInt(r.visitas, 10) || 0,
        propostas: parseInt(r.propostas, 10) || 0,
        vendas: parseInt(r.vendas, 10) || 0,
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
      porCampanha: campanhasAgrupadas,
      porOrigem: porOrigemResult.rows,
      corretoresDisponiveis: [...CORRETORES.map(c => c.nome), ...CORRETORES_EXTRA_DASHBOARD],
    });
  } catch (err) {
    console.error('Erro ao buscar leads:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: IMPORTAR LEADS EM LOTE (via planilha enviada no dashboard) ─
// Body esperado: { leads: [{ nome, whatsapp, origem, corretor, imovelDesc }, ...] }
// Ignora silenciosamente quem já existe (mesmo WhatsApp) — não sobrescreve.
app.post('/api/leads/import', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  const { leads } = req.body;
  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ ok: false, erro: 'Nenhum lead recebido' });
  }

  const resultado = await importarLeadsEmLote(leads);
  console.log(`Importação manual: ${resultado.inseridos} inseridos, ${resultado.jaExistiam} já existiam, ${resultado.incompletos} incompletos`);
  res.json({ ok: true, ...resultado });
});

// ─── ROTA: SINCRONIZAR AGORA COM A PLANILHA DO GOOGLE ────────
app.post('/api/sincronizar-planilha', basicAuth, async (req, res) => {
  try {
    const resultado = await sincronizarPlanilhaGoogle();
    if (!resultado.ok) return res.status(400).json(resultado);
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao sincronizar planilha:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: ADICIONAR LEAD MANUALMENTE ────────────────────────
// Body esperado: { nome, whatsapp, origem, corretor, imovelDesc (opcional) }
app.post('/api/leads', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  const { nome, whatsapp, origem, corretor, imovelDesc } = req.body;

  if (!nome || !whatsapp || !corretor) {
    return res.status(400).json({ ok: false, erro: 'nome, whatsapp e corretor são obrigatórios' });
  }

  const whatsappValido = canonicalizarWhatsapp(whatsapp);
  const numeroInvalido = !whatsappValido;
  const whatsappNormalizado = whatsappValido || gerarPlaceholderSemNumero();

  try {
    const result = await pool.query(
      `INSERT INTO leads (whatsapp, nome, corretor, imovel_desc, origem, numero_invalido, whatsapp_bruto)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [whatsappNormalizado, nome, corretor, imovelDesc || null, origem || null, numeroInvalido, numeroInvalido ? whatsapp : null]
    );
    console.log(`Lead adicionado manualmente: ${nome} → ${corretor} (${whatsappNormalizado})${numeroInvalido ? ' [SEM NÚMERO VÁLIDO]' : ''}`);
    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, erro: 'Já existe um lead com esse WhatsApp' });
    }
    console.error('Erro ao adicionar lead manual:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: EDITAR QUALQUER CAMPO DE UM NÚMERO NÃO IDENTIFICADO ─
// Ao editar QUALQUER campo (Origem, Corretor, Status, Visita, Proposta, Venda),
// o contato "sobe de nível": vira um lead completo e some da lista de não identificados.
app.patch('/api/leads-nao-identificados/:id', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  const { id } = req.params;
  const { campo, valor } = req.body;

  if (!CAMPOS_EDITAVEIS.includes(campo)) {
    return res.status(400).json({ ok: false, erro: `Campo '${campo}' não é editável` });
  }

  try {
    const naoIdentResult = await pool.query('SELECT whatsapp, mensagem FROM leads_nao_identificados WHERE id = $1', [id]);
    if (naoIdentResult.rows.length === 0) {
      return res.status(404).json({ ok: false, erro: 'Não encontrado' });
    }
    const { whatsapp, mensagem } = naoIdentResult.rows[0];

    // Se o campo editado for o próprio 'nome', usa o valor digitado como nome
    // (em vez do placeholder 'Sem nome') e evita listar a coluna nome duas vezes.
    const nomeInicial = campo === 'nome' ? valor : 'Sem nome';
    const colunaExtra = campo === 'nome' ? null : campo;

    const colunas = ['whatsapp', 'nome', 'interesse'];
    const valores = [whatsapp, nomeInicial, mensagem || null];
    if (colunaExtra) {
      colunas.push(colunaExtra);
      valores.push(valor);
    }

    // Se não foi a origem que acabou de ser editada, tenta descobrir sozinho
    // (CRM na mensagem → OLX/Canal Pro; código de imóvel sem CRM → Patrocinado)
    let setClauseOrigem = '';
    if (campo !== 'origem') {
      const origemInferida = inferirOrigemDeTexto(mensagem);
      if (origemInferida) {
        colunas.push('origem');
        valores.push(origemInferida);
        setClauseOrigem = ', origem = COALESCE(leads.origem, EXCLUDED.origem)';
      }
    }

    const placeholders = valores.map((_, i) => `$${i + 1}`).join(', ');
    const setClause = (colunaExtra ? `${colunaExtra} = EXCLUDED.${colunaExtra}` : 'nome = EXCLUDED.nome') + setClauseOrigem;

    const insertResult = await pool.query(
      `INSERT INTO leads (${colunas.join(', ')})
       VALUES (${placeholders})
       ON CONFLICT (whatsapp) DO UPDATE SET ${setClause}
       RETURNING id`,
      valores
    );
    await pool.query('DELETE FROM leads_nao_identificados WHERE id = $1', [id]);

    console.log(`Contato promovido a lead: ${whatsapp} [${campo} = ${valor}]`);
    res.json({ ok: true, promovido: true, id: insertResult.rows[0].id });
  } catch (err) {
    console.error('Erro ao editar não identificado:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: INFERIR ORIGEM DOS LEADS PENDENTES (uso único/pontual) ─
// Passa por todo lead sem origem definida e tenta descobrir sozinho, olhando o
// código/nome do imóvel e a mensagem guardada (CRM → OLX/Canal Pro; código tipo
// VD01 sem CRM → Patrocinado). Não sobrescreve quem já tem origem definida.
app.post('/api/admin/inferir-origens-pendentes', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const pendentes = await pool.query(
      `SELECT id, imovel_codigo, imovel_desc, interesse FROM leads WHERE origem IS NULL`
    );

    let atualizados = 0;
    for (const lead of pendentes.rows) {
      const codigo = (lead.imovel_codigo || '').trim();
      let origemInferida;
      if (/^\d+$/.test(codigo)) {
        // Código só com números (ex: 111, 1046) — é o CRM do Canal Pro/OLX
        origemInferida = 'OLX/Canal Pro';
      } else {
        const textoBase = [lead.imovel_codigo, lead.imovel_desc, lead.interesse].filter(Boolean).join(' ');
        origemInferida = inferirOrigemDeTexto(textoBase);
      }
      if (origemInferida) {
        await pool.query('UPDATE leads SET origem = $1 WHERE id = $2', [origemInferida, lead.id]);
        atualizados++;
      }
    }

    console.log(`Inferência de origem em massa: ${atualizados} de ${pendentes.rows.length} pendentes atualizados`);
    res.json({ ok: true, atualizados, totalPendentes: pendentes.rows.length });
  } catch (err) {
    console.error('Erro ao inferir origens pendentes:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: MESCLAR DUPLICADOS DE FORMATO ANTIGO DO NÚMERO (uso único) ─
// Antes da normalização (9º dígito), a mesma pessoa podia ficar salva duas vezes,
// com o número em formatos ligeiramente diferentes. Agrupa por número já normalizado
// e mantém só o lead mais antigo de cada grupo, com o número no formato certo.
app.post('/api/admin/mesclar-duplicados-numero-formato', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const todos = await pool.query(
      `SELECT id, whatsapp, distribuido_em, corretor, outros_corretores FROM leads WHERE numero_invalido = false`
    );

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

      // Junta todos os corretores diferentes dos duplicados apagados, sem repetir
      const corretoresExtras = new Set(
        (sobrevivente.outros_corretores || '').split(',').map(s => s.trim()).filter(Boolean)
      );
      for (const l of restantes) {
        if (l.corretor && l.corretor !== sobrevivente.corretor) corretoresExtras.add(l.corretor);
        await pool.query('DELETE FROM leads WHERE id = $1', [l.id]);
        mesclados++;
      }
      const novosOutrosCorretores = corretoresExtras.size > 0 ? Array.from(corretoresExtras).join(', ') : null;

      if (sobrevivente.whatsapp !== chave || novosOutrosCorretores !== sobrevivente.outros_corretores) {
        await pool.query(
          'UPDATE leads SET whatsapp = $1, outros_corretores = $2 WHERE id = $3',
          [chave, novosOutrosCorretores, sobrevivente.id]
        );
      }
    }

    // Segunda passada: remove leads "sem número válido" (SEMNUM) que ficaram obsoletos
    // porque a mesma pessoa (mesmo nome) já tem um lead com número de verdade.
    const obsoletosResult = await pool.query(`
      DELETE FROM leads inv
      USING leads bom
      WHERE inv.numero_invalido = true
        AND bom.numero_invalido = false
        AND inv.nome = bom.nome
      RETURNING inv.id
    `);
    mesclados += obsoletosResult.rowCount;

    console.log(`Mesclagem de duplicados por formato: ${mesclados} removidos`);
    res.json({ ok: true, mesclados });
  } catch (err) {
    console.error('Erro ao mesclar duplicados por formato:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: CORRIGIR CORRETOR + DATA DOS 52 LEADS DO CANAL PRO (uso único) ─
// Dados fixos, já cruzados manualmente com as conversas do WhatsApp — corrige
// direto no banco, sem depender de nenhum upload de arquivo.
const DADOS_CORRIGIDOS_CANALPRO = [
  { whatsapp: '5511997771727', corretor: 'Laís', data: '26/08/2026 19:39' },
  { whatsapp: '5562993767420', corretor: 'Laís', data: '25/08/2026 12:40' },
  { whatsapp: '5541988481366', corretor: 'Laís', data: '24/08/2026 11:55' },
  { whatsapp: '5562992699641', corretor: 'Junior', data: '23/08/2026 21:45' },
  { whatsapp: '5562994442693', corretor: 'Nalcio', data: '22/08/2026 19:22' },
  { whatsapp: '5562992671240', corretor: 'Laís', data: '21/08/2026 12:55' },
  { whatsapp: '5562994084045', corretor: 'Nalcio', data: '20/08/2026 10:45' },
  { whatsapp: '5562994546023', corretor: 'Laís', data: '19/08/2026 14:32' },
  { whatsapp: '5562991071195', corretor: 'Renata', data: '19/08/2026 12:37' },
  { whatsapp: '5516988505505', corretor: 'Laís', data: '17/08/2026 23:17' },
  { whatsapp: '5562996448898', corretor: 'Renata', data: '17/08/2026 08:48' },
  { whatsapp: '5562991814817', corretor: 'Junior', data: '14/08/2026 07:35' },
  { whatsapp: '5562992295892', corretor: 'Nalcio', data: '14/08/2026 04:09' },
  { whatsapp: '5562982679938', corretor: 'Laís', data: '12/08/2026 22:25' },
  { whatsapp: '5562981224201', corretor: 'Junior', data: '10/08/2026 10:07' },
  { whatsapp: '5562992795220', corretor: 'Renata', data: '09/08/2026 16:17' },
  { whatsapp: '5562992402227', corretor: 'Nalcio', data: '08/08/2026 19:24' },
  { whatsapp: '5535383361855', corretor: 'Laís', data: '08/08/2026 17:41' },
  { whatsapp: '5562984111295', corretor: 'Nalcio', data: '08/08/2026 08:52' },
  { whatsapp: '5561984172632', corretor: 'Laís', data: '05/08/2026 16:02' },
  { whatsapp: '5511945655849', corretor: 'Nalcio', data: '05/08/2026 10:43' },
  { whatsapp: '5562996973237', corretor: 'Laís', data: '04/08/2026 16:02' },
  { whatsapp: '5562994069875', corretor: 'Nalcio', data: '04/08/2026 06:28' },
  { whatsapp: '5562992638241', corretor: 'Nalcio', data: '02/08/2026 21:48' },
  { whatsapp: '5564996432984', corretor: 'Nalcio', data: '02/08/2026 16:53' },
  { whatsapp: '5562991481170', corretor: 'Laís', data: '31/07/2026 19:01' },
  { whatsapp: '5562994891474', corretor: 'Nalcio', data: '29/07/2026 12:01' },
  { whatsapp: '5562982249292', corretor: 'Laís', data: '27/07/2026 15:40' },
  { whatsapp: '5562991681084', corretor: 'Renata', data: '27/07/2026 13:57' },
  { whatsapp: '5562991876319', corretor: 'Nalcio', data: '25/07/2026 08:10' },
  { whatsapp: '5563999167720', corretor: 'Nalcio', data: '23/07/2026 08:01' },
  { whatsapp: '5562995393451', corretor: 'Renata', data: '21/07/2026 11:54' },
  { whatsapp: '5562992296303', corretor: 'Nalcio', data: '20/07/2026 09:22' },
  { whatsapp: '5562981007075', corretor: 'Nalcio', data: '16/07/2026 19:35' },
  { whatsapp: '5562991754544', corretor: 'Laís', data: '16/07/2026 19:14' },
  { whatsapp: '5562985993485', corretor: 'Renata', data: '15/07/2026 13:34' },
  { whatsapp: '5511951268877', corretor: 'Nalcio', data: '14/07/2026 12:09' },
  { whatsapp: '5562993908306', corretor: 'Laís', data: '12/07/2026 06:57' },
  { whatsapp: '5562992118453', corretor: 'Nalcio', data: '12/07/2026 00:14' },
  { whatsapp: '5562991075395', corretor: 'Laís', data: '11/07/2026 12:38' },
  { whatsapp: '5562991724840', corretor: 'Nalcio', data: '10/07/2026 18:30' },
  { whatsapp: '5562993456060', corretor: 'Nalcio', data: '09/07/2026 14:20' },
  { whatsapp: '5562992474585', corretor: 'Nalcio', data: '09/07/2026 00:03' },
  { whatsapp: '5562994933970', corretor: 'Laís', data: '07/07/2026 18:09' },
  { whatsapp: '5562993580158', corretor: 'Laís', data: '02/07/2026 09:46' },
  { whatsapp: '5562998368040', corretor: 'Nalcio', data: '01/07/2026 12:44' },
  { whatsapp: '5562994057532', corretor: 'Laís', data: '01/07/2026 04:55' },
  { whatsapp: '5562995675744', corretor: 'Nalcio', data: '30/06/2026 10:00' },
  { whatsapp: '5562981502498', corretor: 'Laís', data: '30/06/2026 02:12' },
  { whatsapp: '5562994679355', corretor: 'Nalcio', data: '29/06/2026 11:41' },
  { whatsapp: '5511982795830', corretor: 'Laís', data: '28/06/2026 21:32' },
  { whatsapp: '5562996986440', corretor: 'Laís', data: '23/06/2026 19:44' },
];

app.post('/api/admin/corrigir-canalpro-fixo', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    let corrigidos = 0;
    let naoEncontrados = 0;

    for (const item of DADOS_CORRIGIDOS_CANALPRO) {
      const dataParseada = parseDataChegada(item.data);
      const result = await pool.query(
        `UPDATE leads SET corretor = $1, distribuido_em = $2 WHERE whatsapp = $3 RETURNING id`,
        [item.corretor, dataParseada, item.whatsapp]
      );
      if (result.rowCount > 0) corrigidos++;
      else naoEncontrados++;
    }

    console.log(`Correção fixa Canal Pro: ${corrigidos} corrigidos, ${naoEncontrados} não encontrados`);
    res.json({ ok: true, corrigidos, naoEncontrados, total: DADOS_CORRIGIDOS_CANALPRO.length });
  } catch (err) {
    console.error('Erro ao corrigir Canal Pro:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: LIMPAR DUPLICADOS SEM NÚMERO VÁLIDO (uso único) ───
// Remove duplicatas geradas pelo bug do identificador aleatório (antes da correção):
// mantém só o lead mais antigo de cada grupo com mesmo nome entre os "sem número válido".
app.post('/api/admin/limpar-duplicados-sem-numero', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const result = await pool.query(`
      DELETE FROM leads a
      USING leads b
      WHERE a.numero_invalido = true
        AND b.numero_invalido = true
        AND a.nome = b.nome
        AND COALESCE(a.email, '') = COALESCE(b.email, '')
        AND a.id > b.id
      RETURNING a.id
    `);
    console.log(`Limpeza de duplicados sem número: ${result.rowCount} removidos`);
    res.json({ ok: true, removidos: result.rowCount });
  } catch (err) {
    console.error('Erro ao limpar duplicados:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: CORRIGIR NÚMERO DE WHATSAPP INVÁLIDO ──────────────
// Única forma de editar o WhatsApp de um lead — só serve pra leads marcados
// como numero_invalido (que nunca tiveram um número real salvo).
app.patch('/api/leads/:id/corrigir-whatsapp', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  const { id } = req.params;
  const { whatsapp } = req.body;

  const whatsappValido = canonicalizarWhatsapp(whatsapp);
  if (!whatsappValido) {
    return res.status(400).json({ ok: false, erro: 'Esse número não parece válido. Confere o DDD e os dígitos.' });
  }

  try {
    const leadResult = await pool.query('SELECT numero_invalido FROM leads WHERE id = $1', [id]);
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ ok: false, erro: 'Lead não encontrado' });
    }
    if (!leadResult.rows[0].numero_invalido) {
      return res.status(400).json({ ok: false, erro: 'Esse lead já tem um WhatsApp válido — não dá pra editar por aqui.' });
    }

    await pool.query(
      `UPDATE leads SET whatsapp = $1, numero_invalido = false, whatsapp_bruto = NULL WHERE id = $2`,
      [whatsappValido, id]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, erro: 'Já existe outro lead com esse WhatsApp — pode ser a mesma pessoa duplicada.' });
    }
    console.error('Erro ao corrigir WhatsApp:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: EDITAR CAMPOS MANUAIS DO FUNIL ────────────────────
// Body esperado: { campo: 'origem', valor: 'TikTok' }
// campo precisa estar em CAMPOS_EDITAVEIS.
app.patch('/api/leads/:id', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  const { id } = req.params;
  const { campo, valor } = req.body;

  if (!CAMPOS_EDITAVEIS.includes(campo)) {
    return res.status(400).json({ ok: false, erro: `Campo '${campo}' não é editável` });
  }

  try {
    await pool.query(
      `UPDATE leads SET ${campo} = $1 WHERE id = $2`,
      [valor, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao editar lead:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: DASHBOARD ──────────────────────────────────────────
app.get('/dashboard', basicAuth, (req, res) => {
  res.send(DASHBOARD_HTML);
});

// ─── ROTA DE TESTE ───────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('✅ Diniz Leads OLX rodando!');
});

// ─── INICIA SERVIDOR ─────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  await initDb();

  // Sincronização automática com a planilha do Google, a cada 10 minutos
  // (só ativa se GOOGLE_SHEET_ID e GOOGLE_SERVICE_ACCOUNT_KEY estiverem configuradas)
  if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const INTERVALO_SYNC_MS = 10 * 60 * 1000;
    console.log('✅ Sincronização automática com Google Sheets ativada (a cada 10 min)');
    sincronizarPlanilhaGoogle().catch(err => console.error('Erro na sincronização inicial:', err));
    setInterval(() => {
      sincronizarPlanilhaGoogle().catch(err => console.error('Erro na sincronização automática:', err));
    }, INTERVALO_SYNC_MS);
  } else {
    console.warn('⚠️  Sincronização com Google Sheets desativada — configure GOOGLE_SHEET_ID e GOOGLE_SERVICE_ACCOUNT_KEY pra ativar.');
  }
});
