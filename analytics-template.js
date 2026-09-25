const ANALYTICS_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Analytics - Diniz Imóveis</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<style>
  :root {
    --bg: #f2f3f8;
    --card: #ffffff;
    --card-border: #e6e8ef;
    --text: #1f2430;
    --muted: #767c8c;
    --accent: #4f6cff;
    --accent-2: #7c5cff;
    --ok: #17a869;
    --warn: #f2a93b;
    --danger: #ef4d5e;
    --info: #1fb5c9;
    --radius: 14px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 16px;
  }
  .topo {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: var(--muted); font-size: 13px; }
  .voltar-btn {
    background: #fff;
    color: var(--accent);
    border: 1px solid var(--accent);
    padding: 9px 16px;
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
  }

  .filtros {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    padding: 10px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .periodo-btn {
    background: #f2f3f8;
    color: var(--text);
    border: 1px solid var(--card-border);
    padding: 8px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .periodo-btn.ativo {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .filtros input[type="date"] {
    border: 1px solid var(--card-border);
    border-radius: 8px;
    padding: 7px 9px;
    font-size: 13px;
    color: var(--text);
  }
  .filtros .sep { color: var(--muted); font-size: 12px; margin: 0 2px; }
  #label-periodo { margin-left: auto; color: var(--muted); font-size: 12px; font-weight: 600; }

  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
    margin-bottom: 18px;
  }
  .kpi {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    padding: 14px 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    position: relative;
    overflow: hidden;
  }
  .kpi::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
    background: var(--barra, var(--accent));
  }
  .kpi .rotulo { font-size: 12px; color: var(--muted); font-weight: 600; margin-bottom: 6px; }
  .kpi .valor { font-size: 26px; font-weight: 800; line-height: 1; }
  .kpi .extra { font-size: 12px; color: var(--muted); margin-top: 5px; }

  .grade {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 14px;
    margin-bottom: 14px;
  }
  .painel {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    padding: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .painel.full { grid-column: 1 / -1; }
  .painel h2 { font-size: 15px; margin: 0 0 12px; }
  .painel .chart-wrap { position: relative; height: 260px; }
  .painel .chart-wrap.baixo { height: 200px; }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--card-border); }
  th { color: var(--muted); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: .02em; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .barra-mini { display: inline-block; height: 6px; border-radius: 4px; background: var(--accent); vertical-align: middle; margin-right: 6px; }
  .badge-pct { font-weight: 800; }
  .vazio { color: var(--muted); font-size: 13px; padding: 20px; text-align: center; }
  .carregando { color: var(--muted); font-size: 13px; padding: 40px; text-align: center; }
</style>
</head>
<body>

<div class="topo">
  <div>
    <h1>📊 Analytics</h1>
    <div class="sub">Resultados e desempenho de todos os leads, corretores e canais</div>
  </div>
  <a class="voltar-btn" href="/crm">← Voltar pro CRM</a>
</div>

<div class="filtros" id="filtros">
  <button class="periodo-btn" data-periodo="hoje">Hoje</button>
  <button class="periodo-btn" data-periodo="7dias">7 dias</button>
  <button class="periodo-btn" data-periodo="30dias">30 dias</button>
  <button class="periodo-btn" data-periodo="mes">Mês atual</button>
  <button class="periodo-btn" data-periodo="ano">Este ano</button>
  <button class="periodo-btn ativo" data-periodo="tudo">Tudo</button>
  <span class="sep">|</span>
  <input type="date" id="data-inicio">
  <span class="sep">até</span>
  <input type="date" id="data-fim">
  <button class="periodo-btn" id="btn-aplicar-custom">Aplicar</button>
  <span id="label-periodo"></span>
</div>

<div id="conteudo">
  <div class="carregando">Carregando dados...</div>
</div>

<script>
let CHARTS = {};
let PERIODO_ATUAL = 'tudo';

const CORES = {
  accent: '#4f6cff', accent2: '#7c5cff', ok: '#17a869', warn: '#f2a93b',
  danger: '#ef4d5e', info: '#1fb5c9', muted: '#c9cddb'
};
const PALETA = ['#4f6cff', '#17a869', '#f2a93b', '#1fb5c9', '#7c5cff', '#ef4d5e', '#e5a5e0', '#8a9099'];

function fmtPct(n, d) { if (!d) return '0%'; return Math.round((n / d) * 100) + '%'; }
function fmtNum(n) { return (n || 0).toLocaleString('pt-BR'); }

function calcularPeriodo(chave) {
  const hoje = new Date();
  const fim = new Date(hoje);
  let inicio = new Date(hoje);
  if (chave === 'hoje') { /* mesma data */ }
  else if (chave === '7dias') inicio.setDate(inicio.getDate() - 6);
  else if (chave === '30dias') inicio.setDate(inicio.getDate() - 29);
  else if (chave === 'mes') inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  else if (chave === 'ano') inicio = new Date(hoje.getFullYear(), 0, 1);
  else if (chave === 'tudo') return { inicio: null, fim: null };
  const toISO = d => d.toISOString().slice(0, 10);
  return { inicio: toISO(inicio), fim: toISO(fim) };
}

document.querySelectorAll('.periodo-btn[data-periodo]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.periodo-btn[data-periodo]').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    PERIODO_ATUAL = btn.dataset.periodo;
    const { inicio, fim } = calcularPeriodo(PERIODO_ATUAL);
    document.getElementById('data-inicio').value = inicio || '';
    document.getElementById('data-fim').value = fim || '';
    carregarDados(inicio, fim);
  });
});

