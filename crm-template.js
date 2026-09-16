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
    --text: #e8e9ec;
    --muted: #8b909c;
    --accent: #4f8cff;
    --warn-bg: #3a2a12;
    --warn-border: #a9701f;
    --warn-text: #ffb84d;
    --ok: #3ac97b;
    --danger: #ff5c5c;
    --radius: 10px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 16px;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: var(--muted); font-size: 13px; margin-bottom: 16px; }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
    align-items: center;
  }
  input[type="text"] {
    background: var(--card);
    border: 1px solid var(--card-border);
    color: var(--text);
    padding: 8px 12px;
    border-radius: var(--radius);
    font-size: 14px;
    flex: 1;
    min-width: 180px;
  }
  .tabs { display: flex; gap: 6px; flex-wrap: wrap; }
  .tab {
    background: var(--card);
    border: 1px solid var(--card-border);
    color: var(--muted);
    padding: 7px 13px;
    border-radius: 20px;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
  }
  .tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .tab .count { opacity: .75; margin-left: 4px; }

  .stats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  .stat {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    padding: 10px 14px;
    min-width: 110px;
  }
  .stat .num { font-size: 20px; font-weight: 600; }
  .stat .label { font-size: 11px; color: var(--muted); }

  .list { display: flex; flex-direction: column; gap: 10px; }
  .lead {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    padding: 14px;
  }
  .lead.reaquecer { border-color: var(--warn-border); background: linear-gradient(180deg, var(--warn-bg), var(--card) 40px); }
  .lead-top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
  .lead-nome { font-size: 15px; font-weight: 600; }
  .lead-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .lead-meta a { color: var(--muted); }
  .badge {
    display: inline-block;
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 12px;
    margin-top: 6px;
    margin-right: 6px;
  }
  .badge.warn { background: var(--warn-bg); color: var(--warn-text); border: 1px solid var(--warn-border); }
  .badge.origem { background: #1f2430; color: var(--muted); border: 1px solid var(--card-border); }

  .lead-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; align-items: center; }
  select, textarea {
    background: #10131a;
    border: 1px solid var(--card-border);
    color: var(--text);
    border-radius: 8px;
    padding: 6px 8px;
    font-size: 13px;
    font-family: inherit;
  }
  select { cursor: pointer; }
  textarea {
    width: 100%;
    min-height: 40px;
    margin-top: 8px;
    resize: vertical;
  }
  .wa-btn {
    background: #1f5c3a;
    color: #9df0bb;
    border: 1px solid #2f7a4d;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 13px;
    text-decoration: none;
    cursor: pointer;
  }
  .saved-flash { color: var(--ok); font-size: 11px; margin-left: 6px; opacity: 0; transition: opacity .3s; }
  .saved-flash.show { opacity: 1; }

  .empty { text-align: center; color: var(--muted); padding: 40px 0; }
  .loading { text-align: center; color: var(--muted); padding: 40px 0; }
</style>
</head>
<body>

<h1>Carteira de Leads</h1>
<div class="sub">Organize, veja pra quem já foi cada lead e reaqueça sem duplicar.</div>

<div class="stats" id="stats"></div>

<div class="toolbar">
  <input type="text" id="busca" placeholder="Buscar por nome ou WhatsApp...">
</div>
<div class="tabs" id="tabs"></div>

<div id="lista" class="list"><div class="loading">Carregando leads...</div></div>

<script>
let TODOS_LEADS = [];
let ABA_ATIVA = 'todos';
let BUSCA = '';

const ABAS = [
  { id: 'todos', label: 'Todos' },
  { id: 'novos', label: 'Novos' },
  { id: 'reaquecer', label: '⚠️ Reaquecer' },
  { id: 'andamento', label: 'Em andamento' },
  { id: 'sem_retorno', label: 'Sem retorno' },
  { id: 'fechado', label: 'Fechado / Perdido' },
];

const STATUS_OPCOES = ['Novo', 'Reaquecendo', 'Contato feito', 'Aguardando retorno', 'Repassado ao corretor', 'Fechado', 'Sem interesse'];

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

function classificar(lead) {
  if (temHistoricoDuplicado(lead) || lead.status === 'Reaquecendo') return 'reaquecer';
  if (lead.sem_retorno) return 'sem_retorno';
  if (lead.venda || lead.status === 'Fechado' || lead.status === 'Sem interesse') return 'fechado';
  if (lead.em_andamento || lead.status === 'Contato feito' || lead.status === 'Aguardando retorno' || lead.status === 'Repassado ao corretor') return 'andamento';
  return 'novos';
}

