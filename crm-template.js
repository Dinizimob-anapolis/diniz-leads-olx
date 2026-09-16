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

  .view-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
  .view-tab {
    background: var(--card);
    border: 1px solid var(--card-border);
    color: var(--muted);
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 13px;
    cursor: pointer;
  }
  .view-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }

  .check-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 360px;
    margin-bottom: 16px;
  }
  .check-form button {
    background: var(--accent);
    color: #fff;
    border: none;
    padding: 10px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    font-weight: 600;
  }
  .check-resultado {
    max-width: 420px;
    border-radius: var(--radius);
    padding: 12px 14px;
    margin-bottom: 16px;
    font-size: 13px;
    display: none;
  }
  .check-resultado.show { display: block; }
  .check-resultado.encontrado { background: var(--warn-bg); border: 1px solid var(--warn-border); color: var(--warn-text); }
  .check-resultado.novo { background: #12241a; border: 1px solid #2f7a4d; color: #9df0bb; }
  .check-resultado .add-btn {
    margin-top: 10px;
    background: #1f5c3a;
    color: #9df0bb;
    border: 1px solid #2f7a4d;
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
  }
  .check-historico { max-width: 420px; }
  .check-historico-item {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--muted);
    padding: 6px 0;
    border-bottom: 1px solid var(--card-border);
  }
  .check-historico-item .tag { font-size: 10px; padding: 1px 6px; border-radius: 8px; }
  .check-historico-item .tag.ok { background: #12241a; color: #9df0bb; }
  .check-historico-item .tag.warn { background: var(--warn-bg); color: var(--warn-text); }

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
    max-height: calc(100vh - 160px);
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
  .lead.reaquecer { border-color: var(--warn-border); }
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

  /* Modal de detalhe do lead */
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
</style>
</head>
<body>

<h1>Carteira de Leads</h1>
<div class="sub">Arraste o cartão entre as colunas pra mudar o status. Toque num cartão pra ver detalhes e notas.</div>

<div class="view-tabs">
  <button class="view-tab active" data-view="kanban">Kanban</button>
  <button class="view-tab" data-view="conferir">Conferir contato</button>
</div>

<div id="view-kanban">
  <div class="stats" id="stats"></div>

  <div class="toolbar">
    <input type="text" id="busca" placeholder="Buscar por nome ou WhatsApp...">
  </div>

  <div class="board" id="board"></div>
</div>

<div id="view-conferir" style="display:none">
  <div class="check-form">
    <input type="text" id="conferir-nome" placeholder="Nome do contato">
    <input type="text" id="conferir-whatsapp" placeholder="WhatsApp (com DDD)">
    <button id="conferir-btn">Conferir</button>
  </div>
  <div class="check-resultado" id="conferir-resultado"></div>
  <div class="check-historico" id="conferir-historico"></div>
</div>

<div class="overlay" id="overlay">
  <div class="modal" id="modal"></div>
</div>

<script>
let TODOS_LEADS = [];
let BUSCA = '';
let LEAD_ARRASTADO = null;

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
    const res = await fetch('/api/leads');
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

  // Drag events nos cartões
  board.querySelectorAll('.lead').forEach(el => {
    el.addEventListener('dragstart', e => {
      LEAD_ARRASTADO = el.dataset.id;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.addEventListener('click', () => abrirModal(el.dataset.id));
  });

  // Drop nas colunas
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

function abrirModal(id) {
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

// ─── Abas Kanban / Conferir contato ───────────────────────────
document.querySelectorAll('.view-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-kanban').style.display = btn.dataset.view === 'kanban' ? 'block' : 'none';
    document.getElementById('view-conferir').style.display = btn.dataset.view === 'conferir' ? 'block' : 'none';
  });
});

// ─── Conferir contato (um por vez) ────────────────────────────
const HISTORICO_SESSAO = [];

function corretoresEnvolvidosLead(lead) {
  const lista = [];
  if (lead.corretor) lista.push(lead.corretor);
  if (lead.outros_corretores) {
    lead.outros_corretores.split(',').map(s => s.trim()).filter(Boolean).forEach(c => {
      if (!lista.includes(c)) lista.push(c);
    });
  }
  return lista;
}

