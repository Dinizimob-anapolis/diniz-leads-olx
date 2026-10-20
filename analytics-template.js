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
  .kpi-clicavel { cursor: pointer; transition: box-shadow .15s, transform .15s; }
  .kpi-clicavel:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-1px); }

  .modal-overlay {
    display: none;
    position: fixed; inset: 0;
    background: rgba(20,22,30,0.45);
    align-items: center; justify-content: center;
    z-index: 100;
    padding: 20px;
  }
  .modal-overlay.aberto { display: flex; }
  .modal-caixa {
    background: var(--card);
    border-radius: var(--radius);
    max-width: 420px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0,0,0,0.25);
  }
  .modal-cabecalho {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 18px;
    border-bottom: 1px solid var(--card-border);
    position: sticky; top: 0;
    background: var(--card);
  }
  .modal-cabecalho h3 { margin: 0; font-size: 15px; }
  .modal-fechar {
    cursor: pointer; border: none; background: none;
    font-size: 20px; color: var(--muted); line-height: 1;
    padding: 2px 6px;
  }
  .modal-fechar:hover { color: var(--text); }
  .modal-corpo { padding: 14px 18px 18px; }
  .tabela-modal { width: 100%; border-collapse: collapse; font-size: 13px; }
  .tabela-modal th { text-align: left; color: var(--muted); font-weight: 600; font-size: 11px; padding: 6px 0; border-bottom: 1px solid var(--card-border); }
  .tabela-modal td { padding: 8px 0; border-bottom: 1px solid var(--card-border); }
  .tabela-modal tr:last-child td { border-bottom: none; }
  .tabela-modal .num { text-align: right; font-weight: 700; }

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

  .btn-repassados {
    background: var(--accent); color: #fff; border: none; padding: 9px 16px;
    border-radius: var(--radius); font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;
  }
  .rep-overlay { display: none; position: fixed; inset: 0; background: rgba(20,22,30,0.55); z-index: 200; padding: 14px; overflow: auto; }
  .rep-overlay.aberto { display: block; }
  .rep-caixa { background: var(--card); border-radius: var(--radius); max-width: 1280px; margin: 0 auto; padding: 16px 18px 20px; }
  .rep-topo { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
  .rep-topo h2 { margin: 0 0 3px; font-size: 18px; }
  .rep-chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
  .rep-chip { border: 1px solid var(--card-border); background: #fff; border-radius: 12px; padding: 8px 12px; cursor: pointer; min-width: 120px; }
  .rep-chip .n { font-size: 20px; font-weight: 800; }
  .rep-chip .r { font-size: 11px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .02em; }
  .rep-chip.ativo { outline: 2px solid var(--accent); }
  .rep-filtros { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; font-size: 13px; }
  .rep-filtros select, .rep-filtros input { padding: 6px 8px; border: 1px solid var(--card-border); border-radius: 8px; font-size: 13px; }
  .rep-tabela-wrap { overflow-x: auto; }
  .tag-sit { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 800; white-space: nowrap; }
  .sit-vermelho { background: #fde8ea; color: #c0293a; }
  .sit-amarelo { background: #fff3da; color: #a8700a; }
  .sit-verde { background: #e0f5ec; color: #11794c; }
  .sit-cinza { background: #eceef4; color: #5a6072; }
  .rep-nota { color: var(--muted); font-size: 12px; max-width: 260px; }
  .rep-resumo { margin: 14px 0 6px; font-size: 14px; font-weight: 800; }
</style>
</head>
<body>

<div class="topo">
  <div>
    <h1>{{TITULO}}</h1>
    <div class="sub">{{SUBTITULO}}</div>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;">
    <button class="btn-repassados" id="btn-repassados" style="display:{{REPASSADOS_DISPLAY}};" onclick="abrirRepassados()">🔎 Acompanhar repassados</button>
    <a class="voltar-btn" href="{{VOLTAR_HREF}}">{{VOLTAR_TEXTO}}</a>
  </div>
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


<div class="rep-overlay" id="rep-overlay" onclick="if(event.target===this) fecharRepassados()">
  <div class="rep-caixa">
    <div class="rep-topo">
      <div>
        <h2>🔎 Acompanhamento dos leads repassados</h2>
        <div class="sub">Leads reaquecidos e repassados aos corretores: quem está trabalhando e quem está parado.</div>
      </div>
      <button class="voltar-btn" onclick="fecharRepassados()">Fechar ✕</button>
    </div>
    <div class="rep-filtros">
      <label>Corretor <select id="rep-corretor" onchange="renderRepassados()"><option value="">Todos</option></select></label>
      <label>Parado após <select id="rep-dias" onchange="renderRepassados()"><option value="3">3 dias</option><option value="5">5 dias</option><option value="7" selected>7 dias</option><option value="15">15 dias</option></select></label>
      <label>Buscar <input id="rep-busca" placeholder="nome ou whatsapp" oninput="renderRepassados()"></label>
      <span class="sub" id="rep-periodo-aviso"></span>
    </div>
    <div class="rep-chips" id="rep-chips"></div>
    <div class="rep-resumo">Por corretor</div>
    <div class="rep-tabela-wrap" id="rep-por-corretor"></div>
    <div class="rep-resumo">Leads</div>
    <div class="rep-tabela-wrap" id="rep-tabela"></div>
  </div>
</div>

<div class="modal-overlay" id="modal-detalhe-overlay" onclick="if(event.target===this) fecharModalDetalhe()">
  <div class="modal-caixa">
    <div class="modal-cabecalho">
      <h3 id="modal-detalhe-titulo">Detalhe</h3>
      <button class="modal-fechar" onclick="fecharModalDetalhe()">&times;</button>
    </div>
    <div class="modal-corpo" id="modal-detalhe-corpo"></div>
  </div>
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
  // Se a página foi aberta como /analytics?corretor=Nome (admin/Juliane
  // vendo o CRM de um corretor específico), repassa esse filtro pra API —
  // senão ela ignora e mostra o total geral.
  const corretorDaPagina = new URLSearchParams(location.search).get('corretor');
  if (corretorDaPagina) params.set('corretor', corretorDaPagina);
  const origemDaPagina = new URLSearchParams(location.search).get('origem');
  if (origemDaPagina) params.set('origem', origemDaPagina);

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
      <div class="kpi kpi-clicavel" data-metrica="total" data-titulo="Total de leads" style="--barra:\${CORES.accent}"><div class="rotulo">Total de leads</div><div class="valor">\${fmtNum(f.total)}</div></div>
      <div class="kpi kpi-clicavel" data-metrica="aprovado" data-titulo="Aprovados" style="--barra:\${CORES.accent2}"><div class="rotulo">Aprovados</div><div class="valor">\${fmtNum(f.aprovado)}</div></div>
      <div class="kpi kpi-clicavel" data-metrica="visita" data-titulo="Visitas" style="--barra:\${CORES.accent2}"><div class="rotulo">Visitas</div><div class="valor">\${fmtNum(f.visita)}</div></div>
      <div class="kpi kpi-clicavel" data-metrica="em_negociacao" data-titulo="Em negociação" style="--barra:\${CORES.warn}"><div class="rotulo">Em negociação</div><div class="valor">\${fmtNum(f.em_negociacao)}</div></div>
      <div class="kpi kpi-clicavel" data-metrica="venda" data-titulo="Vendas" style="--barra:\${CORES.ok}"><div class="rotulo">Vendas</div><div class="valor">\${fmtNum(f.venda)}</div></div>
      <div class="kpi kpi-clicavel" data-metrica="sem_retorno" data-titulo="Sem retorno" style="--barra:\${CORES.danger}"><div class="rotulo">Sem retorno</div><div class="valor">\${fmtNum(f.sem_retorno)}</div></div>
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

  DADOS_CORRETORES = data.corretores || [];
  document.querySelectorAll('.kpi-clicavel').forEach(el => {
    el.addEventListener('click', () => mostrarDetalheMetrica(el.dataset.metrica, el.dataset.titulo));
  });
}

let DADOS_CORRETORES = [];

function mostrarDetalheMetrica(metrica, titulo) {
  const linhas = (DADOS_CORRETORES || [])
    .map(c => ({ corretor: c.corretor, valor: c[metrica] || 0 }))
    .filter(l => l.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const totalMetrica = linhas.reduce((soma, l) => soma + l.valor, 0);

  const corpo = linhas.length === 0
    ? '<div class="vazio">Nenhum corretor com esse número no período</div>'
    : \`<table class="tabela-modal">
        <thead><tr><th>Corretor</th><th class="num">\${titulo}</th></tr></thead>
        <tbody>\${linhas.map(l => \`<tr><td>\${l.corretor}</td><td class="num">\${fmtNum(l.valor)}</td></tr>\`).join('')}</tbody>
      </table>\`;

  document.getElementById('modal-detalhe-titulo').textContent = titulo + ' — por corretor';
  document.getElementById('modal-detalhe-corpo').innerHTML = corpo;
  document.getElementById('modal-detalhe-overlay').classList.add('aberto');
}

function fecharModalDetalhe() {
  document.getElementById('modal-detalhe-overlay').classList.remove('aberto');
}

function tabelaCorretores(corretores, totalGeral) {
  if (!corretores || corretores.length === 0) return '<div class="vazio">Sem dados no período</div>';
  const linhas = corretores.map(c => {
    const pctConv = fmtPct(c.venda, c.total);
    const resposta = c.horas_media_resposta != null ? (c.horas_media_resposta < 1 ? '< 1h' : c.horas_media_resposta + 'h') : '—';
    return \`<tr>
      <td>\${c.corretor}</td>
      <td class="num">\${fmtNum(c.total)}</td>
      <td class="num">\${fmtNum(c.visita)}</td>
      <td class="num">\${fmtNum(c.venda)}</td>
      <td class="num badge-pct">\${pctConv}</td>
      <td class="num">\${resposta}</td>
    </tr>\`;
  }).join('');
  return \`<table>
    <thead><tr>
      <th>Corretor</th><th class="num">Leads</th>
      <th class="num">Visitas</th><th class="num">Vendas</th><th class="num">Conversão</th><th class="num">Tempo médio 1º contato</th>
    </tr></thead>
    <tbody>\${linhas}</tbody>
  </table>\`;
}

function destruir(id) { if (CHARTS[id]) { CHARTS[id].destroy(); delete CHARTS[id]; } }

function desenharFunil(f) {
  destruir('funil');
  const etapas = [
    { rotulo: 'Total', valor: f.total, cor: CORES.accent },
    { rotulo: 'Aprovado', valor: f.aprovado, cor: CORES.accent2 },
    { rotulo: 'Visita', valor: f.visita, cor: CORES.accent2 },
    { rotulo: 'Em negociação', valor: f.em_negociacao, cor: CORES.warn },
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


// ─── Acompanhamento dos repassados ───
var REP_DADOS = [];
var REP_FILTRO_SIT = '';
var ETAPAS_PARADAS = ['Novo', 'Reaquecido', 'Reaquecendo', ''];

function repDiasDesde(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function repSituacao(l, limite) {
  var etapa = l.status_corretor || '';
  if (etapa === 'Sem retorno') return 'sem_retorno';
  var movimentou = ETAPAS_PARADAS.indexOf(etapa) === -1;
  var desdeMov = repDiasDesde(l.status_corretor_alterado_em);
  var desdeRepasse = repDiasDesde(l.repassado_em);
  if (!movimentou) return 'sem_movimentacao';
  if (desdeMov !== null && desdeMov > limite) return 'parado';
  return 'andamento';
}
var REP_ROTULO = {
  sem_movimentacao: ['🔴 Sem movimentação', 'sit-vermelho'],
  parado: ['🟡 Parado', 'sit-amarelo'],
  andamento: ['🟢 Em andamento', 'sit-verde'],
  sem_retorno: ['⚪ Sem retorno', 'sit-cinza']
};
function repFmtData(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function repEsc(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function repHa(dias) { return dias === null ? '—' : (dias === 0 ? 'hoje' : 'há ' + dias + 'd'); }

async function abrirRepassados() {
  document.getElementById('rep-overlay').classList.add('aberto');
  document.getElementById('rep-tabela').innerHTML = '<div class="carregando">Carregando...</div>';
  var params = new URLSearchParams();
  var ini = document.getElementById('data-inicio').value, fim = document.getElementById('data-fim').value;
  if (ini && fim) { params.set('inicio', ini); params.set('fim', fim); }
  document.getElementById('rep-periodo-aviso').textContent = (ini && fim) ? ('Período do repasse: ' + formatarDataBR(ini) + ' — ' + formatarDataBR(fim)) : 'Todo o período';
  try {
    var res = await fetch('/api/analytics/repassados?' + params.toString());
    var data = await res.json();
    if (!data.ok) throw new Error(data.erro || 'Erro');
    REP_DADOS = data.leads || [];
    var sel = document.getElementById('rep-corretor');
    var atual = sel.value;
    var nomes = Array.from(new Set(REP_DADOS.map(function (l) { return l.corretor; }))).sort();
    sel.innerHTML = '<option value="">Todos</option>' + nomes.map(function (n) { return '<option value="' + repEsc(n) + '">' + repEsc(n) + '</option>'; }).join('');
    sel.value = nomes.indexOf(atual) >= 0 ? atual : '';
    renderRepassados();
  } catch (err) {
    document.getElementById('rep-tabela').innerHTML = '<div class="vazio">Erro: ' + repEsc(err.message) + '</div>';
  }
}
function fecharRepassados() { document.getElementById('rep-overlay').classList.remove('aberto'); }
function repFiltrarSit(s) { REP_FILTRO_SIT = (REP_FILTRO_SIT === s ? '' : s); renderRepassados(); }

function renderRepassados() {
  var limite = parseInt(document.getElementById('rep-dias').value, 10);
  var corr = document.getElementById('rep-corretor').value;
  var busca = document.getElementById('rep-busca').value.trim().toLowerCase();
  var base = REP_DADOS.filter(function (l) {
    if (corr && l.corretor !== corr) return false;
    if (busca && (String(l.nome || '').toLowerCase().indexOf(busca) < 0 && String(l.whatsapp || '').indexOf(busca) < 0)) return false;
    return true;
  }).map(function (l) { l._sit = repSituacao(l, limite); return l; });

  var cont = { sem_movimentacao: 0, parado: 0, andamento: 0, sem_retorno: 0 };
  base.forEach(function (l) { cont[l._sit]++; });
  var chips = [['', 'Total repassados', base.length], ['sem_movimentacao', '🔴 Sem movimentação', cont.sem_movimentacao], ['parado', '🟡 Parados', cont.parado], ['andamento', '🟢 Em andamento', cont.andamento], ['sem_retorno', '⚪ Sem retorno', cont.sem_retorno]];
  document.getElementById('rep-chips').innerHTML = chips.map(function (c) {
    return '<div class="rep-chip ' + (REP_FILTRO_SIT === c[0] ? 'ativo' : '') + '" data-s="' + c[0] + '" onclick="repFiltrarSit(this.dataset.s)"><div class="n">' + c[2] + '</div><div class="r">' + c[1] + '</div></div>';
  }).join('');

  // resumo por corretor
  var porC = {};
  base.forEach(function (l) {
    var o = porC[l.corretor] || (porC[l.corretor] = { total: 0, sem_movimentacao: 0, parado: 0, andamento: 0, sem_retorno: 0 });
    o.total++; o[l._sit]++;
  });
  var linhasC = Object.keys(porC).sort(function (a, b) { return porC[b].sem_movimentacao - porC[a].sem_movimentacao; }).map(function (n) {
    var o = porC[n];
    var trab = o.andamento + o.parado + o.sem_retorno;
    return '<tr><td><b>' + repEsc(n) + '</b></td><td class="num">' + o.total + '</td><td class="num">' + o.sem_movimentacao + '</td><td class="num">' + o.parado + '</td><td class="num">' + o.andamento + '</td><td class="num">' + o.sem_retorno + '</td><td class="num">' + fmtPct(trab, o.total) + '</td></tr>';
  }).join('');
  document.getElementById('rep-por-corretor').innerHTML = linhasC
    ? '<table><thead><tr><th>Corretor</th><th class="num">Repassados</th><th class="num">Sem movimentação</th><th class="num">Parados</th><th class="num">Em andamento</th><th class="num">Sem retorno</th><th class="num">% já mexeu</th></tr></thead><tbody>' + linhasC + '</tbody></table>'
    : '<div class="vazio">Nenhum lead repassado nesse filtro.</div>';

  // tabela de leads
  var ordem = { sem_movimentacao: 0, parado: 1, andamento: 2, sem_retorno: 3 };
  var lista = base.filter(function (l) { return !REP_FILTRO_SIT || l._sit === REP_FILTRO_SIT; }).sort(function (a, b) {
    if (ordem[a._sit] !== ordem[b._sit]) return ordem[a._sit] - ordem[b._sit];
    return new Date(a.repassado_em || 0) - new Date(b.repassado_em || 0);
  });
  var linhas = lista.map(function (l) {
    var rot = REP_ROTULO[l._sit];
    var zap = String(l.whatsapp || '').replace(/[^0-9]/g, '');
    var tarefa = l.tarefa_sdr ? ('📌 ' + repEsc(l.tarefa_sdr) + (l.tarefa_data ? ' (' + repFmtData(l.tarefa_data) + ')' : '')) : '—';
    var nota = l.notas_sdr ? repEsc(String(l.notas_sdr).split(String.fromCharCode(10)).slice(-1)[0]) : '';
    var contato = l.primeiro_contato_em ? ('✅ ' + repFmtData(l.primeiro_contato_em)) : (l.contatou ? '✅ sim' : '—');
    return '<tr>' +
      '<td><span class="tag-sit ' + rot[1] + '">' + rot[0] + '</span></td>' +
      '<td><b>' + repEsc(l.nome || 'Sem nome') + '</b><br>' + (zap ? '<a href="https://wa.me/' + zap + '" target="_blank" style="color:var(--accent);font-size:12px;">' + repEsc(l.whatsapp) + '</a>' : '') + '</td>' +
      '<td>' + repEsc(l.corretor) + '</td>' +
      '<td>' + repFmtData(l.repassado_em) + '<br><span class="sub">' + repHa(repDiasDesde(l.repassado_em)) + '</span></td>' +
      '<td>' + repEsc(l.status_corretor || 'Novo') + '</td>' +
      '<td>' + (l.status_corretor_alterado_em && ETAPAS_PARADAS.indexOf(l.status_corretor || '') === -1 ? repFmtData(l.status_corretor_alterado_em) + '<br><span class="sub">' + repHa(repDiasDesde(l.status_corretor_alterado_em)) + '</span>' : '<span class="sub">nunca mexeu</span>') + '</td>' +
      '<td>' + contato + '</td>' +
      '<td>' + tarefa + '</td>' +
      '<td class="rep-nota">' + nota + '</td>' +
      '</tr>';
  }).join('');
  document.getElementById('rep-tabela').innerHTML = linhas
    ? '<table><thead><tr><th>Situação</th><th>Lead</th><th>Corretor</th><th>Repassado</th><th>Etapa do corretor</th><th>Última movimentação</th><th>Contato com o lead</th><th>Tarefa</th><th>Última nota</th></tr></thead><tbody>' + linhas + '</tbody></table>'
    : '<div class="vazio">Nenhum lead nesse filtro.</div>';
}

// Carrega "Tudo" por padrão
carregarDados(null, null);
</script>
</body>
</html>`;

module.exports = { ANALYTICS_HTML };
