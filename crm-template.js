const CRM_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CRM — Carteira de Leads</title>
<style>
  :root {
    --bg: #0f1115;
    --card: #171a21;
    --card-border: #262a33;
    --column-bg: #12141a;
    --text: #e8e9ec;
    --muted: #8b909c;
    --accent: #4f8cff;
    --warn-bg: #3a2a12;
    --warn-border: #a9701f;
    --warn-text: #ffb84d;
    --ok: #3ac97b;
    --radius: 10px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 12px;
    overflow-x: hidden;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: var(--muted); font-size: 13px; margin-bottom: 12px; }

  .toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
  }
  input[type="text"] {
    background: var(--card);
    border: 1px solid var(--card-border);
    color: var(--text);
    padding: 8px 12px;
    border-radius: var(--radius);
    font-size: 14px;
    flex: 1;
  }
  .add-contato-btn {
    background: var(--accent);
    color: #fff;
    border: none;
    padding: 8px 16px;
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .stats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .stat {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    padding: 8px 12px;
    font-size: 12px;
  }
  .stat .num { font-size: 16px; font-weight: 600; margin-right: 4px; }

  .board {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 12px;
    -webkit-overflow-scrolling: touch;
  }
  .column {
    background: var(--column-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    min-width: 250px;
    max-width: 250px;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 200px);
  }
  .column.dragover { border-color: var(--accent); background: #17203a; }
  .column-header {
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 600;
    border-bottom: 1px solid var(--card-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
  }
  .column-count {
    background: var(--card-border);
    color: var(--muted);
    font-size: 11px;
    padding: 1px 7px;
    border-radius: 10px;
  }
  .column-cards {
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .lead {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 8px;
    padding: 10px;
    cursor: grab;
  }
  .lead:active { cursor: grabbing; }
  .lead.dragging { opacity: 0.4; }
  .lead.reaquecer { border-color: var(--warn-border); background: linear-gradient(180deg, var(--warn-bg), var(--card) 30px); }
  .lead.recem-adicionado { animation: pulso 1.6s ease-in-out 2; }
  @keyframes pulso {
    0%, 100% { box-shadow: none; }
    50% { box-shadow: 0 0 0 2px var(--warn-border); }
  }
  .lead-nome { font-size: 13px; font-weight: 600; }
  .lead-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .badge {
    display: inline-block;
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 10px;
    margin-top: 6px;
    margin-right: 4px;
  }
  .badge.warn { background: var(--warn-bg); color: var(--warn-text); border: 1px solid var(--warn-border); }
  .badge.origem { background: #1f2430; color: var(--muted); border: 1px solid var(--card-border); }

  .lead-notas {
    margin-top: 8px;
    font-size: 11px;
    color: var(--muted);
    background: #10131a;
    border-radius: 6px;
    padding: 6px 8px;
    white-space: pre-wrap;
  }

  .overlay {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
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
    padding: 18px;
    width: 100%;
    max-width: 420px;
  }
  .modal h2 { font-size: 16px; margin: 0 0 4px; }
  .modal .lead-meta { margin-bottom: 10px; }
  .modal label { font-size: 12px; color: var(--muted); display: block; margin: 10px 0 4px; }
  select, textarea {
    background: #10131a;
    border: 1px solid var(--card-border);
    color: var(--text);
    border-radius: 8px;
    padding: 7px 9px;
    font-size: 13px;
    font-family: inherit;
    width: 100%;
  }
  textarea { min-height: 70px; resize: vertical; }
  .modal-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
  .wa-btn {
    background: #1f5c3a;
    color: #9df0bb;
    border: 1px solid #2f7a4d;
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 13px;
    text-decoration: none;
    cursor: pointer;
  }
  .primary-btn {
    background: var(--accent);
    color: #fff;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .close-btn {
    background: none;
    border: 1px solid var(--card-border);
    color: var(--muted);
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
  }
  .saved-flash { color: var(--ok); font-size: 11px; margin-left: 8px; opacity: 0; transition: opacity .3s; }
  .saved-flash.show { opacity: 1; }
  .aviso-modal {
    font-size: 12px;
    border-radius: 8px;
    padding: 8px 10px;
    margin-top: 10px;
  }
  .aviso-modal.warn { background: var(--warn-bg); color: var(--warn-text); border: 1px solid var(--warn-border); }
  .aviso-modal.ok { background: #12241a; color: #9df0bb; border: 1px solid #2f7a4d; }
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

const COLUNAS = ['Novo', 'Reaquecendo', 'Contato feito', 'Aguardando retorno', 'Repassado ao corretor', 'Fechado', 'Sem interesse'];

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
    <div class="stat" style="color:var(--warn-text)"><span class="num">\${reaquecerCount}</span>pra reaquecer</div>
  \`;

  const board = document.getElementById('board');
  board.innerHTML = COLUNAS.map(coluna => {
    const leadsColuna = leads.filter(l => statusDoLead(l) === coluna);
    return \`
      <div class="column" data-coluna="\${coluna}">
        <div class="column-header">
          \${coluna}
          <span class="column-count">\${leadsColuna.length}</span>
        </div>
        <div class="column-cards" data-coluna="\${coluna}">
          \${leadsColuna.map(lead => cardHtml(lead)).join('') || ''}
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

  // Se acabou de adicionar um contato, dá um destaque visual nele e rola até lá
  if (ULTIMO_ADICIONADO_ID) {
    const cardNovo = board.querySelector(\`.lead[data-id="\${ULTIMO_ADICIONADO_ID}"]\`);
    if (cardNovo) {
      cardNovo.classList.add('recem-adicionado');
      cardNovo.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    ULTIMO_ADICIONADO_ID = null;
  }
}

function cardHtml(lead) {
  const duplicado = temHistoricoDuplicado(lead);
  const envolvidos = corretoresEnvolvidos(lead);
  return \`
    <div class="lead \${duplicado ? 'reaquecer' : ''}" draggable="true" data-id="\${lead.id}">
      <div class="lead-nome">\${lead.nome || 'Sem nome'}</div>
      <div class="lead-meta">\${lead.whatsapp || 'sem WhatsApp'}</div>
      \${lead.origem ? \`<span class="badge origem">\${lead.origem}</span>\` : ''}
      \${duplicado ? \`<span class="badge warn">⚠️ \${envolvidos.length}: \${envolvidos.join(', ')}</span>\` : ''}
      \${lead.notas_sdr ? \`<div class="lead-notas">\${lead.notas_sdr}</div>\` : ''}
    </div>
  \`;
}

// ─── Modal de detalhe do lead (clicar num cartão) ─────────────
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

    <label>Notas</label>
    <textarea id="modal-notas" placeholder="O que já foi conversado, quando retomar...">\${lead.notas_sdr || ''}</textarea>

    <div class="modal-actions">
      <button class="close-btn" id="modal-fechar">Fechar</button>
      <div>
        \${waLink ? \`<a class="wa-btn" href="\${waLink}" target="_blank">WhatsApp ↗</a>\` : ''}
        <span class="saved-flash" id="modal-flash">salvo ✓</span>
      </div>
    </div>
  \`;

  document.getElementById('overlay').classList.add('show');
  document.getElementById('modal-fechar').addEventListener('click', fecharModal);
  document.getElementById('modal-status').addEventListener('change', e => {
    salvarCampo(id, 'status', e.target.value, () => { render(); flashModal(); });
  });
  document.getElementById('modal-notas').addEventListener('blur', e => {
    salvarCampo(id, 'notas_sdr', e.target.value, () => { render(); flashModal(); });
  });
}

// ─── Modal de adicionar contato novo ──────────────────────────
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
