const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

// ─── CONFIGURAÇÕES ───────────────────────────────────────────
const EVOLUTION_URL = 'https://evolution-api-production-5e4f.up.railway.app';
const EVOLUTION_INSTANCE = 'diniz-leads-olx';
const EVOLUTION_TOKEN = 'A0929C1CF6C5-4E04-9FFB-3A4B073EE943';

const JULIANE_LL = '5562992160458'; // cópia venda + tráfego pago
const CYDA       = '5562993652226'; // aluguel

// Corretores no revezamento (round-robin) — apenas venda
const CORRETORES = [
  { nome: 'Laís',   fone: '5562992754858' },
  { nome: 'Nalcio', fone: '5562982077466' },
  { nome: 'Renata', fone: '5562992670935' },
];

// ─── ÍNDICE PERSISTENTE ──────────────────────────────────────
const INDEX_FILE = '/tmp/index.json';

function lerIndice() {
  try {
    const data = fs.readFileSync(INDEX_FILE, 'utf8');
    return JSON.parse(data).index || 0;
  } catch {
    return 0;
  }
}

function salvarIndice(index) {
  try {
    fs.writeFileSync(INDEX_FILE, JSON.stringify({ index }));
  } catch (e) {
    console.error('Erro ao salvar índice:', e);
  }
}

// ─── FUNÇÃO: ENVIAR MENSAGEM WHATSAPP ────────────────────────
async function enviarWhatsApp(fone, mensagem) {
  const res = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_TOKEN,
    },
    body: JSON.stringify({
      number: fone,
      text: mensagem,
    }),
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
      // Aluguel → Cyda
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

    // Venda → round-robin corretores
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

    // Cópia de controle para Juliane LL
    const textoControle =
      `✅ Lead de venda distribuído\n\n` +
      `CRM : ${codigoImovel}\n` +
      `Nome : ${nomeCliente}\n` +
      `${telefone}\n` +
      `Corretor: ${corretor.nome}`;

    await enviarWhatsApp(JULIANE_LL, textoControle);

    console.log(`Lead enviado para ${corretor.nome} (${corretor.fone})`);
    res.status(200).json({ ok: true, corretor: corretor.nome });

  } catch (err) {
    console.error('Erro ao processar lead:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA: ESPELHO DE MENSAGENS (TRÁFEGO PAGO / OUTRAS) ──────
app.post('/webhook-mensagens', async (req, res) => {
  try {
    const body = req.body;
    console.log('Webhook mensagem recebido:', JSON.stringify(body, null, 2));

    const tipo = (body?.event || body?.type || '').toLowerCase();

    // Ignora eventos que não são de mensagens recebidas
    if (!tipo.includes('message')) {
      return res.status(200).json({ ok: true });
    }

    // Ignora mensagens enviadas pelo próprio número
    const fromMe = body?.data?.key?.fromMe || body?.key?.fromMe || false;
    if (fromMe) return res.status(200).json({ ok: true });

    const de = (body?.data?.key?.remoteJid || body?.key?.remoteJid || 'Desconhecido').replace('@s.whatsapp.net', '').replace('@c.us', '');
    const msg = body?.data?.message || body?.message || {};
    const conteudo = msg?.conversation || msg?.extendedTextMessage?.text || msg?.imageMessage?.caption || '[mídia ou outro tipo]';

    const texto =
      `📱 Nova mensagem recebida\n\n` +
      `De: ${de}\n` +
      `Mensagem: ${conteudo}`;

    await enviarWhatsApp(JULIANE_LL, texto);

    console.log(`Mensagem espelhada de ${de} para Juliane LL`);
    res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Erro ao espelhar mensagem:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── ROTA DE TESTE ───────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('✅ Diniz Leads OLX rodando!');
});

// ─── INICIA SERVIDOR ─────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