document.getElementById('btn-aplicar-custom').addEventListener('click', () => {
  document.querySelectorAll('.periodo-btn[data-periodo]').forEach(b => b.classList.remove('ativo'));
  const inicio = document.getElementById('data-inicio').value || null;
  const fim = document.getElementById('data-fim').value || null;
  carregarDados(inicio, fim);
});

async function carregarDados(inicio, fim) {
  document.getElementById('conteudo').innerHTML = '<div class="carregando">Carregando dados...</div>';
  const label = document.getElementById('label-periodo');
  label.textContent = (inicio && fim) ? (formatarDataBR(inicio) + ' — ' + formatarDataBR(fim)) : 'Todo o período';

  const params = new URLSearchParams();
  if (inicio) params.set('inicio', inicio);
  if (fim) params.set('fim', fim);

  try {
    const res = await fetch('/api/analytics?' + params.toString());
    const data = await res.json();
    if (!data.ok) throw new Error(data.erro || 'Erro desconhecido');
    renderizar(data);
  } catch (err) {
    document.getElementById('conteudo').innerHTML = '<div class="vazio">Erro ao carregar analytics: ' + err.message + '</div>';
  }
}

function formatarDataBR(iso) {
  const [y, m, d] = iso.split('-');
  return d + '/' + m + '/' + y;
}

