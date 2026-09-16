const CRM_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CRM — Carteira de Leads</title>
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
    display: flex;
    justify-content: space-between;
    align-items: center;
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
  }
  .lead:active { cursor: grabbing; }
  .lead.dragging { opacity: 0.4; }
  .lead.reaquecer { border-color: var(--warn-border); background: linear-gradient(180deg, var(--warn-bg), var(--card) 32px); }
  .lead.recem-adicionado { animation: pulso 1.6s ease-in-out 2; }
  @keyframes pulso {
    0%, 100% { box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    50% { box-shadow: 0 0 0 3px var(--warn-border); }
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
    white-space: pre-wrap;
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

<h1>Carteira de Leads</h1>
<div class="sub">Arraste o cartão entre as colunas pra mudar o status. Toque num cartão pra ver detalhes e notas.</div>

<div class="stats" id="stats"></div>

<div class="toolbar">
  <input type="text" id="busca" placeholder="Buscar por nome ou WhatsApp...">
  <button class="add-contato-btn" id="btn-adicionar">+ Adicionar contato</button>
</div>

<div class="board" id="board"></div>

<div class="overlay" id="overlay">
  <div class="modal" id="modal"></div>
</div>

<script>
let TODOS_LEADS = [];
let BUSCA = '';
let LEAD_ARRASTADO = null;
let ULTIMO_ADICIONADO_ID = null;

const COLUNAS = ['Novo', 'Reaquecendo', 'Contato feito', 'Aguardando retorno', 'Visita agendada', 'Repassado ao corretor', 'Compra futura', 'Já comprou', 'Sem retorno', 'Fechado', 'Sem interesse'];

// Paleta viva, uma cor por coluna — usada no cabeçalho e na barrinha
// lateral de cada cartão daquela coluna.
const CORES_COLUNA = {
  'Novo':                   { header: '#3b6cf0', accent: '#3b6cf0', texto: '#ffffff' },
  'Reaquecendo':            { header: '#f2941c', accent: '#f2941c', texto: '#ffffff' },
  'Contato feito':          { header: '#12b76a', accent: '#12b76a', texto: '#ffffff' },
  'Aguardando retorno':     { header: '#9b4de0', accent: '#9b4de0', texto: '#ffffff' },
  'Visita agendada':        { header: '#0aa5c2', accent: '#0aa5c2', texto: '#ffffff' },
  'Repassado ao corretor':  { header: '#e8479e', accent: '#e8479e', texto: '#ffffff' },
  'Compra futura':          { header: '#5b6bf5', accent: '#5b6bf5', texto: '#ffffff' },
  'Já comprou':             { header: '#c9a20a', accent: '#c9a20a', texto: '#ffffff' },
  'Sem retorno':            { header: '#6b7280', accent: '#6b7280', texto: '#ffffff' },
  'Fechado':                { header: '#17a34a', accent: '#17a34a', texto: '#ffffff' },
  'Sem interesse':          { header: '#e0453f', accent: '#e0453f', texto: '#ffffff' },
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

async function carregar() {
  try {
    const res = await fetch('/api/leads/carteira-sdr');
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

function render() {
  const leads = leadsFiltrados();
  const reaquecerCount = TODOS_LEADS.filter(temHistoricoDuplicado).length;

  document.getElementById('stats').innerHTML = \`
    <div class="stat"><span class="num">\${TODOS_LEADS.length}</span>na carteira</div>
    <div class="stat" style="color:#b5720a"><span class="num">\${reaquecerCount}</span>pra reaquecer</div>
  \`;

  const board = document.getElementById('board');
  board.innerHTML = COLUNAS.map(coluna => {
    const leadsColuna = leads.filter(l => statusDoLead(l) === coluna);
    const cor = CORES_COLUNA[coluna];
    return \`
      <div class="column" data-coluna="\${coluna}">
        <div class="column-header" style="background:\${cor.header};color:\${cor.texto}">
          \${coluna}
          <span class="column-count">\${leadsColuna.length}</span>
        </div>
        <div class="column-cards" data-coluna="\${coluna}">
          \${leadsColuna.map(lead => cardHtml(lead, cor.accent)).join('') || ''}
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

function cardHtml(lead, corBorda) {
  const duplicado = temHistoricoDuplicado(lead);
  const envolvidos = corretoresEnvolvidos(lead);
  const chipsRepassados = corretoresRepassadosLista(lead);
  const dataEtapa = formatarData(lead.status_alterado_em || lead.distribuido_em);
  return \`
    <div class="lead \${duplicado ? 'reaquecer' : ''}" draggable="true" data-id="\${lead.id}" style="\${duplicado ? '' : \`border-left-color:\${corBorda}\`}">
      <div class="lead-nome">\${lead.nome || 'Sem nome'}</div>
      <div class="lead-meta">\${lead.whatsapp || 'sem WhatsApp'}</div>
      \${dataEtapa ? \`<div class="lead-meta">Nessa etapa desde \${dataEtapa}</div>\` : ''}
      \${lead.origem ? \`<span class="badge origem">\${lead.origem}</span>\` : ''}
      \${duplicado ? \`<span class="badge warn">⚠️ \${envolvidos.length}: \${envolvidos.join(', ')}</span>\` : ''}
      \${chipsRepassados.length > 0 ? \`<div>\${chipsRepassados.map(nome => \`<span class="chip-corretor" style="border-color:\${corDoCorretor(nome)};color:\${corDoCorretor(nome)};background:\${corDoCorretor(nome)}1a">\${nome}</span>\`).join('')}</div>\` : ''}
      \${lead.tarefa_sdr ? \`<div class="tarefa-preview">📌 \${lead.tarefa_sdr}</div>\` : ''}
      \${lead.ultima_atualizacao_sdr ? \`<div class="tarefa-preview" style="color:var(--muted);font-weight:600;">🗓️ Atualizado até \${formatarData(lead.ultima_atualizacao_sdr)}</div>\` : ''}
      \${lead.notas_sdr ? \`<div class="lead-notas">\${lead.notas_sdr}</div>\` : ''}
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
    <h2>\${lead.nome || 'Sem nome'}</h2>
    <div class="lead-meta">\${lead.whatsapp || 'sem WhatsApp'} · chegou em \${data}</div>
    \${lead.origem ? \`<span class="badge origem">\${lead.origem}</span>\` : ''}
    \${duplicado ? \`<span class="badge warn">⚠️ Já foi para \${envolvidos.length}: \${envolvidos.join(', ')} — não reenvie, reaqueça direto</span>\` : (lead.corretor ? \`<span class="badge origem">Corretor: \${lead.corretor}</span>\` : '')}

    <label>Status</label>
    <select id="modal-status">
      \${COLUNAS.map(c => \`<option value="\${c}" \${statusDoLead(lead) === c ? 'selected' : ''}>\${c}</option>\`).join('')}
    </select>
    \${lead.status_alterado_em ? \`<div class="lead-meta" style="margin-top:4px;">Nessa etapa desde \${formatarData(lead.status_alterado_em)}</div>\` : ''}

    \${statusDoLead(lead) === 'Repassado ao corretor' ? \`
      <label>Corretor(es)</label>
      <div id="modal-chips-corretores">\${renderChipsCorretores(lead)}</div>
    \` : ''}

    <label>Tarefa</label>
    <input type="text" id="modal-tarefa" placeholder="Próximo passo, ex: ligar amanhã 14h" value="\${lead.tarefa_sdr || ''}">

    <label>Atualizado até (data)</label>
    <input type="date" id="modal-ultima-atualizacao" value="\${lead.ultima_atualizacao_sdr ? String(lead.ultima_atualizacao_sdr).slice(0, 10) : ''}">

    <label>Notas</label>
    <textarea id="modal-notas" placeholder="O que já foi conversado, quando retomar...">\${lead.notas_sdr || ''}</textarea>

    <div class="modal-actions">
      <button class="close-btn" id="modal-fechar">Fechar</button>
      <div>
        \${waLink ? \`<a class="wa-btn" href="\${waLink}" target="_blank">WhatsApp ↗</a>\` : ''}
        <span class="saved-flash" id="modal-flash">salvo ✓</span>
      </div>
    </div>
    <button class="close-btn" id="modal-remover" style="width:100%;margin-top:8px;color:#b5720a;border-color:var(--warn-border);">Remover da carteira</button>
  \`;

  document.getElementById('overlay').classList.add('show');
  document.getElementById('modal-fechar').addEventListener('click', fecharModal);
  document.getElementById('modal-remover').addEventListener('click', () => {
    if (!confirm(\`Remover "\${lead.nome || 'esse contato'}" da sua carteira? Ele some do seu Kanban, mas continua no sistema.\`)) return;
    salvarCampo(id, 'carteira_sdr', false, () => { fecharModal(); carregar(); });
  });
  document.getElementById('modal-status').addEventListener('change', e => {
    salvarCampo(id, 'status', e.target.value, () => { render(); abrirModalLead(id); });
  });
  document.getElementById('modal-notas').addEventListener('blur', e => {
    salvarCampo(id, 'notas_sdr', e.target.value, () => { render(); flashModal(); });
  });
  document.getElementById('modal-tarefa').addEventListener('blur', e => {
    salvarCampo(id, 'tarefa_sdr', e.target.value, () => { render(); flashModal(); });
  });
  document.getElementById('modal-ultima-atualizacao').addEventListener('change', e => {
    salvarCampo(id, 'ultima_atualizacao_sdr', e.target.value, () => { render(); flashModal(); });
  });

  const chipsContainer = document.getElementById('modal-chips-corretores');
  if (chipsContainer) ligarEventosChips(id, lead, chipsContainer);
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
      const nome = prompt('Nome do corretor:');
      if (!nome || !nome.trim()) return;
      const atual = corretoresRepassadosLista(lead);
      if (!atual.includes(nome.trim())) atual.push(nome.trim());
      const valor = atual.join(', ');
      salvarCampo(id, 'corretores_repassados', valor, () => {
        lead.corretores_repassados = valor;
        render();
        chipsContainer.innerHTML = renderChipsCorretores(lead);
        ligarEventosChips(id, lead, chipsContainer);
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
      body: JSON.stringify({ nome, whatsapp }),
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

function fecharModal() {
  document.getElementById('overlay').classList.remove('show');
}

document.getElementById('overlay').addEventListener('click', e => {
  if (e.target.id === 'overlay') fecharModal();
});

document.getElementById('btn-adicionar').addEventListener('click', abrirModalAdicionar);

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
