const express = require('express');
const fs = require('fs');
const { Readable } = require('stream');
const { Pool } = require('pg');
const { google } = require('googleapis');
const { DASHBOARD_HTML } = require('./dashboard-template');
const { CRM_HTML } = require('./crm-template');
const { JULIANE_HTML } = require('./juliane-template');
const { CORRETOR_HTML } = require('./corretor-template');
const { ANALYTICS_HTML } = require('./analytics-template');
const app = express();
app.use(express.json());

// ─── OAUTH DO GOOGLE DRIVE (conta pessoal, não a de serviço) ─
// Contas de serviço não têm espaço de armazenamento no Drive pessoal — por
// isso o backup no Drive usa OAuth normal (a mesma conta de Bruno), guardando
// só o refresh_token (permanente) numa tabela do Postgres depois da autorização.
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

// Número de supervisão: pra onde vão os avisos de controle (resumo, distribuição,
// lead identificado, etc). A ideia é apontar pro número NOVO conectado na
// instância `diniz-leads-olx` (o que vai substituir o 556284277070) — assim
// Juliane acompanha direto nesse WhatsApp, em vez de receber num número separado.
// IMPORTANTE: defina NUMERO_SUPERVISAO no Railway com o número novo (formato
// 55DDDNUMERO, só dígitos) assim que ele estiver conectado. Até lá, cai no
// número pessoal da Juliane (JULIANE_LL) pra não ficar sem aviso nenhum.
const NUMERO_SUPERVISAO = process.env.NUMERO_SUPERVISAO || JULIANE_LL;

// A partir de 23/09/2026: só a Laís recebe leads da distribuição
// automática (decisão do Bruno). Os outros ficam comentados aqui — é só
// descomentar quando quiser voltar o rodízio entre eles.
const CORRETORES = [
  { nome: 'Laís',   fone: '5562992754858' },
  // { nome: 'Nalcio', fone: '5562982077466' },
  // { nome: 'Renata', fone: '5562992670935' },
  // { nome: 'Junior', fone: '5562981625610' },
  // { nome: 'Thayná', fone: '5562991749547' },
];

// Nomes extras que aparecem como opção no dropdown de corretor do dashboard,
// mas NÃO entram na fila de distribuição automática (round-robin) do Canal Pro
// — pra isso precisaria do telefone de cada um, cadastrado em CORRETORES acima.
const CORRETORES_EXTRA_DASHBOARD = ['Amanda', 'Juliane', 'Bruno', 'Patricia', 'Michelle', 'Cyda'];

// Unifica variações do mesmo nome (com/sem acento, maiúscula/minúscula) —
// ex: "Lais" e "Laís" contam como a mesma pessoa. Sempre devolve a grafia
// oficial (a que está em CORRETORES/CORRETORES_EXTRA_DASHBOARD); nomes que
// não batem com ninguém conhecido voltam do jeito que vieram (apenas
// arrumados de espaço), pra não travar cadastro de gente nova.
const NOMES_OFICIAIS_CORRETORES = [...CORRETORES.map(c => c.nome), ...CORRETORES_EXTRA_DASHBOARD];
function normalizarNomeCorretor(nomeDigitado) {
  if (!nomeDigitado) return nomeDigitado;
  const chave = String(nomeDigitado).trim();
  if (!chave) return chave;
  const semAcento = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const alvo = semAcento(chave);
  const oficial = NOMES_OFICIAIS_CORRETORES.find(nome => semAcento(nome) === alvo);
  return oficial || chave;
}

// ─── BANCO DE DADOS (leads distribuídos por texto) ───────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

const THROTTLE_AVISO_MS = 6 * 60 * 60 * 1000; // 6 horas