function renderizar(data) {
  const f = data.funil;
  const totalGeral = f.total || 0;

  document.getElementById('conteudo').innerHTML = \`
    <div class="kpis">
      <div class="kpi" style="--barra:\${CORES.accent}"><div class="rotulo">Total de leads</div><div class="valor">\${fmtNum(f.total)}</div></div>
      <div class="kpi" style="--barra:\${CORES.info}"><div class="rotulo">Contatados</div><div class="valor">\${fmtPct(f.contatou, f.total)}</div><div class="extra">\${fmtNum(f.contatou)} de \${fmtNum(f.total)}</div></div>
      <div class="kpi" style="--barra:\${CORES.accent2}"><div class="rotulo">Visitas</div><div class="valor">\${fmtPct(f.visita, f.total)}</div><div class="extra">\${fmtNum(f.visita)} lead(s)</div></div>
      <div class="kpi" style="--barra:\${CORES.warn}"><div class="rotulo">Propostas</div><div class="valor">\${fmtPct(f.proposta, f.total)}</div><div class="extra">\${fmtNum(f.proposta)} lead(s)</div></div>
      <div class="kpi" style="--barra:\${CORES.ok}"><div class="rotulo">Vendas</div><div class="valor">\${fmtPct(f.venda, f.total)}</div><div class="extra">\${fmtNum(f.venda)} venda(s)</div></div>
      <div class="kpi" style="--barra:\${CORES.danger}"><div class="rotulo">Sem retorno</div><div class="valor">\${fmtPct(f.sem_retorno, f.total)}</div><div class="extra">\${fmtNum(f.sem_retorno)} lead(s)</div></div>
      <div class="kpi" style="--barra:\${CORES.muted}"><div class="rotulo">Número inválido</div><div class="valor">\${fmtNum(f.numero_invalido)}</div></div>
      <div class="kpi" style="--barra:\${CORES.accent}"><div class="rotulo">Não identificados</div><div class="valor">\${fmtNum(data.nao_identificados)}</div><div class="extra">sem corretor/match</div></div>
    </div>

    <div class="grade">
      <div class="painel full">
        <h2>Funil de conversão</h2>
        <div class="chart-wrap baixo"><canvas id="chart-funil"></canvas></div>
      </div>

      <div class="painel">
        <h2>Leads por dia</h2>
        <div class="chart-wrap"><canvas id="chart-tendencia"></canvas></div>
      </div>

      <div class="painel">
        <h2>Leads por origem</h2>
        <div class="chart-wrap"><canvas id="chart-origem"></canvas></div>
      </div>

      <div class="painel">
        <h2>Leads por status</h2>
        <div class="chart-wrap"><canvas id="chart-status"></canvas></div>
      </div>

      <div class="painel">
        <h2>Volume por corretor</h2>
        <div class="chart-wrap"><canvas id="chart-corretor"></canvas></div>
      </div>

      <div class="painel full">
        <h2>Performance por corretor</h2>
        \${tabelaCorretores(data.corretores, totalGeral)}
      </div>
    </div>
  \`;

  desenharFunil(f);
  desenharTendencia(data.tendencia);
  desenharOrigem(data.origens);
  desenharStatus(data.status);
  desenharCorretor(data.corretores);
}

function tabelaCorretores(corretores, totalGeral) {
  if (!corretores || corretores.length === 0) return '<div class="vazio">Sem dados no período</div>';
  const linhas = corretores.map(c => {
    const pctConv = fmtPct(c.venda, c.total);
    const resposta = c.horas_media_resposta != null ? (c.horas_media_resposta < 1 ? '< 1h' : c.horas_media_resposta + 'h') : '—';
    return \`<tr>
      <td>\${c.corretor}</td>
      <td class="num">\${fmtNum(c.total)}</td>
      <td class="num">\${fmtPct(c.contatou, c.total)}</td>
      <td class="num">\${fmtNum(c.venda)}</td>
      <td class="num badge-pct">\${pctConv}</td>
      <td class="num">\${resposta}</td>
    </tr>\`;
  }).join('');
  return \`<table>
    <thead><tr>
      <th>Corretor</th><th class="num">Leads</th><th class="num">Contatou</th>
      <th class="num">Vendas</th><th class="num">Conversão</th><th class="num">Tempo médio 1º contato</th>
    </tr></thead>
    <tbody>\${linhas}</tbody>
  </table>\`;
}

function destruir(id) { if (CHARTS[id]) { CHARTS[id].destroy(); delete CHARTS[id]; } }

function desenharFunil(f) {
  destruir('funil');
  const etapas = [
    { rotulo: 'Total', valor: f.total, cor: CORES.accent },
    { rotulo: 'Contatado', valor: f.contatou, cor: CORES.info },
    { rotulo: 'Visita', valor: f.visita, cor: CORES.accent2 },
    { rotulo: 'Proposta', valor: f.proposta, cor: CORES.warn },
    { rotulo: 'Venda', valor: f.venda, cor: CORES.ok },
  ];
  const ctx = document.getElementById('chart-funil');
  CHARTS.funil = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: etapas.map(e => e.rotulo),
      datasets: [{ data: etapas.map(e => e.valor), backgroundColor: etapas.map(e => e.cor), borderRadius: 6, maxBarThickness: 60 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtNum(c.raw) + ' leads (' + fmtPct(c.raw, f.total) + ')' } } },
      scales: { x: { beginAtZero: true, grid: { color: '#eef0f6' } }, y: { grid: { display: false } } }
    }
  });
}

function desenharTendencia(tendencia) {
  destruir('tendencia');
  const ctx = document.getElementById('chart-tendencia');
  if (!tendencia || tendencia.length === 0) { ctx.parentElement.innerHTML = '<div class="vazio">Sem dados no período</div>'; return; }
  CHARTS.tendencia = new Chart(ctx, {
    type: 'line',
    data: {
      labels: tendencia.map(t => formatarDataBR(t.dia)),
      datasets: [{
        data: tendencia.map(t => t.total),
        borderColor: CORES.accent, backgroundColor: 'rgba(79,108,255,0.12)',
        fill: true, tension: 0.3, pointRadius: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: true, grid: { color: '#eef0f6' } } }
    }
  });
}

function desenharOrigem(origens) {
  destruir('origem');
  const ctx = document.getElementById('chart-origem');
  if (!origens || origens.length === 0) { ctx.parentElement.innerHTML = '<div class="vazio">Sem dados no período</div>'; return; }
  CHARTS.origem = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: origens.map(o => o.origem),
      datasets: [{ data: origens.map(o => o.total), backgroundColor: PALETA, borderWidth: 2, borderColor: '#fff' }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
  });
}

function desenharStatus(status) {
  destruir('status');
  const ctx = document.getElementById('chart-status');
  if (!status || status.length === 0) { ctx.parentElement.innerHTML = '<div class="vazio">Sem dados no período</div>'; return; }
  CHARTS.status = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: status.map(s => s.status),
      datasets: [{ data: status.map(s => s.total), backgroundColor: PALETA, borderWidth: 2, borderColor: '#fff' }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
  });
}

function desenharCorretor(corretores) {
  destruir('corretor');
  const ctx = document.getElementById('chart-corretor');
  if (!corretores || corretores.length === 0) { ctx.parentElement.innerHTML = '<div class="vazio">Sem dados no período</div>'; return; }
  CHARTS.corretor = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: corretores.map(c => c.corretor),
      datasets: [
        { label: 'Leads', data: corretores.map(c => c.total), backgroundColor: CORES.accent, borderRadius: 5 },
        { label: 'Vendas', data: corretores.map(c => c.venda), backgroundColor: CORES.ok, borderRadius: 5 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
      scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { beginAtZero: true, grid: { color: '#eef0f6' } } }
    }
  });
}

// Carrega "Tudo" por padrão
carregarDados(null, null);
</script>
</body>
</html>`;

module.exports = { ANALYTICS_HTML };
