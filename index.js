const express = require('express');
const fs = require('fs');
const { Pool } = require('pg');
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
const CAMPOS_EDITAVEIS = ['origem', 'corretor', 'interesse', 'status', 'visita', 'proposta', 'venda'];

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
      ADD COLUMN IF NOT EXISTS visita BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS proposta BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS venda BOOLEAN DEFAULT false;
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

  let whatsappNormalizado = whatsappMatch[0].replace(/\D/g, '');
  if (whatsappNormalizado.length <= 11) whatsappNormalizado = '55' + whatsappNormalizado;

  return {
    nome: nomeMatch ? nomeMatch[1].trim() : 'Sem nome',
    email: emailMatch ? emailMatch[0] : null,
    whatsapp: whatsappNormalizado,
    corretor: corretorMatch[1].trim(),
    origem: origemMatch ? origemMatch[1].trim() : null,
    imovelCodigo,
    imovelDesc,
  };
}

// origemPadrao: usada só se a mensagem em si não tiver a origem escrita (dados.origem).
// Prioridade: origem escrita na própria mensagem > origem padrão do canal > pendente (null)
async function salvarDistribuicao(dados, origemPadrao = null) {
  const origem = dados.origem || origemPadrao || null;
  await pool.query(
    `INSERT INTO leads (whatsapp, nome, email, corretor, imovel_codigo, imovel_desc, origem)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (whatsapp) DO UPDATE SET
       nome = EXCLUDED.nome,
       email = EXCLUDED.email,
       corretor = EXCLUDED.corretor,
       imovel_codigo = EXCLUDED.imovel_codigo,
       imovel_desc = EXCLUDED.imovel_desc,
       origem = COALESCE(leads.origem, EXCLUDED.origem),
       distribuido_em = now(),
       contatou = false,
       primeiro_contato_em = NULL,
       avisado_em = NULL`,
    [dados.whatsapp, dados.nome, dados.email, dados.corretor, dados.imovelCodigo, dados.imovelDesc, origem]
  );
  console.log(`Lead distribuído salvo: ${dados.nome} → ${dados.corretor} (${dados.whatsapp}) [origem: ${origem || 'pendente'}]`);
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
      let whatsappNormalizado = telefone.replace(/\D/g, '');
      if (whatsappNormalizado.length <= 11) whatsappNormalizado = '55' + whatsappNormalizado;
      await salvarDistribuicao({
        whatsapp: whatsappNormalizado,
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

    const de = jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
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

    const de = jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
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
              origem, interesse, status, ultimo_contato, visita, proposta, venda
       FROM leads
       ORDER BY distribuido_em DESC
       LIMIT 100`
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
        semCorretor24h: parseInt(semCorretor24hResult.rows[0].total, 10) || 0,
        tempoMedioContatoSegundos: statsResult.rows[0].tempo_medio_contato
          ? Math.round(statsResult.rows[0].tempo_medio_contato.hours * 3600
              + statsResult.rows[0].tempo_medio_contato.minutes * 60
              + (statsResult.rows[0].tempo_medio_contato.seconds || 0))
          : null,
      },
      porCorretor: porCorretorResult.rows,
      porCampanha: porCampanhaResult.rows,
      porOrigem: porOrigemResult.rows,
      corretoresDisponiveis: [...CORRETORES.map(c => c.nome), ...CORRETORES_EXTRA_DASHBOARD],
    });
  } catch (err) {
    console.error('Erro ao buscar leads:', err);
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

  let whatsappNormalizado = String(whatsapp).replace(/\D/g, '');
  if (whatsappNormalizado.length <= 11) whatsappNormalizado = '55' + whatsappNormalizado;

  try {
    const result = await pool.query(
      `INSERT INTO leads (whatsapp, nome, corretor, imovel_desc, origem)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [whatsappNormalizado, nome, corretor, imovelDesc || null, origem || null]
    );
    console.log(`Lead adicionado manualmente: ${nome} → ${corretor} (${whatsappNormalizado})`);
    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, erro: 'Já existe um lead com esse WhatsApp' });
    }
    console.error('Erro ao adicionar lead manual:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: ATRIBUIR CORRETOR A NÚMERO NÃO IDENTIFICADO ───────
// Ao definir um corretor, o contato "sobe de nível": vira um lead completo
// (com Origem, Status, Visita, Proposta, Venda editáveis) e some da lista
// de não identificados.
app.patch('/api/leads-nao-identificados/:id', basicAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, erro: 'DATABASE_URL não configurada' });
  }
  const { id } = req.params;
  const { corretor } = req.body;

  try {
    if (!corretor) {
      // Corretor removido/limpo — só atualiza o campo, continua como não identificado
      await pool.query(`UPDATE leads_nao_identificados SET corretor = NULL WHERE id = $1`, [id]);
      return res.json({ ok: true, promovido: false });
    }

    const naoIdentResult = await pool.query('SELECT whatsapp, mensagem FROM leads_nao_identificados WHERE id = $1', [id]);
    if (naoIdentResult.rows.length === 0) {
      return res.status(404).json({ ok: false, erro: 'Não encontrado' });
    }
    const { whatsapp, mensagem } = naoIdentResult.rows[0];

    await pool.query(
      `INSERT INTO leads (whatsapp, nome, corretor, interesse)
       VALUES ($1, 'Sem nome', $2, $3)
       ON CONFLICT (whatsapp) DO UPDATE SET corretor = EXCLUDED.corretor`,
      [whatsapp, corretor, mensagem || null]
    );
    await pool.query('DELETE FROM leads_nao_identificados WHERE id = $1', [id]);

    console.log(`Contato promovido a lead: ${whatsapp} → ${corretor}`);
    res.json({ ok: true, promovido: true });
  } catch (err) {
    console.error('Erro ao atribuir corretor:', err);
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
});