// Campos do funil que podem ser editados manualmente pelo dashboard
const CAMPOS_EDITAVEIS = ['nome', 'origem', 'corretor', 'interesse', 'status', 'aprovado', 'visita', 'proposta', 'venda', 'imovel_desc', 'sem_retorno', 'em_andamento', 'notas_sdr', 'carteira_sdr', 'tarefa_sdr', 'tarefa_data', 'corretores_repassados', 'ultima_atualizacao_sdr', 'valor_imovel_sdr', 'carteira_juliane', 'buscando_sdr', 'documentacao', 'status_corretor', 'tipo_lead', 'cliente_ouro'];

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
      ADD COLUMN IF NOT EXISTS outros_corretores TEXT,
      ADD COLUMN IF NOT EXISTS sem_retorno BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS em_andamento BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS notas_sdr TEXT,
      ADD COLUMN IF NOT EXISTS reaquecido_em TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS carteira_sdr BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS tarefa_sdr TEXT,
      ADD COLUMN IF NOT EXISTS corretores_repassados TEXT,
      ADD COLUMN IF NOT EXISTS status_alterado_em TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS ultima_atualizacao_sdr DATE,
      ADD COLUMN IF NOT EXISTS valor_imovel_sdr TEXT,
      ADD COLUMN IF NOT EXISTS carteira_juliane BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS tarefa_data TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS buscando_sdr TEXT,
      ADD COLUMN IF NOT EXISTS documentacao BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS status_corretor TEXT DEFAULT 'Novo',
      ADD COLUMN IF NOT EXISTS status_corretor_alterado_em TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS tipo_lead TEXT DEFAULT 'Imobiliária',
      ADD COLUMN IF NOT EXISTS cliente_ouro BOOLEAN DEFAULT false;
  `);

  // ─── Tabela de backups automáticos (dump diário de todos os leads) ─
  await pool.query(`
    CREATE TABLE IF NOT EXISTS backups_leads (
      id SERIAL PRIMARY KEY,
      criado_em TIMESTAMPTZ DEFAULT now(),
      total_leads INTEGER,
      dados JSONB
    );
  `);

  // ─── Configurações simples (guarda o refresh_token do Drive, entre outras) ─
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

  // ─── Correção pontual: reseta "Reaquecido" que foi marcado incorretamente
  // pela correção automática antiga (que "adivinhava" o corretor pelo
  // histórico, em vez de esperar a SDR confirmar de verdade). Roda UMA VEZ
  // só de verdade (marca um flag em config_sistema), pra não apagar
  // confirmações reais que a SDR fizer depois, em reinícios futuros.
  try {
    const jaAplicado = await lerConfig('reset_reaquecido_indevido_aplicado');
    if (!jaAplicado) {
      const resetados = await pool.query(`
        UPDATE leads SET status_corretor = 'Novo' WHERE status_corretor = 'Reaquecido' RETURNING id
      `);
      if (resetados.rowCount > 0) {
        console.log(`✅ Reset de "Reaquecido" indevido: ${resetados.rowCount} lead(s) voltaram pra "Novo" — só vira Reaquecido quando a SDR confirmar o corretor de verdade`);
      }
      await salvarConfig('reset_reaquecido_indevido_aplicado', 'true');
    }
  } catch (err) {
    console.error('Erro ao resetar status_corretor indevido:', err);
  }

  // ─── Correção automática de nomes de corretor com/sem acento ──────────
  // Unifica variações já salvas no banco (ex: "Lais" e "Laís" viram a mesma
  // pessoa) — roda a cada boot, mas só muda linha que realmente precisa.
  try {
    for (const nomeOficial of NOMES_OFICIAIS_CORRETORES) {
      const corrigidosCorretor = await pool.query(
        `UPDATE leads
         SET corretor = $1
         WHERE corretor IS NOT NULL
           AND corretor <> $1
           AND lower(translate(corretor, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
             = lower(translate($1, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
         RETURNING id`,
        [nomeOficial]
      );
      if (corrigidosCorretor.rowCount > 0) {
        console.log(`✅ Correção de nome de corretor: ${corrigidosCorretor.rowCount} lead(s) unificados para "${nomeOficial}"`);
      }
    }
  } catch (err) {
    console.error('Erro na correção de nomes de corretor:', err);
  }

  // ─── Correção automática de origens antigas mal classificadas ─────────
  // Leads que ficaram marcados como 'OLX/Canal Pro' antes da inferência existir,
  // mas que na verdade têm código de imóvel (tipo VD01) e nenhuma evidência de CRM
  // — esses são Patrocinado de verdade. Roda em todo início, mas é seguro repetir:
  // uma vez corrigido, o lead deixa de bater no WHERE e não é tocado de novo.
  // Nunca mexe em TikTok nem em origem explícita, porque o WHERE só pega quem já
  // está marcado como OLX/Canal Pro especificamente.
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
      console.log(`✅ Correção automática de origem: ${corrigidos.rowCount} lead(s) que estavam como 'OLX/Canal Pro' com código de imóvel (sem CRM) foram corrigidos para 'Patrocinado'.`);
    }
  } catch (err) {
    console.error('Erro na correção automática de origens antigas:', err);
  }

  // Leads importados direto do export da OLX vêm com o canal de contato INTERNO da OLX
  // ("Telefone", "Chat OLX", "Formulário", "WhatsApp") no campo Origem — isso não é uma
  // categoria nossa, é só como o cliente contatou dentro da OLX. Todos esses são, na
  // prática, leads do OLX/Canal Pro, então padroniza pra isso.
  try {
    const corrigidosCanal = await pool.query(`
      UPDATE leads
      SET origem = 'OLX/Canal Pro'
      WHERE origem IN ('Telefone', 'Chat OLX', 'Formulário', 'WhatsApp')
      RETURNING id
    `);
    if (corrigidosCanal.rowCount > 0) {
      console.log(`✅ Correção automática de origem: ${corrigidosCanal.rowCount} lead(s) com canal interno da OLX (Telefone/Chat OLX/Formulário/WhatsApp) foram corrigidos para 'OLX/Canal Pro'.`);
    }
  } catch (err) {
    console.error('Erro na correção de canais internos da OLX:', err);
  }

  // Alguns leads ficaram com a palavra literal "null" salva como origem (provavelmente
  // uma célula vazia da planilha exportada). Isso não é uma origem real — limpa pra
  // ficar sem origem mesmo, como qualquer outro pendente.
  try {
    const corrigidosNull = await pool.query(`
      UPDATE leads SET origem = NULL WHERE origem = 'null' RETURNING id
    `);
    if (corrigidosNull.rowCount > 0) {
      console.log(`✅ Correção automática de origem: ${corrigidosNull.rowCount} lead(s) com origem literal "null" foram limpos (ficam sem origem).`);
    }
  } catch (err) {
    console.error('Erro na correção da origem literal "null":', err);
  }

  // ─── Correção automática: preenche origem em branco usando o texto do
  // imóvel/interesse — mesma lógica de inferirOrigemDeTexto(), só que
  // aplicada nos leads que já estão no banco (ex: vieram da planilha sem
  // a coluna Origem preenchida). Só mexe em quem está com origem vazia,
  // então é seguro rodar de novo — quem já foi preenchido não é tocado.
  try {
    const inferidosCanalPro = await pool.query(`
      UPDATE leads
      SET origem = 'OLX/Canal Pro'
      WHERE origem IS NULL
        AND (COALESCE(interesse, '') ~* '\\yCRM\\y' OR COALESCE(imovel_codigo, '') ~* '\\yCRM\\y' OR COALESCE(imovel_desc, '') ~* '\\yCRM\\y')
      RETURNING id
    `);
    if (inferidosCanalPro.rowCount > 0) {
      console.log(`✅ Origem inferida pelo texto: ${inferidosCanalPro.rowCount} lead(s) sem origem, com "CRM" no texto, marcados como 'OLX/Canal Pro'.`);
    }
    const inferidosPatrocinado = await pool.query(`
      UPDATE leads
      SET origem = 'Patrocinado'
      WHERE origem IS NULL
        AND (imovel_codigo ~* '[A-Z]{2}[0-9]{2,}' OR imovel_desc ~* '[A-Z]{2}[0-9]{2,}')
      RETURNING id
    `);
    if (inferidosPatrocinado.rowCount > 0) {
      console.log(`✅ Origem inferida pelo texto: ${inferidosPatrocinado.rowCount} lead(s) sem origem, com código de imóvel no texto, marcados como 'Patrocinado'.`);
    }
  } catch (err) {
    console.error('Erro ao inferir origem de leads em branco:', err);
  }
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

    // Origem: usa a que a planilha já trouxer; se não trouxer, tenta inferir pelo
    // código/nome do imóvel (CRM → OLX/Canal Pro; código tipo VD01 → Patrocinado);
    // se não tiver nenhuma evidência, fica sem origem (nada de forçar um padrão).
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

// ─── SINCRONIZAÇÃO AUTOMÁTICA COM GOOGLE SHEETS ──────────────
let googleAuthCache = null;
let sheetsClientCache = null;

// Autenticação da conta de serviço — usada só pra ler a planilha (Sheets).
// O backup no Drive usa outra autenticação (OAuth pessoal), veja mais abaixo.
async function getGoogleAuth() {
  if (googleAuthCache) return googleAuthCache;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return null;

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
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

async function lerIndice() {
  const valor = await lerConfig('indice_rodizio_corretores');
  return valor ? parseInt(valor, 10) || 0 : 0;
}

async function salvarIndice(index) {
  await salvarConfig('indice_rodizio_corretores', String(index));
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

  await enviarWhatsApp(NUMERO_SUPERVISAO, texto);
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

// ─── BACKUP AUTOMÁTICO DIÁRIO ─────────────────────────────────
// Guarda um dump completo da tabela leads dentro do próprio Postgres
// (persistente — diferente do /tmp, que é apagado a cada deploy/restart).
// Mantém só os últimos 30 backups; os mais antigos são apagados sozinhos.
// Também sobe uma cópia pro Google Drive, se estiver configurado.
async function fazerBackupDiario() {
  if (!process.env.DATABASE_URL) return { ok: false, erro: 'DATABASE_URL não configurada' };
  try {
    const leadsResult = await pool.query('SELECT * FROM leads ORDER BY id');

    // Um backup por dia só: se já existe um de hoje (deploys/restarts repetidos
    // no mesmo dia não devem multiplicar), atualiza esse em vez de criar outro.
    const existenteHoje = await pool.query(
      `SELECT id FROM backups_leads WHERE criado_em::date = now()::date ORDER BY criado_em DESC LIMIT 1`
    );
    if (existenteHoje.rows.length > 0) {
      await pool.query(
        `UPDATE backups_leads SET criado_em = now(), total_leads = $1, dados = $2 WHERE id = $3`,
        [leadsResult.rows.length, JSON.stringify(leadsResult.rows), existenteHoje.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO backups_leads (total_leads, dados) VALUES ($1, $2)`,
        [leadsResult.rows.length, JSON.stringify(leadsResult.rows)]
      );
    }

    // Limpeza: mantém só 1 backup por dia (some qualquer duplicado antigo que
    // já tenha se acumulado) e no total só os últimos 30 dias.
    await pool.query(`
      DELETE FROM backups_leads
      WHERE id NOT IN (
        SELECT DISTINCT ON (criado_em::date) id
        FROM backups_leads
        ORDER BY criado_em::date, criado_em DESC
      )
    `);
    await pool.query(`
      DELETE FROM backups_leads
      WHERE id NOT IN (SELECT id FROM backups_leads ORDER BY criado_em DESC LIMIT 30)
    `);
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
    `INSERT INTO config_sistema (chave, valor) VALUES ($1, $2)
     ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
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

// Calcula a "semana ISO" de uma data, no formato AAAA-Wnn — usada pra
// agrupar os backups do Drive e saber quais já são de semanas passadas.
function semanaISO(data) {
  const d = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d - inicioAno) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

// Limpa os backups antigos do Drive: mantém TODOS os da semana atual (um por
// dia, pra recuperação rápida), mas de semanas anteriores mantém só 1 — o
// mais recente daquela semana. Semanas mais velhas vão ficando com só 1 arquivo.
async function limparBackupsAntigosNoDrive() {
  const drive = await getDriveClientOAuth();
  if (!drive || !process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID) return;
  try {
    const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
    const listaResult = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 1000,
    });
    const arquivos = listaResult.data.files || [];
    const hojeStr = new Date().toISOString().slice(0, 10);

    let removidos = 0;

    // Passo 1: nunca mais que 1 arquivo por DIA (isso limpa os duplicados que
    // já se acumularam de deploys repetidos no mesmo dia — pelo nome do
    // arquivo, que é sempre backup-leads-AAAA-MM-DD.json).
    const gruposPorDia = new Map();
    for (const arq of arquivos) {
      const diaChave = arq.name || new Date(arq.createdTime).toISOString().slice(0, 10);
      if (!gruposPorDia.has(diaChave)) gruposPorDia.set(diaChave, []);
      gruposPorDia.get(diaChave).push(arq);
    }
    const sobreviventes = [];
    for (const [, arqs] of gruposPorDia) {
      arqs.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
      sobreviventes.push(arqs[0]);
      for (const arq of arqs.slice(1)) {
        await drive.files.delete({ fileId: arq.id });
        removidos++;
      }
    }

    // Passo 2: de semanas passadas (não a atual), mantém só 1 arquivo no total.
    const semanaAtual = semanaISO(new Date());
    const gruposPorSemana = new Map();
    for (const arq of sobreviventes) {
      const semana = semanaISO(new Date(arq.createdTime));
      if (!gruposPorSemana.has(semana)) gruposPorSemana.set(semana, []);
      gruposPorSemana.get(semana).push(arq);
    }
    for (const [semana, arqs] of gruposPorSemana) {
      if (semana === semanaAtual) continue; // semana atual: mantém todos os diários
      arqs.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
      for (const arq of arqs.slice(1)) {
        await drive.files.delete({ fileId: arq.id });
        removidos++;
      }
    }

    if (removidos > 0) {
      console.log(`✅ Limpeza de backups no Drive: ${removidos} arquivo(s) removido(s) (1 por dia, e 1 por semana passada)`);
    }
  } catch (err) {
    console.error('Erro ao limpar backups antigos no Drive:', err.message);
  }
}

// Sobe o JSON do backup pro Drive PESSOAL de Bruno (via OAuth, não conta de
// serviço — contas de serviço não têm espaço próprio no Drive). Precisa que
// /api/admin/drive-auth já tenha sido autorizado uma vez.
async function salvarBackupNoDrive(dados, nomeArquivo) {
  const drive = await getDriveClientOAuth();
  if (!drive) {
    const msg = 'Drive ainda não autorizado — acesse /api/admin/drive-auth pra autorizar uma vez';
    console.warn(`⚠️  ${msg}`);
    return { ok: false, erro: msg };
  }
  try {
    const media = {
      mimeType: 'application/json',
      body: Readable.from(JSON.stringify(dados, null, 2)),
    };

    // Um arquivo por dia só: se já existe um com esse nome (ex: deploys
    // repetidos no mesmo dia), atualiza o conteúdo dele em vez de criar outro.
    const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
    const buscaQuery = folderId
      ? `name = '${nomeArquivo}' and '${folderId}' in parents and trashed = false`
      : `name = '${nomeArquivo}' and trashed = false`;
    const existente = await drive.files.list({ q: buscaQuery, fields: 'files(id)', pageSize: 1 });

    if (existente.data.files && existente.data.files.length > 0) {
      await drive.files.update({ fileId: existente.data.files[0].id, media });
      console.log(`✅ Backup do dia atualizado no Google Drive: ${nomeArquivo}`);
    } else {
      const requestBody = { name: nomeArquivo };
      if (folderId) requestBody.parents = [folderId];
      await drive.files.create({ requestBody, media });
      console.log(`✅ Backup também salvo no Google Drive: ${nomeArquivo}`);
    }

    await limparBackupsAntigosNoDrive();
    return { ok: true };
  } catch (err) {
    const detalhe = err?.errors?.[0]?.message || err.message;
    console.error('Erro ao salvar backup no Google Drive:', detalhe);
    return { ok: false, erro: detalhe };
  }

}


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
      await enviarWhatsApp(NUMERO_SUPERVISAO, texto);
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
    await enviarWhatsApp(NUMERO_SUPERVISAO, texto);
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

    const indexAtual = await lerIndice();
    const corretor = CORRETORES[indexAtual % CORRETORES.length];
    await salvarIndice((indexAtual + 1) % CORRETORES.length);

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

    await enviarWhatsApp(NUMERO_SUPERVISAO, textoControle);

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
          // Distribuição feita pelo WhatsApp da Juliane. A origem já vem de dentro de
          // parseDistribuicao (explícita, ou inferida por CRM/código de imóvel). Se não
          // tiver nenhuma evidência, fica sem origem — não força mais 'Patrocinado' aqui.
          await salvarDistribuicao(distribuicao, null);
          await enviarWhatsApp(NUMERO_SUPERVISAO, `📋 Nova distribuição de lead:\n\n${conteudo}`);
          console.log(`Distribuição espelhada: ${distribuicao.nome} → ${distribuicao.corretor}`);
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
          await enviarWhatsApp(NUMERO_SUPERVISAO, `📋 Nova distribuição de lead (TikTok):\n\n${conteudo}`);
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

// ─── AUTENTICAÇÃO BÁSICA DO PAINEL (admin — dashboard completo) ─
function basicAuth(req, res, next) {
  const user = process.env.DASHBOARD_USER || 'diniz';
  const pass = process.env.DASHBOARD_PASS;

  if (!pass) {
    console.warn('⚠️  DASHBOARD_PASS não configurada — painel está SEM proteção por senha.');
    req.authTipo = 'admin';
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Painel de Leads"');
    return res.status(401).send('Autenticação necessária');
  }

  const [u, p] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
  if (u === user && p === pass) {
    req.authTipo = 'admin';
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="Painel de Leads"');
  return res.status(401).send('Credenciais inválidas');
}

// ─── AUTENTICAÇÃO BÁSICA — admin OU SDR (usada nas rotas que o /crm chama) ─
// Login separado pra SDR (CRM_USER/CRM_PASS), com acesso só ao /crm e à API
// de leads — sem as rotas administrativas (/dashboard, importação, correções).
// Usa o MESMO realm do basicAuth admin de propósito: assim, quando o admin já
// autenticou no /dashboard, o navegador reaproveita a credencial cacheada nas
// chamadas de API, sem pedir senha de novo.
function basicAuthAdminOuSdr(req, res, next) {
  const adminUser = process.env.DASHBOARD_USER || 'diniz';
  const adminPass = process.env.DASHBOARD_PASS;
  const sdrUser = process.env.CRM_USER || 'sdr';
  const sdrPass = process.env.CRM_PASS;
  const julianeUser = process.env.JULIANE_CRM_USER || 'juliane';
  const julianePass = process.env.JULIANE_CRM_PASS;

  // Login individual de cada corretor — preparado pra crescer, começando só
  // com o Junior. Pra adicionar outro depois, é só criar as duas variáveis
  // de ambiente (ex: CORRETOR_LAIS_USER/CORRETOR_LAIS_PASS) e uma linha aqui.
  const LOGINS_CORRETORES = {
    junior: { user: process.env.CORRETOR_JUNIOR_USER || 'junior', pass: process.env.CORRETOR_JUNIOR_PASS, nome: 'Junior' },
    michelle: { user: process.env.CORRETOR_MICHELLE_USER || 'michelle', pass: process.env.CORRETOR_MICHELLE_PASS, nome: 'Michelle' },
    lais: { user: process.env.CORRETOR_LAIS_USER || 'lais', pass: process.env.CORRETOR_LAIS_PASS, nome: 'Laís' },
    patricia: { user: process.env.CORRETOR_PATRICIA_USER || 'patricia', pass: process.env.CORRETOR_PATRICIA_PASS, nome: 'Patricia' },
    nalcio: { user: process.env.CORRETOR_NALCIO_USER || 'nalcio', pass: process.env.CORRETOR_NALCIO_PASS, nome: 'Nalcio' },
    renata: { user: process.env.CORRETOR_RENATA_USER || 'renata', pass: process.env.CORRETOR_RENATA_PASS, nome: 'Renata' },
    bruno: { user: process.env.CORRETOR_BRUNO_USER || 'bruno.corretor', pass: process.env.CORRETOR_BRUNO_PASS, nome: 'Bruno' },
    juliane: { user: process.env.CORRETOR_JULIANE_USER || 'juliane.corretor', pass: process.env.CORRETOR_JULIANE_PASS, nome: 'Juliane' },
    amanda: { user: process.env.CORRETOR_AMANDA_USER || 'amanda', pass: process.env.CORRETOR_AMANDA_PASS, nome: 'Amanda' },
    cyda: { user: process.env.CORRETOR_CYDA_USER || 'cyda', pass: process.env.CORRETOR_CYDA_PASS, nome: 'Cyda' },
  };

  const algumaSenhaConfigurada = adminPass || sdrPass || julianePass ||
    Object.values(LOGINS_CORRETORES).some(c => c.pass);
  if (!algumaSenhaConfigurada) {
    console.warn('⚠️  Nenhuma senha configurada — CRM está SEM proteção por senha.');
    req.authTipo = 'admin';
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Painel de Leads"');
    return res.status(401).send('Autenticação necessária');
  }

  const [u, p] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
  if (adminPass && u === adminUser && p === adminPass) {
    req.authTipo = 'admin';
    return next();
  }
  if (sdrPass && u === sdrUser && p === sdrPass) {
    req.authTipo = 'sdr';
    return next();
  }
  if (julianePass && u === julianeUser && p === julianePass) {
    req.authTipo = 'juliane';
    return next();
  }
  for (const chave of Object.keys(LOGINS_CORRETORES)) {
    const login = LOGINS_CORRETORES[chave];
    if (login.pass && u === login.user && p === login.pass) {
      req.authTipo = 'corretor';
      req.corretorNome = login.nome;
      return next();
    }
  }

  res.set('WWW-Authenticate', 'Basic realm="Painel de Leads"');
  return res.status(401).send('Credenciais inválidas');
}

// Campos que o corretor pode editar no próprio Kanban — nada de reatribuir
// corretor, nem mexer em carteiras, nem em campos administrativos.
const CAMPOS_EDITAVEIS_CORRETOR = ['status_corretor', 'notas_sdr', 'tarefa_sdr', 'tarefa_data', 'ultima_atualizacao_sdr', 'valor_imovel_sdr', 'buscando_sdr', 'tipo_lead', 'cliente_ouro'];

// Campos que a SDR pode editar pelo CRM — o resto (aprovado, visita, proposta,
// venda, corretor, origem etc.) continua só pra quem loga como admin.
const CAMPOS_EDITAVEIS_SDR = ['status', 'notas_sdr', 'carteira_sdr', 'tarefa_sdr', 'tarefa_data', 'corretores_repassados', 'ultima_atualizacao_sdr', 'valor_imovel_sdr', 'buscando_sdr', 'aprovado', 'visita', 'proposta', 'documentacao', 'venda', 'corretor', 'cliente_ouro'];
const CAMPOS_EDITAVEIS_JULIANE = ['status', 'notas_sdr', 'carteira_juliane', 'tarefa_sdr', 'tarefa_data', 'corretores_repassados', 'ultima_atualizacao_sdr', 'valor_imovel_sdr', 'buscando_sdr', 'corretor', 'aprovado', 'visita', 'proposta', 'documentacao', 'venda', 'origem', 'status_corretor', 'cliente_ouro'];

// ─── ROTA: API DE LEADS (alimenta o dashboard) ───────────────
app.get('/api/leads', basicAuthAdminOuSdr, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const leadsResult = await pool.query(
      `SELECT id, whatsapp, nome, email, corretor, imovel_codigo, imovel_desc,
              distribuido_em, contatou, primeiro_contato_em,
              origem, interesse, status, ultimo_contato, aprovado, visita, proposta, venda,
              numero_invalido, whatsapp_bruto, outros_corretores, sem_retorno, em_andamento,
              notas_sdr, reaquecido_em
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
      GROUP BY imovel_codigo, imovel_desc
      ORDER BY total DESC
    `);
    const campanhasAgrupadas = agruparCampanhas(porCampanhaResult.rows);

    const porOrigemResult = await pool.query(`
      SELECT COALESCE(origem, 'Não informado') AS origem, count(*) AS total
      FROM leads
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

// ─── ROTA: CONFERIR CONTATO (fluxo da SDR, um contato por vez) ──
// GET: só verifica se o WhatsApp já existe na base e pra quem já foi.
app.get('/api/leads/conferir', basicAuthAdminOuSdr, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  const whatsappValido = canonicalizarWhatsapp(req.query.whatsapp);
  if (!whatsappValido) {
    return res.status(400).json({ ok: false, erro: 'WhatsApp inválido — confere o DDD e os dígitos.' });
  }
  try {
    const result = await pool.query('SELECT * FROM leads WHERE whatsapp = $1', [whatsappValido]);
    if (result.rows.length > 0) {
      return res.json({ ok: true, encontrado: true, lead: result.rows[0] });
    }
    res.json({ ok: true, encontrado: false, whatsapp: whatsappValido });
  } catch (err) {
    console.error('Erro ao conferir contato:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST: se ainda não existir, cadastra como novo lead (origem "SDR", sem
// corretor ainda). Se já existir, apenas marca esse lead como parte da
// carteira da SDR (carteira_sdr = true) — assim ele passa a aparecer no
// Kanban dela, sem duplicar nem mexer no lead original.
app.post('/api/leads/conferir', basicAuthAdminOuSdr, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  const { nome, whatsapp, origem } = req.body;
  const whatsappValido = canonicalizarWhatsapp(whatsapp);
  if (!whatsappValido) {
    return res.status(400).json({ ok: false, erro: 'WhatsApp inválido — confere o DDD e os dígitos.' });
  }
  if (!nome || !nome.trim()) {
    return res.status(400).json({ ok: false, erro: 'Nome é obrigatório' });
  }

  // Corretor adicionando: o lead já nasce (ou passa a ser) dele — é um
  // caminho diferente do da SDR/Juliane, que só marcam a própria carteira.
  // Cobre tanto o login de corretor de verdade quanto o admin/Juliane
  // "visitando" o CRM de um corretor pelo atalho (?corretor=Nome).
  const nomeCorretorAlvo = req.authTipo === 'corretor'
    ? req.corretorNome
    : ((req.authTipo === 'admin' || req.authTipo === 'juliane') && req.body.corretorAlvo ? String(req.body.corretorAlvo) : null);
  if (nomeCorretorAlvo) {
    // O corretor escolhe se é lead da imobiliária ou pessoal dele, e
    // também a origem — qualquer outro caminho (distribuição, planilha,
    // SDR/Juliane) continua automático, sem precisar escolher nada disso.
    const tipoLeadEscolhido = req.body.tipoLead === 'Pessoal' ? 'Pessoal' : 'Imobiliária';
    const origemEscolhida = (origem && String(origem).trim()) ? String(origem).trim() : null;
    try {
      const existente = await pool.query('SELECT * FROM leads WHERE whatsapp = $1', [whatsappValido]);
      if (existente.rows.length > 0) {
        const leadAtual = existente.rows[0];
        if (leadAtual.corretor && leadAtual.corretor !== nomeCorretorAlvo) {
          return res.status(409).json({ ok: false, erro: `Esse contato já é do corretor ${leadAtual.corretor} — não dá pra adicionar aqui.` });
        }
        const atualizado = await pool.query(
          `UPDATE leads SET corretor = $1, status_corretor = COALESCE(status_corretor, 'Novo'), status_corretor_alterado_em = now(), tipo_lead = $2, origem = COALESCE(origem, $3) WHERE id = $4 RETURNING *`,
          [nomeCorretorAlvo, tipoLeadEscolhido, origemEscolhida, leadAtual.id]
        );
        return res.json({ ok: true, encontrado: true, criado: false, lead: atualizado.rows[0] });
      }
      const result = await pool.query(
        `INSERT INTO leads (whatsapp, nome, corretor, status, status_corretor, status_corretor_alterado_em, distribuido_em, tipo_lead, origem)
         VALUES ($1, $2, $3, 'Novo', 'Novo', now(), now(), $4, $5)
         RETURNING *`,
        [whatsappValido, nome.trim(), nomeCorretorAlvo, tipoLeadEscolhido, origemEscolhida]
      );
      return res.json({ ok: true, encontrado: false, criado: true, lead: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') {
        const existente = await pool.query('SELECT * FROM leads WHERE whatsapp = $1', [whatsappValido]);
        const atualizado = await pool.query(
          `UPDATE leads SET corretor = $1, status_corretor = COALESCE(status_corretor, 'Novo'), status_corretor_alterado_em = now(), tipo_lead = $2, origem = COALESCE(origem, $3) WHERE id = $4 RETURNING *`,
          [nomeCorretorAlvo, tipoLeadEscolhido, origemEscolhida, existente.rows[0].id]
        );
        return res.json({ ok: true, encontrado: true, criado: false, lead: atualizado.rows[0] });
      }
      console.error('Erro ao adicionar contato (corretor):', err);
      return res.status(500).json({ ok: false, erro: err.message });
    }
  }

  // Quem adiciona marca só a própria carteira — SDR marca carteira_sdr,
  // Juliane marca carteira_juliane. Assim, o que a Juliane adiciona não
  // desaparece do quadro dela (que agora esconde tudo que tem carteira_sdr).
  // A origem agora é escolhida por quem adiciona (não é mais fixa).
  const origemNovo = (origem && String(origem).trim()) ? String(origem).trim() : (req.authTipo === 'juliane' ? 'Juliane' : 'SDR');
  const colunaCarteira = req.authTipo === 'juliane' ? 'carteira_juliane' : 'carteira_sdr';
  // Quando a Juliane confere um contato que já existia (ex: já estava sendo
  // trabalhado pela SDR), ela está assumindo esse atendimento — libera da
  // carteira ativa da SDR, senão o lead fica marcado pras duas ao mesmo
  // tempo e aparece nos dois CRMs.
  const clausulaLiberaSdr = req.authTipo === 'juliane' ? ', carteira_sdr = false' : '';
  try {
    const existente = await pool.query('SELECT * FROM leads WHERE whatsapp = $1', [whatsappValido]);
    if (existente.rows.length > 0) {
      const atualizado = await pool.query(
        `UPDATE leads SET ${colunaCarteira} = true${clausulaLiberaSdr}, status_alterado_em = now(), origem = COALESCE(origem, $2) WHERE id = $1 RETURNING *`,
        [existente.rows[0].id, origemNovo]
      );
      return res.json({ ok: true, encontrado: true, criado: false, lead: atualizado.rows[0] });
    }
    const result = await pool.query(
      `INSERT INTO leads (whatsapp, nome, origem, status, ${colunaCarteira}, status_alterado_em)
       VALUES ($1, $2, $3, 'Novo', true, now())
       RETURNING *`,
      [whatsappValido, nome.trim(), origemNovo]
    );
    res.json({ ok: true, encontrado: false, criado: true, lead: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      const existente = await pool.query('SELECT * FROM leads WHERE whatsapp = $1', [whatsappValido]);
      const atualizado = await pool.query(
        `UPDATE leads SET ${colunaCarteira} = true${clausulaLiberaSdr}, status_alterado_em = now(), origem = COALESCE(origem, $2) WHERE id = $1 RETURNING *`,
        [existente.rows[0].id, origemNovo]
      );
      return res.json({ ok: true, encontrado: true, criado: false, lead: atualizado.rows[0] });
    }
    console.error('Erro ao adicionar contato conferido:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// Lista só os leads que a SDR já adicionou (carteira_sdr = true) — usada
// pelo Kanban do /crm, que começa vazio e vai crescendo conforme ela sobe
// os contatos, sem mostrar os leads do sistema todo.
app.get('/api/leads/carteira-sdr', basicAuthAdminOuSdr, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const result = await pool.query(
      `SELECT id, whatsapp, nome, corretor, origem, imovel_desc, imovel_codigo, status, distribuido_em,
              outros_corretores, notas_sdr, reaquecido_em, tarefa_sdr, corretores_repassados,
              status_alterado_em, ultima_atualizacao_sdr, valor_imovel_sdr, buscando_sdr, tarefa_data, aprovado, visita, proposta, documentacao, venda, cliente_ouro
       FROM leads
       WHERE carteira_sdr = true OR status = 'Repassado ao corretor'
       ORDER BY COALESCE(status_alterado_em, distribuido_em) DESC`
    );
    res.json({ ok: true, leads: result.rows });
  } catch (err) {
    console.error('Erro ao listar carteira da SDR:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// Lista os leads que passaram pra Juliane (carteira_juliane = true) — isso
// acontece sozinho quando a SDR marca o status como "Visita agendada", sem
// precisar recadastrar nada.
app.get('/api/leads/carteira-juliane', basicAuthAdminOuSdr, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const result = await pool.query(
      `SELECT id, whatsapp, nome, corretor, origem, status, distribuido_em,
              outros_corretores, notas_sdr, reaquecido_em, tarefa_sdr, corretores_repassados,
              status_alterado_em, ultima_atualizacao_sdr, valor_imovel_sdr, buscando_sdr, tarefa_data, aprovado, visita, proposta, documentacao, venda, cliente_ouro
       FROM leads
       WHERE carteira_juliane = true
       ORDER BY COALESCE(status_alterado_em, distribuido_em) DESC`
    );
    res.json({ ok: true, leads: result.rows });
  } catch (err) {
    console.error('Erro ao listar carteira da Juliane:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// Lista TODOS os leads do sistema (não só uma carteira) — alimenta o quadro
// Lista só os leads do corretor que está logado agora — nunca de outro.
app.get('/api/leads/meus', basicAuthAdminOuSdr, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  if (req.authTipo !== 'corretor' && !((req.authTipo === 'admin' || req.authTipo === 'juliane') && req.query.corretor)) {
    return res.status(403).json({ ok: false, erro: 'Esse login não é de corretor' });
  }
  const nomeCorretor = req.authTipo === 'corretor' ? req.corretorNome : String(req.query.corretor);
  try {
    const result = await pool.query(
      `SELECT id, whatsapp, nome, corretor, origem, imovel_desc, imovel_codigo, distribuido_em,
              notas_sdr, tarefa_sdr, tarefa_data,
              ultima_atualizacao_sdr, valor_imovel_sdr, buscando_sdr,
              status_corretor, status_corretor_alterado_em, tipo_lead, cliente_ouro
       FROM leads
       WHERE corretor = $1 AND (status_corretor_alterado_em IS NOT NULL OR carteira_sdr IS NOT TRUE)
       ORDER BY COALESCE(status_corretor_alterado_em, distribuido_em) DESC`,
      [nomeCorretor]
    );
    res.json({ ok: true, leads: result.rows });
  } catch (err) {
    console.error('Erro ao listar leads do corretor:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// da Juliane organizado por corretor: quem já tem corretor definido cai na
// coluna dele, quem não tem cai em "Repassado ao corretor" pra ela organizar.
app.get('/api/leads/todos-resumo', basicAuthAdminOuSdr, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const result = await pool.query(
      `SELECT id, whatsapp, nome, corretor, origem, imovel_desc, imovel_codigo, status, distribuido_em,
              outros_corretores, notas_sdr, reaquecido_em, tarefa_sdr, corretores_repassados,
              status_alterado_em, ultima_atualizacao_sdr, valor_imovel_sdr, buscando_sdr, tarefa_data, aprovado, visita, proposta, documentacao, venda, carteira_sdr, carteira_juliane, cliente_ouro
       FROM leads
       WHERE COALESCE(status, '') NOT IN ('Sem retorno', 'Reaquecendo')
         AND (
           -- Ela mesma adicionou esse contato pelo CRM dela — fica visível
           -- pra ela na hora, não importa data nem status.
           carteira_juliane = true
           -- Foi atribuído manualmente pelo CRM (alguém escolheu o
           -- corretor de propósito) — aparece sempre, não importa a data.
           -- Só conta se realmente sobrou um corretor: se o campo foi
           -- carimbado mas o corretor ficou vazio (ex: alguém limpou o
           -- select), não é mais um "repasse" válido.
           OR (status_corretor_alterado_em IS NOT NULL AND corretor IS NOT NULL AND corretor <> '')
           -- A SDR já marcou explicitamente como repassado — aparece sempre,
           -- não importa se a flag carteira_sdr ainda está true.
           OR status = 'Repassado ao corretor'
           OR (
             distribuido_em >= '2026-09-17'
             -- Tem corretor definido (mesmo que atribuído automaticamente
             -- na distribuição) E a SDR já soltou o lead da carteira dela —
             -- ou seja, não está mais em etapa ativa da SDR (Aguardando
             -- retorno, Aguardando documentação, etc.). Enquanto
             -- carteira_sdr = true, o lead ainda é dela, não da Juliane.
             AND (corretor IS NOT NULL AND corretor <> '')
             AND carteira_sdr IS NOT TRUE
           )
         )
       ORDER BY COALESCE(status_alterado_em, distribuido_em) DESC
       LIMIT 2000`
    );
    res.json({ ok: true, leads: result.rows });
  } catch (err) {
    console.error('Erro ao listar todos os leads (resumo):', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: API DE ANALYTICS (alimenta a página /analytics) ──────
// Recebe ?inicio=YYYY-MM-DD&fim=YYYY-MM-DD (opcionais — sem eles, considera
// a base toda). Filtra pela data em que o lead entrou no sistema
// (distribuido_em / criado_em), não pela última atualização.
app.get('/api/analytics', basicAuthAdminOuSdr, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }

  try {
    const { inicio, fim } = req.query;
    const temPeriodo = inicio && fim;

    // Corretor só vê os próprios números — nunca aceita corretor vindo da
    // URL, só o nome que já veio da autenticação (evita um corretor olhar
    // o desempenho dos outros trocando o parâmetro na mão).
    const escopoCorretor = req.authTipo === 'corretor' ? req.corretorNome : null;

    const condLeads = [];
    const paramsLeads = [];
    if (temPeriodo) {
      paramsLeads.push(inicio, fim);
      condLeads.push(`distribuido_em >= $${paramsLeads.length - 1}::date`);
      condLeads.push(`distribuido_em < ($${paramsLeads.length}::date + interval '1 day')`);
    }
    if (escopoCorretor) {
      paramsLeads.push(escopoCorretor);
      condLeads.push(`corretor = $${paramsLeads.length}`);
    }
    const whereLeads = condLeads.length ? `WHERE ${condLeads.join(' AND ')}` : '';

    const condNaoIdent = [];
    const paramsNaoIdent = [];
    if (temPeriodo) {
      paramsNaoIdent.push(inicio, fim);
      condNaoIdent.push(`criado_em >= $${paramsNaoIdent.length - 1}::date`);
      condNaoIdent.push(`criado_em < ($${paramsNaoIdent.length}::date + interval '1 day')`);
    }
    if (escopoCorretor) {
      paramsNaoIdent.push(escopoCorretor);
      condNaoIdent.push(`corretor = $${paramsNaoIdent.length}`);
    }
    const whereNaoIdent = condNaoIdent.length ? `WHERE ${condNaoIdent.join(' AND ')}` : '';

    const [funilQ, corretorQ, origemQ, statusQ, tendenciaQ, naoIdentQ] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE contatou)::int AS contatou,
          COUNT(*) FILTER (WHERE visita)::int AS visita,
          COUNT(*) FILTER (WHERE proposta)::int AS proposta,
          COUNT(*) FILTER (WHERE venda)::int AS venda,
          COUNT(*) FILTER (WHERE sem_retorno)::int AS sem_retorno,
          COUNT(*) FILTER (WHERE numero_invalido)::int AS numero_invalido,
          COUNT(*) FILTER (WHERE cliente_ouro)::int AS cliente_ouro
        FROM leads ${whereLeads}
      `, paramsLeads),

      pool.query(`
        SELECT
          COALESCE(NULLIF(corretor, ''), 'Sem corretor') AS corretor,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE contatou)::int AS contatou,
          COUNT(*) FILTER (WHERE venda)::int AS venda,
          ROUND(
            AVG(EXTRACT(EPOCH FROM (primeiro_contato_em - distribuido_em)) / 3600.0)
              FILTER (WHERE primeiro_contato_em IS NOT NULL),
            1
          ) AS horas_media_resposta
        FROM leads ${whereLeads}
        GROUP BY 1
        ORDER BY total DESC
      `, paramsLeads),

      pool.query(`
        SELECT
          COALESCE(NULLIF(origem, ''), 'Sem origem') AS origem,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE venda)::int AS venda
        FROM leads ${whereLeads}
        GROUP BY 1
        ORDER BY total DESC
      `, paramsLeads),

      pool.query(`
        SELECT COALESCE(NULLIF(status, ''), 'Novo') AS status, COUNT(*)::int AS total
        FROM leads ${whereLeads}
        GROUP BY 1
        ORDER BY total DESC
      `, paramsLeads),

      pool.query(`
        SELECT to_char(date_trunc('day', distribuido_em), 'YYYY-MM-DD') AS dia, COUNT(*)::int AS total
        FROM leads ${whereLeads}
        GROUP BY 1
        ORDER BY 1
      `, paramsLeads),

      pool.query(`
        SELECT COUNT(*)::int AS total FROM leads_nao_identificados ${whereNaoIdent}
      `, paramsNaoIdent),
    ]);

    res.json({
      ok: true,
      funil: funilQ.rows[0],
      corretores: corretorQ.rows,
      origens: origemQ.rows,
      status: statusQ.rows,
      tendencia: tendenciaQ.rows,
      nao_identificados: naoIdentQ.rows[0].total,
    });
  } catch (err) {
    console.error('Erro ao gerar analytics:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});


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
// ─── ROTA: EXCLUIR LEAD PERMANENTEMENTE ──────────────────────
// Usada pelo botão "Excluir" no quadro principal da Juliane. Apaga o lead
// de vez do banco — some do CRM da Juliane, do CRM da SDR e do /dashboard,
// porque é o mesmo registro em todo lugar. Sem volta (a não ser recuperando
// de um backup). Só admin e Juliane podem — a SDR continua só "removendo da
// carteira" (isso não muda, é uma ação diferente e reversível).
app.delete('/api/leads/:id', basicAuthAdminOuSdr, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  if (req.authTipo === 'sdr') {
    return res.status(403).json({ ok: false, erro: 'Login da SDR não pode excluir lead — use "Remover da carteira".' });
  }
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM leads WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, erro: 'Lead não encontrado' });
    }
    console.log(`Lead ${id} excluído permanentemente por ${req.authTipo}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao excluir lead:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});


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
app.patch('/api/leads/:id', basicAuthAdminOuSdr, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  const { id } = req.params;
  const { campo, valor } = req.body;

  if (!CAMPOS_EDITAVEIS.includes(campo)) {
    return res.status(400).json({ ok: false, erro: `Campo '${campo}' não é editável` });
  }
  if (req.authTipo === 'sdr' && !CAMPOS_EDITAVEIS_SDR.includes(campo)) {
    return res.status(403).json({ ok: false, erro: `Login da SDR não pode editar o campo '${campo}'` });
  }
  if (req.authTipo === 'juliane' && !CAMPOS_EDITAVEIS_JULIANE.includes(campo)) {
    return res.status(403).json({ ok: false, erro: `Login da Juliane não pode editar o campo '${campo}'` });
  }
  if (req.authTipo === 'corretor') {
    if (!CAMPOS_EDITAVEIS_CORRETOR.includes(campo)) {
      return res.status(403).json({ ok: false, erro: `Você não pode editar o campo '${campo}'` });
    }
    // Segurança: o corretor só pode editar lead que é realmente dele.
    const donoResult = await pool.query('SELECT corretor FROM leads WHERE id = $1', [id]);
    if (donoResult.rows.length === 0) {
      return res.status(404).json({ ok: false, erro: 'Lead não encontrado' });
    }
    if (normalizarNomeCorretor(donoResult.rows[0].corretor) !== req.corretorNome) {
      return res.status(403).json({ ok: false, erro: 'Esse lead não é seu' });
    }
  }

  // Unifica variações de acento/maiúscula no nome do corretor (ex: "Lais" e
  // "Laís" contam como a mesma pessoa) — tanto no campo principal quanto nas
  // etiquetas de "repassado pra quem".
  let valorFinal = valor;
  if (campo === 'corretor') {
    valorFinal = normalizarNomeCorretor(valor);
  } else if (campo === 'corretores_repassados' && typeof valor === 'string') {
    valorFinal = valor.split(',').map(n => normalizarNomeCorretor(n.trim())).filter(Boolean).join(', ');
  }

  // Campos de data/hora não aceitam texto vazio no Postgres — se a pessoa
  // limpou o campo (ex: apagou a data), grava como "sem data" (null).
  const CAMPOS_DE_DATA = ['ultima_atualizacao_sdr', 'tarefa_data', 'ultimo_contato'];
  if (CAMPOS_DE_DATA.includes(campo) && valorFinal === '') {
    valorFinal = null;
  }

  try {
    // Quando a SDR marca o lead como "Reaquecendo", registra o momento —
    // ajuda a saber há quanto tempo está nessa fila de reaquecimento.
    if (campo === 'status') {
      // Toda troca de status marca "entrou nessa etapa agora" — é a data
      // mostrada no card. Se for pra "Reaquecendo", também marca reaquecido_em.
      // E se for pra "Visita agendada", é o ponto de virada: o lead passa
      // sozinho a aparecer também no Kanban da Juliane, dali pra frente.
      if (valor === 'Reaquecendo') {
        await pool.query(
          `UPDATE leads SET status = $1, status_alterado_em = now(), reaquecido_em = now() WHERE id = $2`,
          [valor, id]
        );
      } else if (valor === 'Visita agendada') {
        await pool.query(
          `UPDATE leads SET status = $1, status_alterado_em = now(), carteira_juliane = true WHERE id = $2`,
          [valor, id]
        );
      } else {
        await pool.query(
          `UPDATE leads SET status = $1, status_alterado_em = now() WHERE id = $2`,
          [valor, id]
        );
      }
    } else if (campo === 'status_corretor') {
      await pool.query(
        `UPDATE leads SET status_corretor = $1, status_corretor_alterado_em = now() WHERE id = $2`,
        [valorFinal, id]
      );
    } else if (campo === 'corretor') {
      // Ao atribuir/trocar o corretor manualmente (essa rota só é usada
      // pelo CRM — a distribuição automática do Canal Pro nunca passa por
      // aqui): guarda o corretor anterior no histórico (outros_corretores),
      // libera da carteira da SDR, e marca como "Reaquecido" pro corretor
      // que está recebendo — foi uma escolha da SDR, não distribuição fria.
      // Limpar o corretor (valor vazio) é diferente de atribuir: não é um
      // repasse, é "tirar esse lead de circulação por enquanto" — não deve
      // carimbar status_corretor_alterado_em (senão ele reaparece pra
      // Juliane sem corretor nenhum) nem mexer em carteira_sdr/histórico.
      if (valorFinal && valorFinal.trim()) {
        await pool.query(
          `UPDATE leads
           SET corretor = $1,
               outros_corretores = CASE
                 WHEN corretor IS NOT NULL AND corretor <> '' AND corretor <> $1
                      AND (outros_corretores IS NULL OR position(corretor IN outros_corretores) = 0)
                 THEN COALESCE(outros_corretores || ', ', '') || corretor
                 ELSE outros_corretores
               END,
               carteira_sdr = false,
               status_corretor = 'Reaquecido',
               status_corretor_alterado_em = now()
           WHERE id = $2`,
          [valorFinal, id]
        );
      } else {
        await pool.query(
          `UPDATE leads SET corretor = $1 WHERE id = $2`,
          [valorFinal, id]
        );
      }
    } else {
      await pool.query(
        `UPDATE leads SET ${campo} = $1 WHERE id = $2`,
        [valorFinal, id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao editar lead:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: DASHBOARD ──────────────────────────────────────────
app.get('/dashboard', basicAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.send(DASHBOARD_HTML);
});

// ─── ROTAS: BACKUPS AUTOMÁTICOS ──────────────────────────────
// Passo 1: inicia a autorização do Google Drive (conta pessoal) — visita
// essa rota no navegador, loga com sua conta Google, autoriza, e pronto.
// Só precisa fazer isso uma vez (o token fica salvo no Postgres).
app.get('/api/admin/drive-auth', basicAuth, (req, res) => {
  const oauthClient = getOAuthClient();
  if (!oauthClient) {
    return res.status(503).send('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET não configuradas no Railway.');
  }
  const url = oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // força gerar um refresh_token novo toda vez
    scope: ['https://www.googleapis.com/auth/drive.file'],
  });
  res.redirect(url);
});

// Passo 2: o Google chama essa rota sozinho depois que você autoriza —
// troca o código por um token permanente e salva no Postgres.
app.get(GOOGLE_OAUTH_REDIRECT_PATH, basicAuth, async (req, res) => {
  const oauthClient = getOAuthClient();
  if (!oauthClient) {
    return res.status(503).send('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET não configuradas no Railway.');
  }
  const { code, error } = req.query;
  if (error) {
    return res.status(400).send(`Autorização recusada pelo Google: ${error}`);
  }
  if (!code) {
    return res.status(400).send('Código de autorização não recebido.');
  }
  try {
    const { tokens } = await oauthClient.getToken(code);
    if (!tokens.refresh_token) {
      return res.status(400).send(
        'O Google não devolveu um token permanente. Isso acontece se você já tinha autorizado antes — ' +
        'vá em https://myaccount.google.com/permissions, remova o acesso do app, e tente de novo pelo /api/admin/drive-auth.'
      );
    }
    await salvarConfig('google_drive_refresh_token', tokens.refresh_token);
    res.send('✅ Google Drive autorizado com sucesso! Pode fechar essa aba. O backup diário já vai subir pro seu Drive a partir de agora.');
  } catch (err) {
    console.error('Erro ao trocar código por token:', err);
    res.status(500).send(`Erro ao autorizar: ${err.message}`);
  }
});

// Lista os backups diários guardados (mais recente primeiro)
app.get('/api/admin/backups', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const result = await pool.query(
      `SELECT id, criado_em, total_leads FROM backups_leads ORDER BY criado_em DESC`
    );
    res.json({ ok: true, backups: result.rows });
  } catch (err) {
    console.error('Erro ao listar backups:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// Baixa um backup específico como arquivo JSON
app.get('/api/admin/backups/:id/download', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const result = await pool.query('SELECT * FROM backups_leads WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, erro: 'Backup não encontrado' });
    }
    const backup = result.rows[0];
    const dataFormatada = new Date(backup.criado_em).toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="backup-leads-${dataFormatada}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(backup.dados, null, 2));
  } catch (err) {
    console.error('Erro ao baixar backup:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// Dispara um backup manualmente, sem esperar o horário automático
// (aceita GET também, pra poder testar só colando o link no navegador)
app.all('/api/admin/backups/agora', basicAuthAdminOuSdr, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const resultado = await fazerBackupDiario();
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: RESTAURAR carteira_sdr A PARTIR DE UM BACKUP (uso pontual) ─
// Corrige um incidente específico: uma correção de dados ruim zerou
// carteira_sdr de vários leads que tinham corretor definido. Essa rota
// olha um backup de ANTES do incidente e devolve carteira_sdr = true só
// pros leads que: (a) o backup mostra como true, (b) hoje estão como
// false, e (c) ainda têm corretor definido — não mexe em mais nada.
// ─── ROTA: DIAGNÓSTICO — leads de um corretor escondidos por carteira_sdr ─
// Só consulta, não muda nada. Mostra quais leads têm aquele corretor mas
// não aparecem no CRM dele porque ainda estão marcados como "na carteira
// da SDR" (carteira_sdr = true).
// ─── ROTA: IMPORTAÇÃO PONTUAL — leads da Michelle (planilha manual) ─
// Uso único: insere/atualiza os leads que a Michelle já vinha controlando
// numa planilha própria, com corretor, status (no board dela), notas,
// valor do imóvel e datas — sem perder nenhuma informação que ela já tinha
// registrado. Não mexe em lead que já existir com outro corretor.
const LEADS_MICHELLE = [
  {
    "nome": "Lorena Boaventura",
    "whatsapp": "5562991531824",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-16",
    "ultimaAtualizacao": "2026-09-16",
    "numeroInvalido": false
  },
  {
    "nome": "Marcia Francisca",
    "whatsapp": "5562993268694",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-16",
    "ultimaAtualizacao": "2026-09-16",
    "numeroInvalido": false
  },
  {
    "nome": "Daniiel Fernandes",
    "whatsapp": "5562993700292",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-16",
    "ultimaAtualizacao": "2026-09-16",
    "numeroInvalido": false
  },
  {
    "nome": "Rosineia",
    "whatsapp": "5562985933274",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-16",
    "ultimaAtualizacao": "2026-09-16",
    "numeroInvalido": false
  },
  {
    "nome": "Valdirene",
    "whatsapp": "5562999048492",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-16",
    "ultimaAtualizacao": "2026-09-16",
    "numeroInvalido": false
  },
  {
    "nome": "Robson",
    "whatsapp": "5562991457810",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-16",
    "ultimaAtualizacao": "2026-09-16",
    "numeroInvalido": false
  },
  {
    "nome": "Fabio",
    "whatsapp": "5562996989643",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-16",
    "ultimaAtualizacao": "2026-09-16",
    "numeroInvalido": false
  },
  {
    "nome": "Julyana",
    "whatsapp": "5562981832136",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-16",
    "ultimaAtualizacao": "2026-09-16",
    "numeroInvalido": false
  },
  {
    "nome": "Giovana",
    "whatsapp": "5562991666487",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-16",
    "ultimaAtualizacao": "2026-09-16",
    "numeroInvalido": false
  },
  {
    "nome": "Alan Veronezi",
    "whatsapp": "5562996379409",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Aguardando retorno",
    "notasSdr": "OBTIVE RESPOSTA: CLIENTE NO MOMENTO ESTA COM O NOME NEGATIVADO,PERGUNTEI SE IRA FAZER NEGOCIAÇAO NAO ME RESPONDEU MAIS.",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-16",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Yasmin",
    "whatsapp": "5562992592881",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-16",
    "ultimaAtualizacao": "2026-09-16",
    "numeroInvalido": false
  },
  {
    "nome": "Lucian",
    "whatsapp": "5562992442556",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Maria Luiza",
    "whatsapp": "5534998964239",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Domingos",
    "whatsapp": "5562996175302",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Rafael",
    "whatsapp": "5521966146400",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "INDISPENSÁVEL: NAO OBTIVE CONTATO NUMERO ERRADO",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": true
  },
  {
    "nome": "Diego",
    "whatsapp": "5562984669753",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Anna Laura",
    "whatsapp": "5562991377889",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Kaua",
    "whatsapp": "5562998312084",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "INDISPENSÁVEL: FALTA UM NUMERO NO CONTATO",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": true
  },
  {
    "nome": "Marcos",
    "whatsapp": "5562991102120",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Juliana",
    "whatsapp": "5562994737460",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Aguardando retorno",
    "notasSdr": "OBTIVE RESPOSTA: CLIENTE DISSE QUE NAO TEM INTERESSE NO MOMENTO, PERGUNTEI SE FUTURAMENTE PODERIA ENTAR EM CONTATO NOVAMENTE COM NAO ME RESPONDEU MAIS.",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Bruno",
    "whatsapp": "5562991928179",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "INDISPENSÁVEL: ESSE NUMERO NAO CONTA NO WHATSAPP, LIGUEI NAO ATENDEU TELEFONE NAO DA NADA.",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": true
  },
  {
    "nome": "Cassio",
    "whatsapp": "5562993900134",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Antonio",
    "whatsapp": "5562991302940",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Reinaldo",
    "whatsapp": "5562992824131",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Natim",
    "whatsapp": "5562994263601",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "INDISPENSÁVEL: NUMERO SEM WHATSAPP, LIGUEI NUMERO NAO DA NADA.",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": true
  },
  {
    "nome": "Meuridiana",
    "whatsapp": "5562992563233",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Marquim",
    "whatsapp": "5562981960813",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Francisvaldo",
    "whatsapp": "5562994417099",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Joao",
    "whatsapp": "5514981861697",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Gloria",
    "whatsapp": "5562991028985",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Sueli",
    "whatsapp": "5562982912187",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Marcia",
    "whatsapp": "5562982279154",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Milton",
    "whatsapp": "5562992811079",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Jhony",
    "whatsapp": "5562991314334",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Alexandre",
    "whatsapp": "5562994457771",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Jean",
    "whatsapp": "5562995085588",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Maria Jose",
    "whatsapp": "5561991081759",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Pericles",
    "whatsapp": "5534624561792",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Hanucy",
    "whatsapp": "5562994491037",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Manuela",
    "whatsapp": "5562992384685",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Sem nome",
    "whatsapp": "5561991497006",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Leila",
    "whatsapp": "5562992398194",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Valeria",
    "whatsapp": "5562993736571",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Diego",
    "whatsapp": "5562992316655",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONATO COM O CLIENTE E NAO OBTIVE NENHUMA RESPOSTA",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Adriana",
    "whatsapp": "5562992166166",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Aguardando retorno",
    "notasSdr": "AGUARDANDO INFORMACAO: ENTREI EM CONTATO, CLIENTE SO FALOU OI AGURADANDO MAS INFORMACAO",
    "valorImovel": null,
    "distribuidoEm": "2026-09-17",
    "ultimaAtualizacao": "2026-09-17",
    "numeroInvalido": false
  },
  {
    "nome": "Andre",
    "whatsapp": "5562996409442",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Aguardando retorno",
    "notasSdr": "AGUARDANDO INFORMACAO: ENTREI EM CONATO COM O CLIENTE DISSE TEM INTERESSE, AGURADANDO ELE PASSAR ALGUMAS INFORMACOES",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-19",
    "ultimaAtualizacao": "2026-09-21",
    "numeroInvalido": false
  },
  {
    "nome": "Raquel",
    "whatsapp": "5562994282140",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONTATO, POREM NAO OBTVE RESPOSTA.",
    "valorImovel": "R$ 255.000,00",
    "distribuidoEm": "2026-09-21",
    "ultimaAtualizacao": "2026-09-21",
    "numeroInvalido": false
  },
  {
    "nome": "Denisson",
    "whatsapp": "5562995237873",
    "origem": "Patrocinado",
    "imovelDesc": "GRAN VENEZA",
    "statusCorretor": "Sem retorno",
    "notasSdr": "SEM RETORNO: ENTREI EM CONTATO,POREM NAO OBTVE RESPOSTA",
    "valorImovel": null,
    "distribuidoEm": "2026-09-21",
    "ultimaAtualizacao": "2026-09-21",
    "numeroInvalido": false
  }
];

app.all('/api/admin/importar-leads-michelle', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  let inseridos = 0;
  let atualizados = 0;
  let jaTinhamOutroCorretor = 0;
  const erros = [];

  try {
    for (const item of LEADS_MICHELLE) {
      if (!item.whatsapp) {
        erros.push(`${item.nome}: sem WhatsApp válido`);
        continue;
      }
      try {
        const existente = await pool.query('SELECT id, corretor FROM leads WHERE whatsapp = $1', [item.whatsapp]);

        if (existente.rows.length > 0) {
          const leadAtual = existente.rows[0];
          if (leadAtual.corretor && leadAtual.corretor !== 'Michelle') {
            jaTinhamOutroCorretor++;
            continue;
          }
          await pool.query(
            `UPDATE leads SET
               corretor = 'Michelle',
               origem = COALESCE(origem, $1),
               imovel_desc = COALESCE(imovel_desc, $2),
               status_corretor = $3,
               status_corretor_alterado_em = now(),
               notas_sdr = COALESCE(notas_sdr, $4),
               valor_imovel_sdr = COALESCE(valor_imovel_sdr, $5),
               ultima_atualizacao_sdr = $6,
               numero_invalido = $7
             WHERE id = $8`,
            [item.origem, item.imovelDesc, item.statusCorretor, item.notasSdr, item.valorImovel,
             item.ultimaAtualizacao, item.numeroInvalido, leadAtual.id]
          );
          atualizados++;
        } else {
          await pool.query(
            `INSERT INTO leads (whatsapp, nome, corretor, origem, imovel_desc, status_corretor,
                                 status_corretor_alterado_em, notas_sdr, valor_imovel_sdr,
                                 ultima_atualizacao_sdr, distribuido_em, numero_invalido)
             VALUES ($1, $2, 'Michelle', $3, $4, $5, now(), $6, $7, $8, $9, $10)`,
            [item.whatsapp, item.nome, item.origem, item.imovelDesc, item.statusCorretor,
             item.notasSdr, item.valorImovel, item.ultimaAtualizacao,
             item.distribuidoEm || new Date().toISOString(), item.numeroInvalido]
          );
          inseridos++;
        }
      } catch (errItem) {
        erros.push(`${item.nome} (${item.whatsapp}): ${errItem.message}`);
      }
    }

    console.log(`Importação Michelle: ${inseridos} novos, ${atualizados} atualizados, ${jaTinhamOutroCorretor} já tinham outro corretor (ignorados)`);
    res.json({ ok: true, inseridos, atualizados, jaTinhamOutroCorretor, totalErros: erros.length, erros });
  } catch (err) {
    console.error('Erro na importação da Michelle:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: TRANSFERE pra Michelle mesmo quem já tinha outro corretor ────
// Uso único, pra rodar depois da rota acima — ela já confirmou que ela
// está trabalhando esses leads de verdade. Passa o corretor antigo pro
// histórico (outros_corretores), igual acontece quando alguém reatribui
// manualmente pelo CRM.
app.all('/api/admin/importar-leads-michelle-forcar', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  let transferidos = 0;
  let jaEramDela = 0;
  const erros = [];

  try {
    for (const item of LEADS_MICHELLE) {
      if (!item.whatsapp) continue;
      try {
        const existente = await pool.query('SELECT id, corretor FROM leads WHERE whatsapp = $1', [item.whatsapp]);
        if (existente.rows.length === 0) continue; // já foi criado na rota anterior

        const leadAtual = existente.rows[0];
        if (leadAtual.corretor === 'Michelle') {
          jaEramDela++;
          continue;
        }

        await pool.query(
          `UPDATE leads SET
             corretor = 'Michelle',
             outros_corretores = CASE
               WHEN corretor IS NOT NULL AND corretor <> '' AND corretor <> 'Michelle'
                    AND (outros_corretores IS NULL OR position(corretor IN outros_corretores) = 0)
               THEN COALESCE(outros_corretores || ', ', '') || corretor
               ELSE outros_corretores
             END,
             origem = COALESCE(origem, $1),
             imovel_desc = COALESCE(imovel_desc, $2),
             status_corretor = $3,
             status_corretor_alterado_em = now(),
             notas_sdr = $4,
             valor_imovel_sdr = COALESCE($5, valor_imovel_sdr),
             ultima_atualizacao_sdr = $6,
             numero_invalido = $7,
             carteira_sdr = false
           WHERE id = $8`,
          [item.origem, item.imovelDesc, item.statusCorretor, item.notasSdr, item.valorImovel,
           item.ultimaAtualizacao, item.numeroInvalido, leadAtual.id]
        );
        transferidos++;
      } catch (errItem) {
        erros.push(`${item.nome} (${item.whatsapp}): ${errItem.message}`);
      }
    }

    console.log(`Transferência forçada pra Michelle: ${transferidos} transferidos, ${jaEramDela} já eram dela`);
    res.json({ ok: true, transferidos, jaEramDela, totalErros: erros.length, erros });
  } catch (err) {
    console.error('Erro na transferência forçada pra Michelle:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: DIAGNÓSTICO — dados completos de um lead por WhatsApp ────────
// Só consulta. Mostra tudo que importa pra entender por que um lead está
// aparecendo (ou não) numa coluna específica de algum CRM.
app.get('/api/admin/diagnostico-lead/:whatsapp', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const whatsappBusca = String(req.params.whatsapp).replace(/\D/g, '');
    const result = await pool.query(
      `SELECT id, nome, whatsapp, corretor, status, status_alterado_em, carteira_sdr, carteira_juliane,
              reaquecido_em, status_corretor, status_corretor_alterado_em, outros_corretores,
              distribuido_em, tarefa_sdr, tarefa_data
       FROM leads
       WHERE whatsapp LIKE $1
       ORDER BY distribuido_em DESC`,
      [`%${whatsappBusca}%`]
    );
    res.json({ ok: true, total: result.rows.length, leads: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: DIAGNÓSTICO — de onde vêm os leads do quadro da Juliane ──────
// Só consulta. Mostra quantos entram por "tem corretor" (sem limite de
// data) vs quantos entram por "recente + repassado ao corretor".
app.get('/api/admin/diagnostico-juliane', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const porCorretor = await pool.query(
      `SELECT count(*) FROM leads WHERE corretor IS NOT NULL AND corretor <> ''`
    );
    const porCorretorRecente = await pool.query(
      `SELECT count(*) FROM leads WHERE corretor IS NOT NULL AND corretor <> '' AND distribuido_em >= '2026-09-17'`
    );
    const porCorretorAntigo = await pool.query(
      `SELECT count(*) FROM leads WHERE corretor IS NOT NULL AND corretor <> '' AND distribuido_em < '2026-09-17'`
    );
    const semCorretorRecenteRepassado = await pool.query(
      `SELECT count(*) FROM leads WHERE (corretor IS NULL OR corretor = '') AND distribuido_em >= '2026-09-17' AND status = 'Repassado ao corretor'`
    );
    res.json({
      ok: true,
      totalComCorretor: Number(porCorretor.rows[0].count),
      comCorretorChegouDe17_09EmDiante: Number(porCorretorRecente.rows[0].count),
      comCorretorChegouAntesDe17_09: Number(porCorretorAntigo.rows[0].count),
      semCorretorMasRecenteERepassado: Number(semCorretorRecenteRepassado.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: DIAGNÓSTICO — busca leads por texto no imóvel (só consulta) ─
// Mostra o que está gravado de verdade no banco pra um pedaço de texto,
// ex: /api/admin/diagnostico-imovel?texto=JIBRAN — ajuda a confirmar se a
// sincronização da planilha está de fato trazendo esse texto pro banco.
app.get('/api/admin/diagnostico-imovel', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  const texto = req.query.texto || '';
  if (!texto) {
    return res.status(400).json({ ok: false, erro: 'Passa ?texto=alguma-coisa na URL' });
  }
  try {
    const result = await pool.query(
      `SELECT id, nome, whatsapp, imovel_codigo, imovel_desc, origem, corretor, distribuido_em
       FROM leads
       WHERE imovel_desc ILIKE $1 OR imovel_codigo ILIKE $1
       ORDER BY distribuido_em DESC
       LIMIT 30`,
      [`%${texto}%`]
    );
    res.json({ ok: true, total: result.rows.length, leads: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: DIAGNÓSTICO — corretor escondido dentro do texto (interesse) ─
// Só consulta, não grava nada. Pra leads sem corretor, procura um trecho
// tipo "Corretor: Fulano" dentro do texto original (interesse/imovel_desc)
// e mostra o que SERIA extraído, pra conferir antes de aplicar de verdade.
app.get('/api/admin/diagnostico-corretor-no-texto', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const result = await pool.query(
      `SELECT id, nome, whatsapp, interesse, imovel_desc
       FROM leads
       WHERE (corretor IS NULL OR corretor = '')
         AND (COALESCE(interesse, '') ~* 'corretor\\s*[:\\-]' OR COALESCE(imovel_desc, '') ~* 'corretor\\s*[:\\-]')
       ORDER BY distribuido_em DESC`
    );
    const candidatos = result.rows.map(lead => {
      const texto = lead.interesse || lead.imovel_desc || '';
      const match = texto.match(/corretor\s*[:\-]?\s*([^\n,;]+)/i);
      const extraido = match ? normalizarNomeCorretor(match[1].trim()) : null;
      return { id: lead.id, nome: lead.nome, whatsapp: lead.whatsapp, corretorExtraido: extraido, trechoOriginal: texto.slice(0, 120) };
    });
    res.json({ ok: true, total: candidatos.length, candidatos });
  } catch (err) {
    console.error('Erro no diagnóstico de corretor no texto:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

app.get('/api/admin/diagnostico-corretor/:nome', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const result = await pool.query(
      `SELECT id, nome, whatsapp, corretor, carteira_sdr, status, reaquecido_em, status_corretor
       FROM leads
       WHERE corretor = $1 AND carteira_sdr = true
       ORDER BY distribuido_em DESC`,
      [req.params.nome]
    );
    res.json({ ok: true, escondidos: result.rows.length, leads: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

app.all('/api/admin/backups/:id/restaurar-carteira-sdr', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  try {
    const backupResult = await pool.query('SELECT dados, criado_em FROM backups_leads WHERE id = $1', [req.params.id]);
    if (backupResult.rows.length === 0) {
      return res.status(404).json({ ok: false, erro: 'Backup não encontrado' });
    }
    const leadsNoBackup = backupResult.rows[0].dados;
    let avaliados = 0;
    let restaurados = 0;

    for (const leadAntigo of leadsNoBackup) {
      if (leadAntigo.carteira_sdr !== true) continue;
      avaliados++;
      const atual = await pool.query(
        `UPDATE leads
         SET carteira_sdr = true
         WHERE id = $1 AND carteira_sdr = false AND corretor IS NOT NULL AND corretor <> ''
         RETURNING id`,
        [leadAntigo.id]
      );
      if (atual.rowCount > 0) restaurados++;
    }

    console.log(`Restauração de carteira_sdr a partir do backup ${req.params.id}: ${restaurados} de ${avaliados} avaliados`);
    res.json({ ok: true, backupDe: backupResult.rows[0].criado_em, avaliados, restaurados });
  } catch (err) {
    console.error('Erro ao restaurar carteira_sdr:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: CRM DA SDR ─────────────────────────────────────────
// Painel enxuto pra SDR organizar a carteira de leads: usa a mesma API
// (/api/leads e /api/leads/:id) do dashboard principal, só que com uma
// visão focada em reaquecimento e histórico de corretores.
app.get('/crm', basicAuthAdminOuSdr, (req, res) => {
  // Sem cache — senão o navegador pode continuar mostrando uma versão
  // antiga da página depois de um deploy novo, mesmo recarregando.
  res.set('Cache-Control', 'no-store');
  res.send(CRM_HTML);
});

// ─── ROTA: ANALYTICS (resultados e desempenho de todos os leads) ─
app.get('/analytics', basicAuthAdminOuSdr, (req, res) => {
  res.set('Cache-Control', 'no-store');
  // Corretor vê só os números dele mesmo — muda o título/subtítulo e o link
  // de "voltar" pro CRM dele. A restrição de dados de verdade acontece no
  // /api/analytics (aqui é só texto da página).
  if (req.authTipo === 'corretor') {
    const html = ANALYTICS_HTML
      .split('{{TITULO}}').join('📊 Meus números')
      .split('{{SUBTITULO}}').join('Seus resultados e desempenho')
      .split('{{VOLTAR_HREF}}').join('/meu-crm')
      .split('{{VOLTAR_TEXTO}}').join('← Voltar pro meu CRM');
    return res.send(html);
  }
  const html = ANALYTICS_HTML
    .split('{{TITULO}}').join('📊 Analytics')
    .split('{{SUBTITULO}}').join('Resultados e desempenho de todos os leads, corretores e canais')
    .split('{{VOLTAR_HREF}}').join('/crm')
    .split('{{VOLTAR_TEXTO}}').join('← Voltar pro CRM');
  res.send(html);
});

// ─── ROTA: CRM DA JULIANE ─────────────────────────────────────
app.get('/crm-juliane', basicAuthAdminOuSdr, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.send(JULIANE_HTML);
});

// ─── ROTA: CRM DO CORRETOR ────────────────────────────────────
app.get('/meu-crm', basicAuthAdminOuSdr, (req, res) => {
  res.set('Cache-Control', 'no-store');
  // Admin e Juliane podem "abrir" o CRM de qualquer corretor direto (sem
  // precisar da senha dele), passando ?corretor=Nome na URL — é o atalho
  // que a Juliane usa clicando no cabeçalho da coluna do corretor no
  // quadro dela. Login de corretor normal ignora isso e só vê o próprio.
  let nomeCorretor = req.corretorNome;
  if ((req.authTipo === 'admin' || req.authTipo === 'juliane') && req.query.corretor) {
    nomeCorretor = String(req.query.corretor);
  } else if (req.authTipo !== 'corretor') {
    return res.status(403).send('Essa página é só pra login de corretor (ou admin/Juliane passando ?corretor=Nome).');
  }
  const nomeMaiusculo = nomeCorretor.toUpperCase();
  res.send(CORRETOR_HTML.split('{{NOME_CORRETOR}}').join(nomeMaiusculo));
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

  // Backup automático diário — roda uma vez ao iniciar e depois a cada 24h.
  // Como o servidor pode reiniciar a qualquer hora (deploy), isso não é num
  // horário fixo do relógio, mas garante que nunca passa mais de ~24h sem backup.
  if (process.env.DATABASE_URL) {
    fazerBackupDiario().catch(err => console.error('Erro no backup inicial:', err));
    setInterval(() => {
      fazerBackupDiario().catch(err => console.error('Erro no backup automático:', err));
    }, 24 * 60 * 60 * 1000);
  }

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