function renderHistoricoSessao() {
  const container = document.getElementById('conferir-historico');
  if (HISTORICO_SESSAO.length === 0) { container.innerHTML = ''; return; }
  container.innerHTML = '<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">Conferidos nessa sessão:</div>' +
    HISTORICO_SESSAO.map(item => \`
      <div class="check-historico-item">
        <span>\${item.nome} — \${item.whatsapp}</span>
        <span class="tag \${item.tipo === 'novo' ? 'ok' : 'warn'}">\${item.tipo === 'novo' ? 'novo' : 'já existia'}</span>
      </div>
    \`).join('');
}

async function conferirContato() {
  const nomeInput = document.getElementById('conferir-nome');
  const whatsappInput = document.getElementById('conferir-whatsapp');
  const nome = nomeInput.value.trim();
  const whatsapp = whatsappInput.value.trim();
  const resultado = document.getElementById('conferir-resultado');

  if (!whatsapp) {
    alert('Digita o WhatsApp do contato.');
    return;
  }

  resultado.className = 'check-resultado show';
  resultado.innerHTML = 'Conferindo...';

  try {
    const res = await fetch(\`/api/leads/conferir?whatsapp=\${encodeURIComponent(whatsapp)}\`);
    const data = await res.json();

    if (!data.ok) {
      resultado.className = 'check-resultado show encontrado';
      resultado.innerHTML = \`⚠️ \${data.erro}\`;
      return;
    }

    if (data.encontrado) {
      const envolvidos = corretoresEnvolvidosLead(data.lead);
      resultado.className = 'check-resultado show encontrado';
      resultado.innerHTML = \`
        ⚠️ <strong>Já existe na base</strong><br>
        Nome cadastrado: \${data.lead.nome || 'sem nome'}<br>
        \${envolvidos.length > 0 ? \`Já foi para: \${envolvidos.join(', ')}\` : 'Ainda sem corretor atribuído'}<br>
        Status atual: \${data.lead.status || 'Novo'}
      \`;
      HISTORICO_SESSAO.unshift({ nome: nome || data.lead.nome, whatsapp, tipo: 'existente' });
      renderHistoricoSessao();
    } else {
      if (!nome) {
        resultado.className = 'check-resultado show novo';
        resultado.innerHTML = '✅ Não encontrado na base. Digita o nome também pra poder adicionar.';
        return;
      }
      resultado.className = 'check-resultado show novo';
      resultado.innerHTML = \`
        ✅ <strong>Não encontrado</strong> — pode adicionar como novo lead.
        <br><button class="add-btn" id="conferir-add-btn">+ Adicionar à carteira</button>
      \`;
      document.getElementById('conferir-add-btn').addEventListener('click', () => adicionarContato(nome, whatsapp));
    }
  } catch (err) {
    resultado.className = 'check-resultado show encontrado';
    resultado.innerHTML = '⚠️ Erro ao conferir. Tenta de novo.';
  }
}

async function adicionarContato(nome, whatsapp) {
  const resultado = document.getElementById('conferir-resultado');
  try {
    const res = await fetch('/api/leads/conferir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, whatsapp }),
    });
    const data = await res.json();
    if (!data.ok) {
      resultado.className = 'check-resultado show encontrado';
      resultado.innerHTML = \`⚠️ \${data.erro}\`;
      return;
    }
    resultado.className = 'check-resultado show novo';
    resultado.innerHTML = '✅ Adicionado! Já pode conferir o próximo.';
    HISTORICO_SESSAO.unshift({ nome, whatsapp, tipo: 'novo' });
    renderHistoricoSessao();

    document.getElementById('conferir-nome').value = '';
    document.getElementById('conferir-whatsapp').value = '';
    document.getElementById('conferir-nome').focus();

    carregar(); // atualiza o Kanban em segundo plano com o novo lead
  } catch (err) {
    resultado.className = 'check-resultado show encontrado';
    resultado.innerHTML = '⚠️ Erro ao adicionar. Tenta de novo.';
  }
}

document.getElementById('conferir-btn').addEventListener('click', conferirContato);
document.getElementById('conferir-whatsapp').addEventListener('keydown', e => {
  if (e.key === 'Enter') conferirContato();
});

carregar();
setInterval(carregar, 60000); // atualiza sozinho a cada 1 min
</script>
</body>
</html>`;

module.exports = { CRM_HTML };
