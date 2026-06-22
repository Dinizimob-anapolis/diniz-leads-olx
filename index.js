const express = require('express');
const app = express();
app.use(express.json());

// ─── CONFIGURAÇÕES ───────────────────────────────────────────
const EVOLUTION_URL = 'https://evolution-api-production-5e4f.up.railway.app';
const EVOLUTION_INSTANCE = 'diniz-leads-olx';
const EVOLUTION_TOKEN = 'A0929C1CF6C5-4E04-9FFB-3A4B073EE943';

// Corretores no revezamento (round-robin)
const CORRETORES = [
  { nome: 'Laís',   fone: '5562992754858' },
  { nome: 'Rubens', fone: '5562992502323' },
  { nome: 'Nalcio', fone: '5562982077466' },
];

// Índice do próximo corretor (persiste enquanto servidor estiver no ar)
let indexAtual = 0;

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

// ─── ROTA: WEBHOOK DO CANAL PRO ──────────────────────────────
app.post('/lead-canalpro', async (req, res) => {
  try {
    const body = req.body;
    console.log('Lead recebido:', JSON.stringify(body, null, 2));

    // Extrai dados do lead (formato Canal Pro / Grupo ZAP)
    const nomeCliente     = body?.lead?.name      || body?.name      || 'Não informado';
    const foneCliente     = body?.lead?.phone      || body?.phone     || 'Não informado';
    const emailCliente    = body?.lead?.email      || body?.email     || 'Não informado';
    const imovel          = body?.listing?.title   || body?.title     || 'Não informado';
    const linkImovel      = body?.listing?.url     || body?.url       || '';
    const mensagemCliente = body?.lead?.message    || body?.message   || '';

    // Seleciona corretor da vez (round-robin)
    const corretor = CORRETORES[indexAtual];
    indexAtual = (indexAtual + 1) % CORRETORES.length;

    // Monta mensagem no formato padrão Diniz Imóveis
    const texto = `Segue um lead que veio através do Canal Pro\n\n` +
      `CRM : ${imovel}\n` +
      (linkImovel ? `${linkImovel}\n` : '') +
      `Nome : ${nomeCliente}\n` +
      `${foneCliente}\n` +
      `${emailCliente}\n` +
      (mensagemCliente ? `OBS: ${mensagemCliente}\n` : `OBS: \n`) +
      `ENVIADO CORRETOR ${corretor.nome.toUpperCase()}`;

    // Envia para o corretor
    await enviarWhatsApp(corretor.fone, texto);

    console.log(`Lead enviado para ${corretor.nome} (${corretor.fone})`);
    res.status(200).json({ ok: true, corretor: corretor.nome });

  } catch (err) {
    console.error('Erro ao processar lead:', err);
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