async function carregar() {
  try {
    const res = await fetch('/api/leads');
    const data = await res.json();
    TODOS_LEADS = data.leads || data || [];
    renderTabs();
    render();
  } catch (err) {
    document.getElementById('lista').innerHTML = '<div class="empty">Erro ao carregar leads. Recarregue a página.</div>';
  }
}

function renderTabs() {
  const container = document.getElementById('tabs');
  container.innerHTML = ABAS.map(aba => {
    const count = aba.id === 'todos' ? TODOS_LEADS.length : TODOS_LEADS.filter(l => classificar(l) === aba.id).length;
    return \`<div class="tab \${aba.id === ABA_ATIVA ? 'active' : ''}" data-aba="\${aba.id}">\${aba.label} <span class="count">\${count}</span></div>\`;
  }).join('');
  container.querySelectorAll('.tab').forEach(el => {
    el.addEventListener('click', () => { ABA_ATIVA = el.dataset.aba; renderTabs(); render(); });
  });

  const reaquecerCount = TODOS_LEADS.filter(l => classificar(l) === 'reaquecer').length;
  document.getElementById('stats').innerHTML = \`
    <div class="stat"><div class="num">\${TODOS_LEADS.length}</div><div class="label">Total na carteira</div></div>
    <div class="stat"><div class="num" style="color:var(--warn-text)">\${reaquecerCount}</div><div class="label">Pra reaquecer</div></div>
  \`;
}

function render() {
  let leads = TODOS_LEADS.filter(l => ABA_ATIVA === 'todos' || classificar(l) === ABA_ATIVA);
  if (BUSCA) {
    const b = BUSCA.toLowerCase();
    leads = leads.filter(l => (l.nome || '').toLowerCase().includes(b) || (l.whatsapp || '').includes(b));
  }

  const container = document.getElementById('lista');
  if (leads.length === 0) {
    container.innerHTML = '<div class="empty">Nenhum lead nessa visão.</div>';
    return;
  }

  container.innerHTML = leads.map(lead => {
    const duplicado = temHistoricoDuplicado(lead);
    const envolvidos = corretoresEnvolvidos(lead);
    const data = lead.distribuido_em ? new Date(lead.distribuido_em).toLocaleDateString('pt-BR') : '—';
    const waLink = lead.whatsapp ? \`https://wa.me/\${lead.whatsapp}\` : null;

    return \`
      <div class="lead \${duplicado ? 'reaquecer' : ''}" data-id="\${lead.id}">
        <div class="lead-top">
          <div>
            <div class="lead-nome">\${lead.nome || 'Sem nome'}</div>
            <div class="lead-meta">\${lead.whatsapp || 'sem WhatsApp'} · chegou em \${data}</div>
            \${lead.origem ? \`<span class="badge origem">\${lead.origem}</span>\` : ''}
            \${duplicado ? \`<span class="badge warn">⚠️ Já foi para \${envolvidos.length}: \${envolvidos.join(', ')} — não reenvie, reaqueça direto</span>\` : (lead.corretor ? \`<span class="badge origem">Corretor: \${lead.corretor}</span>\` : '')}
          </div>
          \${waLink ? \`<a class="wa-btn" href="\${waLink}" target="_blank">WhatsApp ↗</a>\` : ''}
        </div>
        <div class="lead-actions">
          <select data-campo="status">
            \${STATUS_OPCOES.map(s => \`<option value="\${s}" \${lead.status === s ? 'selected' : ''}>\${s}</option>\`).join('')}
          </select>
          <span class="saved-flash">salvo ✓</span>
        </div>
        <textarea data-campo="notas_sdr" placeholder="Notas — o que já foi conversado, quando retomar...">\${lead.notas_sdr || ''}</textarea>
      </div>
    \`;
  }).join('');

  container.querySelectorAll('.lead').forEach(el => {
    const id = el.dataset.id;
    el.querySelector('select[data-campo="status"]').addEventListener('change', e => salvarCampo(id, 'status', e.target.value, el));
    el.querySelector('textarea[data-campo="notas_sdr"]').addEventListener('blur', e => salvarCampo(id, 'notas_sdr', e.target.value, el));
  });
}

async function salvarCampo(id, campo, valor, el) {
  try {
    await fetch(\`/api/leads/\${id}\`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campo, valor }),
    });
    const lead = TODOS_LEADS.find(l => String(l.id) === String(id));
    if (lead) lead[campo] = valor;
    const flash = el.querySelector('.saved-flash');
    if (flash) {
      flash.classList.add('show');
      setTimeout(() => flash.classList.remove('show'), 1200);
    }
    if (campo === 'status') { renderTabs(); render(); }
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
