const CRM_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CRM - SDR</title>
<style>
  :root {
    --bg: #f7f8fb;
    --card: #ffffff;
    --card-border: #e6e8ef;
    --text: #1f2430;
    --muted: #767c8c;
    --accent: #4f6cff;
    --warn-bg: #fff2df;
    --warn-border: #f2a93b;
    --warn-text: #b5720a;
    --ok: #17a869;
    --radius: 12px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f2f3f8;
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 14px;
    overflow-x: hidden;
  }
  h1 { font-size: 21px; margin: 0 0 4px; }
  .sub { color: var(--muted); font-size: 13px; margin-bottom: 14px; }

  .toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
  }
  input[type="text"] {
    background: #fff;
    border: 1px solid var(--card-border);
    color: var(--text);
    padding: 9px 13px;
    border-radius: var(--radius);
    font-size: 14px;
    flex: 1;
  }
  input[type="text"]:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  .add-contato-btn {
    background: var(--accent);
    color: #fff;
    border: none;
    padding: 9px 18px;
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(79,108,255,0.35);
  }

  .stats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  .stat {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    padding: 9px 14px;
    font-size: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .stat .num { font-size: 17px; font-weight: 800; margin-right: 4px; }

  .board {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding: 6px 6px 22px 6px;
    -webkit-overflow-scrolling: touch;
  }
  .column {
    border-radius: var(--radius);
    min-width: 258px;
    max-width: 258px;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 200px);
    border: none;
    box-shadow:
      0 1px 2px rgba(20,20,40,0.04),
      0 10px 24px -6px rgba(20,20,40,0.16),
      0 4px 10px -4px rgba(20,20,40,0.10);
    transform: translateY(0);
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }
  .column:hover {
    transform: translateY(-5px);
    box-shadow:
      0 2px 4px rgba(20,20,40,0.05),
      0 20px 34px -8px rgba(20,20,40,0.22),
      0 8px 16px -4px rgba(20,20,40,0.14);
  }
  .column.dragover { outline: 2px dashed rgba(0,0,0,0.25); outline-offset: -4px; }
  .column-header {
    padding: 11px 13px;
    font-size: 13px;
    font-weight: 800;
    display: block;
    position: sticky;
    top: 0;
    border-radius: var(--radius) var(--radius) 0 0;
  }
  .column-count {
    background: rgba(255,255,255,0.55);
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 10px;
    font-weight: 700;
  }
  .lupa-filtro-btn {
    background: rgba(255,255,255,0.25);
    border: none;
    border-radius: 6px;
    width: 24px;
    height: 24px;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lupa-filtro-btn.ativa {
    background: #fff;
    box-shadow: 0 0 0 2px rgba(255,255,255,0.5);
  }
  .filtro-data-painel {
    background: #fff8e8;
    border-bottom: 1px solid var(--card-border);
    padding: 8px 9px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .filtro-data-painel label {
    font-size: 10px;
    color: var(--muted);
    font-weight: 700;
    margin: 0;
  }
  .filtro-data-painel input[type="date"] {
    font-size: 11px;
    padding: 3px 5px;
    border: 1px solid var(--card-border);
    border-radius: 6px;
    flex: 1;
    min-width: 90px;
  }
  .limpar-filtro-btn {
    font-size: 10px;
    font-weight: 700;
    color: #e0453f;
    background: none;
    border: 1px solid #e0453f;
    border-radius: 6px;
    padding: 3px 8px;
    cursor: pointer;
    width: 100%;
  }
  .column-cards {
    overflow-y: auto;
    padding: 9px;
    display: flex;
    flex-direction: column;
    gap: 9px;
    flex: 1;
    background: #ffffff;
    border-radius: 0 0 var(--radius) var(--radius);
  }

  .lead {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-left: 4px solid transparent;
    border-radius: 10px;
    padding: 11px;
    cursor: grab;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    position: relative;
  }
  .lead:active { cursor: grabbing; }
  .lead.dragging { opacity: 0.4; }
  .lead.reaquecer { border-color: var(--warn-border); background: linear-gradient(180deg, var(--warn-bg), var(--card) 32px); }
  .lead.atrasado { border-color: #e0453f !important; background: linear-gradient(180deg, #fdecec, var(--card) 32px); box-shadow: 0 0 0 2px #e0453f33; }
  .lead.cliente-ouro { border-color: #d4a017 !important; background: linear-gradient(180deg, #ffe58a, var(--card) 90px); box-shadow: 0 0 0 3px #f2c94c; }
  .btn-ouro {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #f4f4f6;
    border: 1px solid var(--card-border);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: grayscale(1);
    opacity: 0.55;
  }
  .btn-ouro.ativo { background: #fff3c4; border-color: #f2c94c; filter: none; opacity: 1; }
  .btn-ouro.modal-versao { position: static; display: inline-flex; margin-left: 6px; vertical-align: middle; }
  .lead.recem-adicionado { animation: pulso 1.6s ease-in-out 2; }
  @keyframes pulso {
    0%, 100% { box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    50% { box-shadow: 0 0 0 3px var(--warn-border); }
  }
  .alerta-atrasadas {
    background: #e0453f;
    color: #fff;
    font-weight: 800;
    font-size: 14px;
    text-align: center;
    padding: 10px 14px;
    border-radius: 10px;
    margin-bottom: 12px;
    animation: piscar-alerta 1.1s ease-in-out infinite;
  }
  @keyframes piscar-alerta {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }
  .lead-nome { font-size: 13px; font-weight: 700; }
  .lead-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 10px;
    margin-top: 6px;
    margin-right: 4px;
  }
  .badge.warn { background: var(--warn-bg); color: var(--warn-text); border: 1px solid var(--warn-border); }
  .badge.origem { background: #eef0f6; color: var(--muted); border: 1px solid var(--card-border); }

  .lead-notas {
    margin-top: 8px;
    font-size: 11px;
    color: var(--muted);
    background: #f4f5f9;
    border-radius: 6px;
    padding: 6px 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tarefa-preview {
    margin-top: 6px;
    font-size: 11px;
    font-weight: 700;
    color: var(--warn-text);
  }

  .overlay {
    display: none;
    position: fixed; inset: 0;
    background: rgba(20,20,30,0.45);
    align-items: center;
    justify-content: center;
    z-index: 50;
    padding: 16px;
  }
  .overlay.show { display: flex; }
  .modal {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    padding: 20px;
    width: 100%;
    max-width: 420px;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  }
  .modal h2 { font-size: 17px; margin: 0 0 4px; }
  .modal .lead-meta { margin-bottom: 10px; }
  .modal label { font-size: 12px; color: var(--muted); font-weight: 700; display: block; margin: 12px 0 4px; }
  select, textarea {
    background: #fff;
    border: 1px solid var(--card-border);
    color: var(--text);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    font-family: inherit;
    width: 100%;
  }
  textarea { min-height: 70px; resize: vertical; }
  .modal-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
  .wa-btn {
    background: #e3f8ee;
    color: #128a55;
    border: 1px solid #a8ecca;
    padding: 8px 15px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }
  .primary-btn {
    background: var(--accent);
    color: #fff;
    border: none;
    padding: 9px 18px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .close-btn {
    background: #fff;
    border: 1px solid var(--card-border);
    color: var(--muted);
    padding: 8px 15px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .saved-flash { color: var(--ok); font-size: 11px; font-weight: 700; margin-left: 8px; opacity: 0; transition: opacity .3s; }
  .saved-flash.show { opacity: 1; }
  .flash-salvo-grande {
    position: fixed;
    top: 22px;
    left: 50%;
    transform: translateX(-50%) translateY(-16px);
    background: #17a34a;
    color: #fff;
    font-weight: 800;
    font-size: 16px;
    padding: 14px 28px;
    border-radius: 12px;
    box-shadow: 0 10px 28px rgba(23,163,74,0.4);
    z-index: 200;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .flash-salvo-grande.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  .aviso-modal {
    font-size: 12px;
    border-radius: 8px;
    padding: 9px 11px;
    margin-top: 10px;
    font-weight: 600;
  }
  .aviso-modal.warn { background: var(--warn-bg); color: var(--warn-text); border: 1px solid var(--warn-border); }
  .aviso-modal.ok { background: #e3f8ee; color: #128a55; border: 1px solid #a8ecca; }

  .chip-corretor {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px 3px 10px;
    border-radius: 12px;
    border: 1px solid;
    margin-right: 6px;
    margin-bottom: 6px;
  }
  .chip-corretor button {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 0 0 0 2px;
    opacity: 0.7;
  }
  .chip-add {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #eef0f6;
    color: var(--text);
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: 800;
    vertical-align: middle;
  }
</style>
</head>
<body>

<h1>CRM - SDR</h1>
<div class="sub">Arraste o cartão entre as colunas pra mudar o status. Toque num cartão pra ver detalhes e notas.</div>

<div id="alerta-atrasadas" class="alerta-atrasadas" style="display:none;"></div>

<div class="stats" id="stats"></div>

<div class="toolbar">
  <input type="text" id="busca" placeholder="Buscar por nome ou WhatsApp...">
  <button class="add-contato-btn" id="btn-atualizar" style="background:#fff;color:var(--accent);border:1px solid var(--accent);box-shadow:none;">↻ Atualizar</button>
  <button class="add-contato-btn" id="btn-salvar-backup" style="background:#fff;color:#17a34a;border:1px solid #17a34a;box-shadow:none;">💾 Salvar backup</button>
  <button class="add-contato-btn" id="btn-baixar-csv" style="background:#fff;color:#3b6cf0;border:1px solid #3b6cf0;box-shadow:none;">⬇️ Baixar planilha</button>
  <button class="add-contato-btn" id="btn-adicionar">+ Adicionar contato</button>
</div>

<div class="board" id="board"></div>

<div class="overlay" id="overlay">
  <div class="modal" id="modal"></div>
</div>

<script>
let TODOS_LEADS = [];

// Opções de canal/origem pra quando alguém adiciona um contato manualmente.
const ORIGENS = ['OLX/Canal Pro', 'Patrocinado', 'TikTok', 'Instagram', 'Comentário', 'Indicação', 'SDR', 'Outro'];
let BUSCA = '';
let LEAD_ARRASTADO = null;
let ULTIMO_ADICIONADO_ID = null;
let FILTROS_DATA_COLUNA = {}; // { [coluna]: { de, ate } } — filtro de período por coluna
let COLUNA_FILTRO_ABERTA = null; // qual coluna está com o painel de data aberto agora

function dataDoLeadParaFiltro(lead) {
  return lead.status_alterado_em || lead.distribuido_em;
}

function leadPassaNoFiltroDeData(lead, coluna) {
  const filtro = FILTROS_DATA_COLUNA[coluna];
  if (!filtro || (!filtro.de && !filtro.ate)) return true;
  const dataLead = dataDoLeadParaFiltro(lead);
  if (!dataLead) return false;
  const dia = String(dataLead).slice(0, 10);
  if (filtro.de && dia < filtro.de) return false;
  if (filtro.ate && dia > filtro.ate) return false;
  return true;
}

function alternarFiltroData(coluna) {
  COLUNA_FILTRO_ABERTA = COLUNA_FILTRO_ABERTA === coluna ? null : coluna;
  render();
}

function definirFiltroData(coluna, campo, valor) {
  if (!FILTROS_DATA_COLUNA[coluna]) FILTROS_DATA_COLUNA[coluna] = { de: '', ate: '' };
  FILTROS_DATA_COLUNA[coluna][campo] = valor;
  render();
}

function limparFiltroData(coluna) {
  delete FILTROS_DATA_COLUNA[coluna];
  COLUNA_FILTRO_ABERTA = null;
  render();
}

const COLUNAS = ['Novo', 'Reaquecendo', 'Aguardando retorno', 'Repassado ao corretor', 'Visita agendada', 'Compra futura', 'Já comprou', 'Venda efetuada', 'Sem retorno'];

// Paleta viva, uma cor por coluna — usada no cabeçalho e na barrinha
// lateral de cada cartão daquela coluna.
const CORES_COLUNA = {
  'Novo':                   { header: '#3b6cf0', accent: '#3b6cf0', texto: '#ffffff' },
  'Reaquecendo':            { header: '#f2941c', accent: '#f2941c', texto: '#ffffff' },
  'Aguardando retorno':     { header: '#9b4de0', accent: '#9b4de0', texto: '#ffffff' },
  'Visita agendada':        { header: '#0aa5c2', accent: '#0aa5c2', texto: '#ffffff' },
  'Repassado ao corretor':  { header: '#e8479e', accent: '#e8479e', texto: '#ffffff' },
  'Compra futura':          { header: '#5b6bf5', accent: '#5b6bf5', texto: '#ffffff' },
  'Já comprou':             { header: '#c9a20a', accent: '#c9a20a', texto: '#ffffff' },
  'Sem retorno':            { header: '#6b7280', accent: '#6b7280', texto: '#ffffff' },
  'Venda efetuada':         { header: '#17a34a', accent: '#17a34a', texto: '#ffffff' },
};

function statusDoLead(lead) {
  return COLUNAS.includes(lead.status) ? lead.status : 'Novo';
}

function temHistoricoDuplicado(lead) {
  return !!(lead.outros_corretores && lead.outros_corretores.trim());
}

function corretoresEnvolvidos(lead) {
  const lista = [];
  if (lead.corretor) lista.push(lead.corretor);
  if (lead.outros_corretores) {
    lead.outros_corretores.split(',').map(s => s.trim()).filter(Boolean).forEach(c => {
      if (!lista.includes(c)) lista.push(c);
    });
  }
  return lista;
}

const PALETA_CORES = ['#3b6cf0', '#e0453f', '#f2941c', '#12b76a', '#9b4de0', '#e8479e', '#0aa5c2', '#c9a20a'];
const NOMES_OFICIAIS_CORRETORES = ['Junior', 'Laís', 'Patricia', 'Michelle', 'Nalcio', 'Renata', 'Bruno', 'Juliane', 'Amanda', 'Cyda'];
function normalizarNomeCorretor(nomeDigitado) {
  const chave = (nomeDigitado || '').trim();
  if (!chave) return chave;
  const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const alvo = semAcento(chave);
  const oficial = NOMES_OFICIAIS_CORRETORES.find(n => semAcento(n) === alvo);
  return oficial || chave;
}

// O código do imóvel guarda coisas diferentes conforme a origem: pra
// OLX/Canal Pro é o número do CRM de verdade; pra Patrocinado (Insta/Face)
// é um código tipo "VD01" que é parte do NOME do imóvel, não um CRM — por
// isso junta com o nome em vez de rotular como CRM nesse caso.
function badgeImovel(lead) {
  if (!lead.imovel_desc && !lead.imovel_codigo) return '';
  if (lead.origem === 'OLX/Canal Pro') {
    return \`\${lead.imovel_desc ? \`<span class="badge" style="background:#f3ecff;color:#7c3aed;border:1px solid #ddd0fb;">🏠 \${lead.imovel_desc}</span>\` : ''}\${lead.imovel_codigo ? \`<span class="badge" style="background:#eef6ff;color:#0b6bcb;border:1px solid #bfe0fb;">CRM: \${lead.imovel_codigo}</span>\` : ''}\`;
  }
  const nomeCompleto = [lead.imovel_codigo, lead.imovel_desc].filter(Boolean).join(' - ');
  return \`<span class="badge" style="background:#f3ecff;color:#7c3aed;border:1px solid #ddd0fb;">🏠 \${nomeCompleto}</span>\`;
}

function corDoCorretor(nome) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
  return PALETA_CORES[hash % PALETA_CORES.length];
}

function corretoresRepassadosLista(lead) {
  return (lead.corretores_repassados || '').split(',').map(s => s.trim()).filter(Boolean);
}

function renderChipsCorretores(lead) {
  const lista = corretoresRepassadosLista(lead);
  return lista.map(nome => {
    const cor = corDoCorretor(nome);
    return \`<span class="chip-corretor" style="border-color:\${cor};color:\${cor};background:\${cor}1a">\${nome}<button data-nome="\${nome}" class="chip-remove">×</button></span>\`;
  }).join('') + \`<button class="chip-add" id="add-corretor-btn" type="button">+</button>\`;
}

// Faixa vermelha piscando no topo — avisa quando tem tarefa atrasada, sem
// precisar recarregar os dados (a data já está nos leads carregados).
function atualizarAlertaAtrasadas() {
  const el = document.getElementById('alerta-atrasadas');
  if (!el) return;
  const agora = new Date();
  // Só conta tarefa atrasada de lead que ainda é ativamente da SDR — assim
  // que ela repassa pro corretor (carteira_sdr vira false), a tarefa deixa
  // de ser problema dela e não precisa mais aparecer nesse alerta.
  const atrasadas = TODOS_LEADS.filter(l => l.carteira_sdr && l.tarefa_data && new Date(l.tarefa_data) <= agora).length;
  if (atrasadas > 0) {
    el.style.display = 'block';
    el.textContent = \`⏰ Você tem \${atrasadas} tarefa\${atrasadas > 1 ? 's' : ''} atrasada\${atrasadas > 1 ? 's' : ''}!\`;
  } else {
    el.style.display = 'none';
  }
}
setInterval(atualizarAlertaAtrasadas, 60000);

async function carregar() {
  try {
    const res = await fetch('/api/leads/carteira-sdr', { cache: 'no-store' });
    const data = await res.json();
    TODOS_LEADS = data.leads || data || [];
    render();
  } catch (err) {
    document.getElementById('board').innerHTML = '<div style="color:var(--muted);padding:20px;">Erro ao carregar leads. Recarregue a página.</div>';
  }
}

function leadsFiltrados() {
  if (!BUSCA) return TODOS_LEADS;
  const b = BUSCA.toLowerCase();
  return TODOS_LEADS.filter(l => (l.nome || '').toLowerCase().includes(b) || (l.whatsapp || '').includes(b));
}

// Monta o CSV só com o que está realmente visível na tela agora (busca +
// filtro de data por coluna), não com a carteira inteira.
function exportarCSV() {
  const leads = leadsFiltrados().filter(l => leadPassaNoFiltroDeData(l, statusDoLead(l)));
  const cabecalho = ['Nome', 'WhatsApp', 'Status', 'Origem', 'Imóvel', 'Corretor', 'Valor do imóvel', 'Tarefa', 'Prazo da tarefa', 'Notas', 'Buscando', 'Chegou em'];
  const linhas = leads.map(l => [
    l.nome || '', l.whatsapp || '', statusDoLead(l), l.origem || '', l.imovel_desc || '',
    l.corretor || '', l.valor_imovel_sdr || '', l.tarefa_sdr || '',
    l.tarefa_data ? new Date(l.tarefa_data).toLocaleString('pt-BR') : '',
    (l.notas_sdr || '').replace(/\\n/g, ' '), (l.buscando_sdr || '').replace(/\\n/g, ' '),
    l.distribuido_em ? new Date(l.distribuido_em).toLocaleDateString('pt-BR') : ''
  ]);
  const escapar = v => \`"\${String(v).replace(/"/g, '""')}"\`;
  const csv = [cabecalho, ...linhas].map(linha => linha.map(escapar).join(';')).join('\\r\\n');
  const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = \`crm-sdr-\${new Date().toISOString().slice(0, 10)}.csv\`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function render() {
  const leads = leadsFiltrados();
  const reaquecerCount = TODOS_LEADS.filter(temHistoricoDuplicado).length;

  const vgvTotal = TODOS_LEADS.reduce((soma, lead) => soma + parseValorImovel(lead.valor_imovel_sdr), 0);

  atualizarAlertaAtrasadas();

  document.getElementById('stats').innerHTML = \`
    <div class="stat"><span class="num">\${TODOS_LEADS.length}</span>na carteira</div>
    <div class="stat" style="color:#b5720a"><span class="num">\${reaquecerCount}</span>pra reaquecer</div>
    \${vgvTotal > 0 ? \`<div class="stat" style="color:#17a34a"><span class="num">\${formatarReais(vgvTotal)}</span>VGV total</div>\` : ''}
  \`;

  const board = document.getElementById('board');
  board.innerHTML = COLUNAS.map(coluna => {
    const leadsColunaSemFiltro = leads.filter(l => statusDoLead(l) === coluna);
    const leadsColuna = leadsColunaSemFiltro.filter(l => leadPassaNoFiltroDeData(l, coluna));
    const cor = CORES_COLUNA[coluna];
    const vgvColuna = leadsColuna.reduce((soma, lead) => soma + parseValorImovel(lead.valor_imovel_sdr), 0);
    const filtroAtivo = FILTROS_DATA_COLUNA[coluna] && (FILTROS_DATA_COLUNA[coluna].de || FILTROS_DATA_COLUNA[coluna].ate);
    const painelAberto = COLUNA_FILTRO_ABERTA === coluna;
    return \`
      <div class="column" data-coluna="\${coluna}">
        <div class="column-header" style="background:\${cor.header};color:\${cor.texto}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <span>\${coluna}</span>
            <div style="display:flex;align-items:center;gap:4px;">
              <button class="lupa-filtro-btn \${filtroAtivo ? 'ativa' : ''}" title="Filtrar por período" onclick="alternarFiltroData('\${coluna}')">🔍</button>
              <span class="column-count">\${leadsColuna.length}\${filtroAtivo ? \`/\${leadsColunaSemFiltro.length}\` : ''}</span>
            </div>
          </div>
          \${vgvColuna > 0 ? \`<div style="font-size:11px;font-weight:700;opacity:0.95;margin-top:2px;">\${formatarReais(vgvColuna)}</div>\` : ''}
        </div>
        \${painelAberto ? \`
          <div class="filtro-data-painel">
            <label>De</label>
            <input type="date" value="\${(FILTROS_DATA_COLUNA[coluna] && FILTROS_DATA_COLUNA[coluna].de) || ''}" onchange="definirFiltroData('\${coluna}', 'de', this.value)">
            <label>Até</label>
            <input type="date" value="\${(FILTROS_DATA_COLUNA[coluna] && FILTROS_DATA_COLUNA[coluna].ate) || ''}" onchange="definirFiltroData('\${coluna}', 'ate', this.value)">
            \${filtroAtivo ? \`<button class="limpar-filtro-btn" onclick="limparFiltroData('\${coluna}')">Limpar</button>\` : ''}
          </div>
        \` : ''}
        <div class="column-cards" data-coluna="\${coluna}">
          \${leadsColuna.map(lead => cardHtml(lead, cor.accent)).join('') || (leadsColunaSemFiltro.length > 0 ? '<div style="text-align:center;color:var(--muted);font-size:12px;padding:12px;">Nenhum nesse período</div>' : '')}
        </div>
      </div>
    \`;
  }).join('');

  board.querySelectorAll('.lead').forEach(el => {
    el.addEventListener('dragstart', e => {
      LEAD_ARRASTADO = el.dataset.id;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.addEventListener('click', () => abrirModalLead(el.dataset.id));
  });

  board.querySelectorAll('.column-cards').forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      col.closest('.column').classList.add('dragover');
    });
    col.addEventListener('dragleave', () => col.closest('.column').classList.remove('dragover'));
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.closest('.column').classList.remove('dragover');
      if (LEAD_ARRASTADO) {
        const novoStatus = col.dataset.coluna;
        salvarCampo(LEAD_ARRASTADO, 'status', novoStatus, () => { render(); });
        LEAD_ARRASTADO = null;
      }
    });
  });

  if (ULTIMO_ADICIONADO_ID) {
    const cardNovo = board.querySelector(\`.lead[data-id="\${ULTIMO_ADICIONADO_ID}"]\`);
    if (cardNovo) {
      cardNovo.classList.add('recem-adicionado');
      cardNovo.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    ULTIMO_ADICIONADO_ID = null;
  }
}

function formatarData(dataStr) {
  if (!dataStr) return null;
  const d = new Date(dataStr);
  if (isNaN(d)) return null;
  return d.toLocaleDateString('pt-BR');
}

// Entende valores digitados livremente: "R$ 350.000", "350 mil", "1,2 milhão"...
function parseValorImovel(texto) {
  if (!texto) return 0;
  let s = String(texto).toLowerCase().replace(/r\\$/g, '').trim();
  let multiplicador = 1;
  if (/milh(a|ã)o|milh(o|õ)es|\\bmi\\b/.test(s)) {
    multiplicador = 1000000;
    s = s.replace(/milh(a|ã)o|milh(o|õ)es|\\bmi\\b/g, '');
  } else if (/\\bmil\\b/.test(s)) {
    multiplicador = 1000;
    s = s.replace(/\\bmil\\b/g, '');
  }
  s = s.replace(/[^\\d.,]/g, '').trim();
  if (!s) return 0;
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    const partes = s.split(',');
    s = (partes[1] && partes[1].length <= 2) ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes('.')) {
    const partes = s.split('.');
    if (partes.length > 1 && partes[partes.length - 1].length === 3) s = s.replace(/\\./g, '');
  }
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num * multiplicador;
}

function formatarReais(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cardHtml(lead, corBorda) {
  const duplicado = temHistoricoDuplicado(lead);
  const envolvidos = corretoresEnvolvidos(lead);
  const chipsRepassados = corretoresRepassadosLista(lead);
  const dataEtapa = formatarData(lead.status_alterado_em || lead.distribuido_em);
  const tarefaAtrasada = !!(lead.tarefa_data && new Date(lead.tarefa_data) <= new Date());
  const classeDestaque = \`\${tarefaAtrasada ? 'atrasado' : (duplicado ? 'reaquecer' : '')} \${lead.cliente_ouro ? 'cliente-ouro' : ''}\`.trim();
  const botaoOuro = \`<button class="btn-ouro modal-versao \${lead.cliente_ouro ? 'ativo' : ''}" onclick="event.stopPropagation();alternarClienteOuro('\${lead.id}', \${!lead.cliente_ouro})" title="\${lead.cliente_ouro ? 'Cliente Ouro — clique pra desmarcar' : 'Marcar como Cliente Ouro'}">⭐</button>\`;
  return \`
    <div class="lead \${classeDestaque}" draggable="true" data-id="\${lead.id}" style="\${classeDestaque.includes('atrasado') || classeDestaque.includes('reaquecer') ? '' : \`border-left-color:\${corBorda}\`}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
        <div class="lead-nome">\${lead.nome || 'Sem nome'}\${botaoOuro}</div>
        \${lead.valor_imovel_sdr ? \`<span style="font-size:10px;font-weight:700;color:#17a34a;white-space:nowrap;">💰 \${lead.valor_imovel_sdr}</span>\` : ''}
      </div>
      <div class="lead-meta">\${lead.whatsapp || 'sem WhatsApp'}</div>
      \${dataEtapa ? \`<div class="lead-meta">Nessa etapa desde \${dataEtapa}</div>\` : ''}
      \${lead.origem ? \`<span class="badge origem">\${lead.origem}</span>\` : ''}
      \${badgeImovel(lead)}
      \${duplicado ? \`<span class="badge warn">⚠️ \${envolvidos.length}: \${envolvidos.join(', ')}</span>\` : ''}
      \${lead.corretor ? \`<div><span class="chip-corretor" style="border-color:\${corDoCorretor(lead.corretor)};color:\${corDoCorretor(lead.corretor)};background:\${corDoCorretor(lead.corretor)}1a">\${lead.corretor}</span></div>\` : ''}
      \${lead.tarefa_sdr ? \`<div class="tarefa-preview" style="\${tarefaAtrasada ? 'color:#e0453f;' : ''}">\${tarefaAtrasada ? '⏰ ATRASADO — ' : '📌 '}\${lead.tarefa_sdr}\${lead.tarefa_data ? \` (\${new Date(lead.tarefa_data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})\` : ''}</div>\` : ''}
      \${lead.ultima_atualizacao_sdr ? \`<div class="tarefa-preview" style="color:var(--muted);font-weight:600;">🗓️ Atualizado até \${formatarData(lead.ultima_atualizacao_sdr)}</div>\` : ''}
      \${lead.notas_sdr ? \`<div class="lead-notas">\${lead.notas_sdr.split('\\n')[0]}</div>\` : ''}
      \${lead.buscando_sdr ? \`<div class="lead-notas" style="color:#5b6bf5;font-weight:600;">🔎 \${lead.buscando_sdr.split('\\n')[0]}</div>\` : ''}
    </div>
  \`;
}

function abrirModalLead(id) {
  const lead = TODOS_LEADS.find(l => String(l.id) === String(id));
  if (!lead) return;
  const duplicado = temHistoricoDuplicado(lead);
  const envolvidos = corretoresEnvolvidos(lead);
  const data = lead.distribuido_em ? new Date(lead.distribuido_em).toLocaleDateString('pt-BR') : '—';
  const waLink = lead.whatsapp ? \`https://wa.me/\${lead.whatsapp}\` : null;

  document.getElementById('modal').innerHTML = \`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
      <h2>\${lead.nome || 'Sem nome'}<button class="btn-ouro modal-versao \${lead.cliente_ouro ? 'ativo' : ''}" onclick="alternarClienteOuro('\${lead.id}', \${!lead.cliente_ouro})" title="\${lead.cliente_ouro ? 'Cliente Ouro — clique pra desmarcar' : 'Marcar como Cliente Ouro'}">⭐</button></h2>
      <span id="badge-valor-imovel">\${lead.valor_imovel_sdr ? \`<span class="badge" style="background:#eafcea;color:#17a34a;border:1px solid #a8ecca;white-space:nowrap;">💰 \${lead.valor_imovel_sdr}</span>\` : ''}</span>
    </div>
    <div class="lead-meta">\${lead.whatsapp || 'sem WhatsApp'} · chegou em \${data}</div>
    \${lead.origem ? \`<span class="badge origem">\${lead.origem}</span>\` : ''}
      \${badgeImovel(lead)}
    \${duplicado ? \`<span class="badge warn">⚠️ Já foi para \${envolvidos.length}: \${envolvidos.join(', ')} — não reenvie, reaqueça direto</span>\` : (lead.corretor ? \`<span class="badge origem">Corretor: \${lead.corretor}</span>\` : '')}

    <label>Status</label>
    <select id="modal-status">
      \${COLUNAS.map(c => \`<option value="\${c}" \${statusDoLead(lead) === c ? 'selected' : ''}>\${c}</option>\`).join('')}
    </select>
    \${lead.status_alterado_em ? \`<div class="lead-meta" style="margin-top:4px;">Nessa etapa desde \${formatarData(lead.status_alterado_em)}</div>\` : ''}

    <label>Corretor</label>
    <select id="modal-corretor">
      <option value="" \${!lead.corretor ? 'selected' : ''}>— Repassado ao corretor (sem corretor ainda) —</option>
      \${NOMES_OFICIAIS_CORRETORES.map(c => \`<option value="\${c}" \${lead.corretor === c ? 'selected' : ''}>\${c}</option>\`).join('')}
    </select>
    \${lead.corretor ? \`<div style="margin-top:6px;"><span class="chip-corretor" style="border-color:\${corDoCorretor(lead.corretor)};color:\${corDoCorretor(lead.corretor)};background:\${corDoCorretor(lead.corretor)}1a">\${lead.corretor}</span></div>\` : ''}

    <label>Tarefa</label>
    <input type="text" id="modal-tarefa" placeholder="Próximo passo, ex: ligar amanhã 14h" value="\${lead.tarefa_sdr || ''}">

    <label>Prazo da tarefa</label>
    <input type="datetime-local" id="modal-tarefa-data" value="\${lead.tarefa_data ? new Date(lead.tarefa_data).toISOString().slice(0, 16) : ''}">
    \${lead.tarefa_sdr || lead.tarefa_data ? '<button type="button" class="close-btn" id="modal-tarefa-concluida" style="width:100%;margin-top:6px;color:#17a34a;border-color:#a8ecca;">✓ Tarefa concluída</button>' : ''}

    <div style="display:flex;gap:8px;">
      <div style="flex:1;">
        <label>Atualizado até (data)</label>
        <input type="date" id="modal-ultima-atualizacao" value="\${lead.ultima_atualizacao_sdr ? String(lead.ultima_atualizacao_sdr).slice(0, 10) : ''}">
      </div>
      <div style="flex:1;">
        <label>Valor do imóvel buscado</label>
        <input type="text" id="modal-valor-imovel" placeholder="Ex: R$ 350.000" value="\${lead.valor_imovel_sdr || ''}">
      </div>
    </div>

    <label>Notas</label>
    <textarea id="modal-notas" placeholder="O que já foi conversado, quando retomar...">\${lead.notas_sdr || ''}</textarea>

    <label>O que está buscando</label>
    <textarea id="modal-buscando" placeholder="Ex: apartamento 2 quartos, até R$ 300 mil, região X...">\${lead.buscando_sdr || ''}</textarea>

    <div class="modal-actions">
      <button class="close-btn" id="modal-fechar">Fechar</button>
      <div>
        \${waLink ? \`<a class="wa-btn" href="\${waLink}" target="_blank">WhatsApp ↗</a>\` : ''}
        <span class="saved-flash" id="modal-flash">salvo ✓</span>
      </div>
    </div>
    <button class="primary-btn" id="modal-salvar" style="width:100%;margin-top:10px;">💾 Salvar</button>
    <button class="close-btn" id="modal-remover" style="width:100%;margin-top:8px;color:#b5720a;border-color:var(--warn-border);">Remover da carteira</button>
  \`;

  document.getElementById('overlay').classList.add('show');
  document.getElementById('modal-fechar').addEventListener('click', fecharModal);
  document.getElementById('modal-remover').addEventListener('click', () => {
    if (!confirm(\`Remover "\${lead.nome || 'esse contato'}" da sua carteira? Ele some do seu Kanban, mas continua no sistema.\`)) return;
    salvarCampo(id, 'carteira_sdr', false, () => { fecharModal(); carregar(); });
  });
  document.getElementById('modal-status').addEventListener('change', e => {
    const novoStatus = e.target.value;
    // Salva primeiro o que estiver digitado (notas, tarefa etc.) antes de
    // trocar o status — senão o texto digitado e não salvo se perdia.
    salvarBlocoTexto(id, lead, () => {
      salvarCampo(id, 'status', novoStatus, () => { render(); abrirModalLead(id); });
    });
  });
  document.getElementById('modal-corretor').addEventListener('change', e => {
    const novoCorretor = e.target.value;
    salvarBlocoTexto(id, lead, () => {
      salvarCampo(id, 'corretor', novoCorretor, () => { render(); abrirModalLead(id); });
    });
  });
  const btnTarefaConcluida = document.getElementById('modal-tarefa-concluida');
  if (btnTarefaConcluida) {
    btnTarefaConcluida.addEventListener('click', () => {
      document.getElementById('modal-tarefa').value = '';
      document.getElementById('modal-tarefa-data').value = '';
      lead.tarefa_sdr = '';
      lead.tarefa_data = null;
      Promise.all([
        fetch(\`/api/leads/\${id}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campo: 'tarefa_sdr', valor: '' }) }),
        fetch(\`/api/leads/\${id}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campo: 'tarefa_data', valor: null }) }),
      ]).then(() => {
        render();
        mostrarFlashSalvoGrande();
        abrirModalLead(id);
      }).catch(() => {
        alert('Não consegui salvar. Confere sua internet e tenta de novo.');
      });
    });
  }
  document.getElementById('modal-salvar').addEventListener('click', () => {
    salvarBlocoTexto(id, lead, () => {
      render();
      mostrarFlashSalvoGrande();
      setTimeout(fecharModal, 650);
    });
  });
}

function ligarEventosChips(id, lead, chipsContainer) {
  chipsContainer.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const atual = corretoresRepassadosLista(lead).filter(n => n !== btn.dataset.nome);
      const valor = atual.join(', ');
      salvarCampo(id, 'corretores_repassados', valor, () => {
        lead.corretores_repassados = valor;
        render();
        chipsContainer.innerHTML = renderChipsCorretores(lead);
        ligarEventosChips(id, lead, chipsContainer);
      });
    });
  });
  const addBtn = chipsContainer.querySelector('#add-corretor-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      // Lista pra escolher em vez de digitar — evita erro de digitação e
      // já grava o corretor de verdade (campo "corretor"), pra aparecer
      // direto na coluna dele no quadro por corretor da Juliane.
      const select = document.createElement('select');
      select.style.fontSize = '12px';
      select.style.padding = '4px 6px';
      select.style.borderRadius = '8px';
      select.style.border = '1px solid var(--card-border)';
      select.innerHTML = '<option value="">Escolher corretor...</option>' +
        NOMES_OFICIAIS_CORRETORES.map(n => \`<option value="\${n}">\${n}</option>\`).join('') +
        '<option value="__outro">Outro (digitar)...</option>';
      addBtn.replaceWith(select);
      select.focus();

      select.addEventListener('change', () => {
        let nome = select.value;
        if (nome === '__outro') {
          nome = prompt('Nome do corretor:');
          if (nome) nome = normalizarNomeCorretor(nome);
        }
        if (!nome || !nome.trim()) {
          chipsContainer.innerHTML = renderChipsCorretores(lead);
          ligarEventosChips(id, lead, chipsContainer);
          return;
        }
        nome = nome.trim();
        const atual = corretoresRepassadosLista(lead);
        if (!atual.includes(nome)) atual.push(nome);
        const valorChips = atual.join(', ');

        // Salva a etiqueta de histórico E o corretor atual, junto.
        Promise.all([
          fetch(\`/api/leads/\${id}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campo: 'corretores_repassados', valor: valorChips }) }),
          fetch(\`/api/leads/\${id}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campo: 'corretor', valor: nome }) }),
        ]).then(() => {
          lead.corretores_repassados = valorChips;
          lead.corretor = nome;
          render();
          chipsContainer.innerHTML = renderChipsCorretores(lead);
          ligarEventosChips(id, lead, chipsContainer);
        }).catch(() => {
          alert('Não consegui salvar. Confere sua internet e tenta de novo.');
        });
      });
    });
  }
}

function abrirModalAdicionar() {
  document.getElementById('modal').innerHTML = \`
    <h2>Adicionar contato</h2>
    <div class="lead-meta">Confere na hora se já foi enviado pra algum corretor</div>

    <label>Nome</label>
    <input type="text" id="add-nome" placeholder="Nome do contato">

    <label>WhatsApp</label>
    <input type="text" id="add-whatsapp" placeholder="Com DDD, ex: 62999998888">

    <label>Origem</label>
    <select id="add-origem">
      \${ORIGENS.map(o => \`<option value="\${o}" \${o === 'SDR' ? 'selected' : ''}>\${o}</option>\`).join('')}
    </select>

    <div id="add-aviso"></div>

    <div class="modal-actions">
      <button class="close-btn" id="modal-fechar">Cancelar</button>
      <button class="primary-btn" id="add-confirmar">Adicionar</button>
    </div>
  \`;
  document.getElementById('overlay').classList.add('show');
  document.getElementById('modal-fechar').addEventListener('click', fecharModal);
  document.getElementById('add-confirmar').addEventListener('click', confirmarAdicionar);
  document.getElementById('add-whatsapp').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmarAdicionar();
  });
  setTimeout(() => document.getElementById('add-nome').focus(), 50);
}

async function confirmarAdicionar() {
  const nome = document.getElementById('add-nome').value.trim();
  const whatsapp = document.getElementById('add-whatsapp').value.trim();
  const avisoEl = document.getElementById('add-aviso');

  if (!whatsapp) {
    avisoEl.innerHTML = '<div class="aviso-modal warn">Digita o WhatsApp.</div>';
    return;
  }
  if (!nome) {
    avisoEl.innerHTML = '<div class="aviso-modal warn">Digita o nome também.</div>';
    return;
  }

  avisoEl.innerHTML = '<div class="aviso-modal">Conferindo...</div>';

  try {
    const res = await fetch('/api/leads/conferir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, whatsapp, origem: document.getElementById('add-origem').value }),
    });
    const data = await res.json();

    if (!data.ok) {
      avisoEl.innerHTML = \`<div class="aviso-modal warn">⚠️ \${data.erro}</div>\`;
      return;
    }

    if (data.encontrado) {
      const envolvidos = [];
      if (data.lead.corretor) envolvidos.push(data.lead.corretor);
      if (data.lead.outros_corretores) {
        data.lead.outros_corretores.split(',').map(s => s.trim()).filter(Boolean).forEach(c => {
          if (!envolvidos.includes(c)) envolvidos.push(c);
        });
      }
      avisoEl.innerHTML = \`<div class="aviso-modal warn">⚠️ Já existe! Já foi enviado pra: \${envolvidos.length ? envolvidos.join(', ') : 'ninguém ainda'}. Não precisa reenviar.</div>\`;
    } else {
      avisoEl.innerHTML = '<div class="aviso-modal ok">✅ Novo contato, adicionado à carteira.</div>';
    }

    ULTIMO_ADICIONADO_ID = data.lead.id;
    await carregar();
    setTimeout(fecharModal, 900);
  } catch (err) {
    avisoEl.innerHTML = '<div class="aviso-modal warn">⚠️ Erro ao adicionar. Tenta de novo.</div>';
  }
}

function flashModal() {
  const flash = document.getElementById('modal-flash');
  if (!flash) return;
  flash.classList.add('show');
  setTimeout(() => flash.classList.remove('show'), 1200);
}

// Popup verde grande no topo da tela, confirmando o salvamento.
function mostrarFlashSalvoGrande() {
  let el = document.getElementById('flash-salvo-grande');
  if (!el) {
    el = document.createElement('div');
    el.id = 'flash-salvo-grande';
    el.className = 'flash-salvo-grande';
    el.textContent = '✅ Salvo!';
    document.body.appendChild(el);
  }
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1100);
}

// Junta tudo que está digitado nos campos de texto do modal (notas, o que
// buscando, tarefa, prazo, atualização, valor) e salva de uma vez. Usada
// tanto pelo botão "Salvar" quanto antes de trocar Status/Corretor — assim,
// se a pessoa digitou algo e mudou a coluna sem clicar em Salvar antes, o
// que foi digitado não se perde mais.
function salvarBlocoTexto(id, lead, aoTerminar) {
  const notasEl = document.getElementById('modal-notas');
  if (!notasEl) { if (aoTerminar) aoTerminar(); return; }
  const notas = notasEl.value;
  const buscando = document.getElementById('modal-buscando').value;
  const tarefa = document.getElementById('modal-tarefa').value;
  const tarefaData = document.getElementById('modal-tarefa-data').value;
  const dataAtualizacao = document.getElementById('modal-ultima-atualizacao').value;
  const valorDigitado = document.getElementById('modal-valor-imovel').value;
  const numero = parseValorImovel(valorDigitado);
  const valorFormatado = numero > 0 ? formatarReais(numero) : '';
  const campoValorEl = document.getElementById('modal-valor-imovel');
  if (campoValorEl) campoValorEl.value = valorFormatado;

  lead.notas_sdr = notas;
  lead.buscando_sdr = buscando;
  lead.tarefa_sdr = tarefa;
  lead.tarefa_data = tarefaData ? new Date(tarefaData).toISOString() : null;
  lead.ultima_atualizacao_sdr = dataAtualizacao;
  lead.valor_imovel_sdr = valorFormatado;

  Promise.all([
    fetch(\`/api/leads/\${id}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campo: 'notas_sdr', valor: notas }) }),
    fetch(\`/api/leads/\${id}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campo: 'buscando_sdr', valor: buscando }) }),
    fetch(\`/api/leads/\${id}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campo: 'tarefa_sdr', valor: tarefa }) }),
    fetch(\`/api/leads/\${id}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campo: 'tarefa_data', valor: lead.tarefa_data }) }),
    fetch(\`/api/leads/\${id}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campo: 'ultima_atualizacao_sdr', valor: dataAtualizacao }) }),
    fetch(\`/api/leads/\${id}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campo: 'valor_imovel_sdr', valor: valorFormatado }) }),
  ]).then(() => {
    if (aoTerminar) aoTerminar(valorFormatado);
  }).catch(() => {
    alert('Não consegui salvar. Confere sua internet e tenta de novo.');
  });
}

function alternarClienteOuro(id, novoValor) {
  salvarCampo(id, 'cliente_ouro', novoValor, () => {
    render();
    if (document.getElementById('overlay').classList.contains('show')) abrirModalLead(id);
  });
}

function fecharModal() {
  document.getElementById('overlay').classList.remove('show');
}

document.getElementById('overlay').addEventListener('click', e => {
  if (e.target.id === 'overlay') fecharModal();
});

document.getElementById('btn-adicionar').addEventListener('click', abrirModalAdicionar);
// Recarrega a página de verdade (não só a lista de leads) — assim, depois
// de um deploy novo, clicar aqui já pega a versão mais recente do CRM.
document.getElementById('btn-atualizar').addEventListener('click', () => {
  location.reload();
});
document.getElementById('btn-baixar-csv').addEventListener('click', exportarCSV);
document.getElementById('btn-salvar-backup').addEventListener('click', () => {
  const btn = document.getElementById('btn-salvar-backup');
  const textoOriginal = btn.textContent;
  btn.textContent = 'Salvando...';
  btn.disabled = true;
  fetch('/api/admin/backups/agora')
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        alert(\`Backup salvo! \${data.totalLeads || ''} lead(s) no Postgres\${data.drive && data.drive.ok ? ' e no Google Drive' : ''}.\`);
      } else {
        alert('Não consegui salvar o backup: ' + (data.erro || 'erro desconhecido'));
      }
    })
    .catch(() => alert('Não consegui salvar o backup. Confere sua internet e tenta de novo.'))
    .finally(() => { btn.textContent = textoOriginal; btn.disabled = false; });
});

async function salvarCampo(id, campo, valor, aoTerminar) {
  try {
    await fetch(\`/api/leads/\${id}\`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campo, valor }),
    });
    const lead = TODOS_LEADS.find(l => String(l.id) === String(id));
    if (lead) lead[campo] = valor;
    if (aoTerminar) aoTerminar();
  } catch (err) {
    alert('Não consegui salvar. Confere sua internet e tenta de novo.');
  }
}

document.getElementById('busca').addEventListener('input', e => { BUSCA = e.target.value; render(); });

carregar();
setInterval(carregar, 60000); // atualiza sozinho a cada 1 min
</script>
</body>
</html>`;

module.exports = { CRM_HTML };
