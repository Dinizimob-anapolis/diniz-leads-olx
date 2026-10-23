const ANALYTICS_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Análise - Diniz Imóveis</title>
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

  /* ── visual novo ── */
  body { padding: 18px; max-width: 1400px; margin: 0 auto; }
  h1 { font-size: 24px; letter-spacing: -.01em; }
  .filtros { position: sticky; top: 0; z-index: 20; }
  .filtros .auto { font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 4px; cursor: pointer; }
  .kpis { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
  .kpi { padding: 16px 16px 14px 20px; }
  .kpi .valor { font-size: 30px; letter-spacing: -.02em; }
  .kpi .extra { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; min-height: 18px; }
  .delta { font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 999px; }
  .delta.bom { background: #e0f5ec; color: #11794c; }
  .delta.ruim { background: #fde8ea; color: #c0293a; }
  .delta.neutro { background: #eceef4; color: #5a6072; }
  .nota-comp { font-size: 12px; color: var(--muted); margin: -8px 0 14px; }
  .alertas { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .alerta { font-size: 13px; padding: 8px 12px; border-radius: 10px; border: 1px solid transparent; font-family: inherit; }
  button.alerta { cursor: pointer; }
  .alerta-vermelho { background: #fde8ea; color: #a31f2f; border-color: #f7c5cb; }
  .alerta-amarelo { background: #fff3da; color: #8a5a06; border-color: #f4dba5; }
  .alerta-cinza { background: #eceef4; color: #4a5064; }
  .alerta-verde { background: #e0f5ec; color: #11794c; }
  .alerta-ouro { background: #fff6d6; color: #7a5b00; border-color: #efdc96; }
  .painel h2 { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .painel h2 .dica { font-size: 11px; font-weight: 500; color: var(--muted); }
  .funil { display: flex; flex-direction: column; gap: 9px; }
  .funil-linha { display: grid; grid-template-columns: 120px 1fr 70px; gap: 8px; align-items: center; row-gap: 2px; }
  .funil-rotulo { font-size: 13px; font-weight: 600; }
  .funil-trilho { background: #eef0f6; border-radius: 8px; height: 22px; overflow: hidden; }
  .funil-barra { height: 100%; border-radius: 8px; transition: width .4s; }
  .funil-num { text-align: right; font-size: 13px; }
  .funil-num span { color: var(--muted); font-size: 11px; margin-left: 5px; }
  .funil-passo { grid-column: 2 / 4; font-size: 11px; color: var(--muted); min-height: 0; }
  .funil-passo:empty { display: none; }
  .grade { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tabela-wrap { overflow-x: auto; margin-top: 8px; }
  th.ord { cursor: pointer; user-select: none; white-space: nowrap; }
  th.ord:hover, th.ord.ativa { color: var(--accent); }
  .camp-nome { max-width: 380px; }
  tbody tr:hover td { background: #f7f8fc; }
  @media (max-width: 640px) {
    body { padding: 12px; }
    .grade { grid-template-columns: minmax(0, 1fr); }
    .funil-linha { grid-template-columns: 90px 1fr 62px; }
    #label-periodo { margin-left: 0; width: 100%; }
  }

  .orc-form { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 12px; }
  .orc-form label { font-size: 12px; color: var(--muted); font-weight: 600; display: flex; flex-direction: column; gap: 3px; }
  .orc-form input { padding: 8px 10px; border: 1px solid var(--card-border); border-radius: 8px; font-size: 14px; }
  .orc-form button { background: var(--accent); color: #fff; border: none; padding: 10px 16px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 13px; }
  .orc-resumo { display: flex; gap: 10px; flex-wrap: wrap; margin: 10px 0; }
  .orc-resumo .caixa { background: #f7f8fc; border: 1px solid var(--card-border); border-radius: 12px; padding: 10px 14px; min-width: 190px; }
  .orc-resumo .caixa b { font-size: 20px; display: block; }
  .orc-resumo .caixa span { font-size: 12px; color: var(--muted); }
  .orc-apagar { background: none; border: none; color: var(--danger); cursor: pointer; font-size: 13px; }
  .tag-zero { background: #fde8ea; color: #c0293a; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 800; }
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
  <button class="periodo-btn" id="btn-atualizar-agora" title="Atualizar agora">↻ Atualizar</button>
  <label class="auto"><input type="checkbox" id="auto-atualizar"> auto (2 min)</label>
  <span class="sub" id="hora-atualizacao"></span>
</div>

<div id="conteudo">
  <div class="carregando">Carregando dados...</div>
</div>

<div id="orcamento-painel" style="display:none;"></div>


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

async function carregarDados(inicio, fim, silencioso) {
  if (!silencioso) document.getElementById('conteudo').innerHTML = '<div class="carregando">Carregando dados...</div>';
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
    document.getElementById('conteudo').innerHTML = '<div class="vazio">Erro ao carregar a análise: ' + err.message + '</div>';
  }
}

function formatarDataBR(iso) {
  const [y, m, d] = iso.split('-');
  return d + '/' + m + '/' + y;
}

var ORDEM_ETAPAS = ['Sem corretor ainda', 'Novo', 'Reaquecido', 'Aguardando retorno', 'Aguardando documentação', 'Aguardando aprovação', 'Aprovado', 'Visita', 'Em negociação', 'Venda', 'Sem retorno'];
var ULTIMOS_DADOS = null;
var ORDEM_TABELA = { chave: 'total', dir: -1 };
var AUTO_TIMER = null;

function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function pct(n, d) { return d ? (n / d) * 100 : 0; }
function fmtHoras(h) { if (h == null) return '—'; h = Number(h); if (h < 1) return '< 1h'; if (h >= 48) return (h / 24).toFixed(1).replace('.', ',') + ' dias'; return h.toFixed(1).replace('.', ',') + 'h'; }

// Variação contra o período anterior. invertido = quando menos é melhor (ex: sem retorno).
function delta(atual, anterior, invertido) {
  if (anterior == null) return '';
  atual = Number(atual) || 0; anterior = Number(anterior) || 0;
  if (anterior === 0 && atual === 0) return '<span class="delta neutro">= 0</span>';
  if (anterior === 0) return '<span class="delta bom">novo</span>';
  var v = ((atual - anterior) / anterior) * 100;
  if (Math.abs(v) < 0.5) return '<span class="delta neutro">= igual</span>';
  var bom = invertido ? v < 0 : v > 0;
  return '<span class="delta ' + (bom ? 'bom' : 'ruim') + '">' + (v > 0 ? '▲ +' : '▼ ') + Math.round(v) + '%</span>';
}

function kpiCard(rotulo, valor, extra, cor, metrica, dl) {
  return '<div class="kpi' + (metrica ? ' kpi-clicavel' : '') + '"' + (metrica ? ' data-metrica="' + metrica + '" data-titulo="' + esc(rotulo) + '"' : '') + ' style="--barra:' + cor + '">' +
    '<div class="rotulo">' + esc(rotulo) + '</div><div class="valor">' + valor + '</div>' +
    '<div class="extra">' + (dl || '') + (extra ? '<span>' + extra + '</span>' : '') + '</div></div>';
}

function renderizar(data) {
  ULTIMOS_DADOS = data;
  var f = data.funil || {};
  var ant = data.anterior || null;
  var al = data.alertas || {};
  var total = f.total || 0;
  var rotAnt = data.periodo_anterior ? ('vs ' + formatarDataBR(data.periodo_anterior.inicio) + ' a ' + formatarDataBR(data.periodo_anterior.fim)) : '';
  var conv = pct(f.venda, total), convAnt = ant ? pct(ant.venda, ant.total) : null;

  var h = '';
  // ── KPIs ──
  h += '<div class="kpis">' +
    kpiCard('Leads recebidos', fmtNum(total), rotAnt ? '' : '', CORES.accent, 'total', delta(total, ant && ant.total, false)) +
    kpiCard('Visitas', fmtNum(f.visita), fmtPct(f.visita, total) + ' dos leads', CORES.accent2, 'visita', delta(f.visita, ant && ant.visita, false)) +
    kpiCard('Em negociação', fmtNum(f.em_negociacao), fmtPct(f.em_negociacao, total) + ' dos leads', CORES.warn, 'em_negociacao', delta(f.em_negociacao, ant && ant.em_negociacao, false)) +
    kpiCard('Vendas', fmtNum(f.venda), 'conversão ' + conv.toFixed(1).replace('.', ',') + '%', CORES.ok, 'venda', delta(f.venda, ant && ant.venda, false)) +
    kpiCard('Sem retorno', fmtNum(f.sem_retorno), fmtPct(f.sem_retorno, total) + ' dos leads', CORES.danger, 'sem_retorno', delta(f.sem_retorno, ant && ant.sem_retorno, true)) +
    '</div>';
  h += '<div class="nota-comp">Contagem: todos os leads que entraram desde 17/09 (campanha, cadastro manual ou de corretor), com ou sem corretor definido, mais os anteriores que já tiveram movimentação. Os contatos que a SDR está reaquecendo não entram nos leads: aparecem à parte, na coluna SDR por dia.</div>';
  if (rotAnt) h += '<div class="nota-comp">Variação ' + esc(rotAnt) + '. Etapas (visita, negociação, venda) mostram onde o lead está agora.</div>';

  // ── Alertas ──
  var alertas = [];
  if (al.parados > 0) alertas.push('<button class="alerta alerta-vermelho" data-parados="1"><b>' + fmtNum(al.parados) + '</b> leads parados há mais de 2 dias, sem o corretor mexer</button>');
  if (al.tarefas_atrasadas > 0) alertas.push('<span class="alerta alerta-amarelo"><b>' + fmtNum(al.tarefas_atrasadas) + '</b> tarefas atrasadas</span>');
  if (f.numero_invalido > 0) alertas.push('<span class="alerta alerta-cinza"><b>' + fmtNum(f.numero_invalido) + '</b> números inválidos</span>');
  if (data.nao_identificados > 0) alertas.push('<span class="alerta alerta-cinza"><b>' + fmtNum(data.nao_identificados) + '</b> mensagens não identificadas</span>');
  if (f.cliente_ouro > 0) alertas.push('<span class="alerta alerta-ouro"><b>' + fmtNum(f.cliente_ouro) + '</b> clientes ouro ⭐</span>');
  h += '<div class="alertas">' + (alertas.length ? alertas.join('') : '<span class="alerta alerta-verde">✅ Nada parado no momento</span>') + '</div>';

  // ── Funil + Etapas ──
  h += '<div class="grade">';
  h += '<div class="painel"><h2>Funil de conversão</h2>' + funilHtml(f) + '</div>';
  h += '<div class="painel"><h2>Onde estão os leads agora</h2><div class="chart-wrap"><canvas id="chart-etapas"></canvas></div></div>';
  h += '<div class="painel full"><h2>Leads por dia</h2><div class="chart-wrap"><canvas id="chart-tendencia"></canvas></div>' + tabelaPorDia(data.tendencia, data.sdr_por_dia) + '</div>';
  h += '<div class="painel"><h2>Horário em que os leads chegam</h2><div class="chart-wrap"><canvas id="chart-horas"></canvas></div></div>';
  h += '<div class="painel"><h2>Origem dos leads</h2><div class="chart-wrap"><canvas id="chart-origem"></canvas></div>' + tabelaOrigens(data.origens, total) + '</div>';
  h += '<div class="painel full"><h2>Lead nosso × lead do corretor</h2>' + tabelaTipos(data.tipos, total) + '</div>';
  h += '<div class="painel full"><h2>Campanhas / imóveis que mais trazem lead</h2>' + tabelaCampanhas(data.campanhas, total) + '</div>';
  h += '<div class="painel full"><h2>Ranking dos corretores <span class="dica">clique no título da coluna para ordenar</span></h2><div id="tabela-corretores"></div></div>';
  h += '</div>';
  document.getElementById('conteudo').innerHTML = h;

  DADOS_CORRETORES = data.corretores || [];
  desenharTendencia(data.tendencia, data.sdr_por_dia);
  desenharHoras(data.horas);
  desenharOrigem(data.origens);
  desenharEtapas(data.etapas);
  renderTabelaCorretores();
  document.querySelectorAll('[data-parados]').forEach(function (el) {
    el.addEventListener('click', function () { mostrarDetalheMetrica('parados', 'Leads parados (+2 dias)'); });
  });
  document.querySelectorAll('.kpi-clicavel').forEach(function (el) {
    el.addEventListener('click', function () { mostrarDetalheMetrica(el.dataset.metrica, el.dataset.titulo); });
  });
  var agora = new Date();
  document.getElementById('hora-atualizacao').textContent = 'Atualizado às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function funilHtml(f) {
  var total = f.total || 0;
  var etapas = [
    ['Leads recebidos', f.total, CORES.accent],
    ['Aprovados', f.aprovado, CORES.accent2],
    ['Visitas', f.visita, CORES.accent2],
    ['Em negociação', f.em_negociacao, CORES.warn],
    ['Vendas', f.venda, CORES.ok]
  ];
  if (!total) return '<div class="vazio">Sem leads no período</div>';
  var out = '<div class="funil">';
  etapas.forEach(function (e, i) {
    var w = Math.max(3, pct(e[1], total));
    var pp = (i > 0 && etapas[i - 1][1]) ? Math.round(pct(e[1], etapas[i - 1][1])) : null;
    var passo = (pp !== null && pp <= 100) ? pp + '% da etapa anterior' : '';
    out += '<div class="funil-linha"><div class="funil-rotulo">' + e[0] + '</div>' +
      '<div class="funil-trilho"><div class="funil-barra" style="width:' + w + '%;background:' + e[2] + '"></div></div>' +
      '<div class="funil-num"><b>' + fmtNum(e[1]) + '</b><span>' + Math.round(pct(e[1], total)) + '%</span></div>' +
      (passo ? '<div class="funil-passo">' + passo + '</div>' : '<div class="funil-passo"></div>') + '</div>';
  });
  return out + '</div>';
}

function tabelaTipos(tipos, total) {
  var mapa = { 'Imobiliária': { total: 0, visita: 0, venda: 0 }, 'Pessoal': { total: 0, visita: 0, venda: 0 } };
  (tipos || []).forEach(function (x) { mapa[x.tipo] = x; });
  var nomes = { 'Imobiliária': 'Lead nosso (imobiliária)', 'Pessoal': 'Lead do corretor (pessoal)' };
  var l = ['Imobiliária', 'Pessoal'].map(function (k) {
    var x = mapa[k];
    return '<tr><td>' + nomes[k] + '</td><td class="num">' + fmtNum(x.total) + '</td><td class="num">' + fmtPct(x.total, total) + '</td><td class="num">' + fmtNum(x.visita) + '</td><td class="num">' + fmtNum(x.venda) + '</td></tr>';
  }).join('');
  return '<div class="tabela-wrap"><table><thead><tr><th>Tipo</th><th class="num">Leads</th><th class="num">% do total</th><th class="num">Visitas</th><th class="num">Vendas</th></tr></thead><tbody>' + l + '</tbody></table></div>';
}

function tabelaOrigens(origens, total) {
  if (!origens || !origens.length) return '';
  var l = origens.map(function (o) {
    return '<tr><td>' + esc(o.origem) + '</td><td class="num">' + fmtNum(o.total) + '</td><td class="num">' + fmtPct(o.total, total) + '</td><td class="num">' + fmtNum(o.venda) + '</td></tr>';
  }).join('');
  return '<div class="tabela-wrap"><table><thead><tr><th>Origem</th><th class="num">Leads</th><th class="num">% do total</th><th class="num">Vendas</th></tr></thead><tbody>' + l + '</tbody></table></div>';
}

function tabelaCampanhas(camps, total) {
  if (!camps || !camps.length) return '<div class="vazio">Sem dados no período</div>';
  var max = Math.max.apply(null, camps.map(function (c) { return c.total; })) || 1;
  var l = camps.map(function (c) {
    return '<tr><td class="camp-nome">' + esc(c.campanha) + '</td>' +
      '<td class="num"><span class="barra-mini" style="width:' + Math.round((c.total / max) * 90) + 'px"></span>' + fmtNum(c.total) + '</td>' +
      '<td class="num">' + fmtNum(c.visita) + '</td><td class="num">' + fmtNum(c.venda) + '</td>' +
      '<td class="num badge-pct">' + fmtPct(c.venda, c.total) + '</td></tr>';
  }).join('');
  return '<div class="tabela-wrap"><table><thead><tr><th>Campanha / imóvel</th><th class="num">Leads</th><th class="num">Visitas</th><th class="num">Vendas</th><th class="num">Conversão</th></tr></thead><tbody>' + l + '</tbody></table></div>';
}

var DADOS_CORRETORES = [];

function mostrarDetalheMetrica(metrica, titulo) {
  var linhas = (DADOS_CORRETORES || [])
    .map(function (c) { return { corretor: c.corretor, valor: c[metrica] || 0 }; })
    .filter(function (l) { return l.valor > 0; })
    .sort(function (a, b) { return b.valor - a.valor; });
  var corpo = linhas.length === 0
    ? '<div class="vazio">Nenhum corretor com esse número no período</div>'
    : '<table class="tabela-modal"><thead><tr><th>Corretor</th><th class="num">' + esc(titulo) + '</th></tr></thead><tbody>' +
      linhas.map(function (l) { return '<tr><td>' + esc(l.corretor) + '</td><td class="num">' + fmtNum(l.valor) + '</td></tr>'; }).join('') + '</tbody></table>';
  document.getElementById('modal-detalhe-titulo').textContent = titulo + ' — por corretor';
  document.getElementById('modal-detalhe-corpo').innerHTML = corpo;
  document.getElementById('modal-detalhe-overlay').classList.add('aberto');
}

function fecharModalDetalhe() {
  document.getElementById('modal-detalhe-overlay').classList.remove('aberto');
}

function ordenarTabela(chave) {
  if (ORDEM_TABELA.chave === chave) ORDEM_TABELA.dir *= -1; else { ORDEM_TABELA.chave = chave; ORDEM_TABELA.dir = chave === 'corretor' ? 1 : -1; }
  renderTabelaCorretores();
}

function valorOrdem(c, chave) {
  if (chave === 'corretor') return String(c.corretor).toLowerCase();
  if (chave === 'taxa_contato') return pct(c.contatou, c.total);
  if (chave === 'conversao') return pct(c.venda, c.total);
  if (chave === 'horas_media_resposta') return c.horas_media_resposta == null ? 9999 : Number(c.horas_media_resposta);
  return Number(c[chave]) || 0;
}

function renderTabelaCorretores() {
  var el = document.getElementById('tabela-corretores');
  var cs = (DADOS_CORRETORES || []).slice();
  if (!cs.length) { el.innerHTML = '<div class="vazio">Sem dados no período</div>'; return; }
  var k = ORDEM_TABELA.chave, d = ORDEM_TABELA.dir;
  cs.sort(function (a, b) { var x = valorOrdem(a, k), y = valorOrdem(b, k); return x < y ? -d : x > y ? d : 0; });
  var totalGeral = cs.reduce(function (s, c) { return s + c.total; }, 0) || 1;
  var maxConv = 0, melhor = null;
  cs.forEach(function (c) { var v = pct(c.venda, c.total); if (c.total >= 5 && v > maxConv) { maxConv = v; melhor = c.corretor; } });
  function th(chave, rot, num) {
    return '<th class="' + (num ? 'num ' : '') + 'ord' + (k === chave ? ' ativa' : '') + '" data-ord="' + chave + '">' + rot + (k === chave ? (d > 0 ? ' ▲' : ' ▼') : '') + '</th>';
  }
  var linhas = cs.map(function (c) {
    var conv = pct(c.venda, c.total);
    var parados = c.parados || 0;
    return '<tr><td><b>' + esc(c.corretor) + '</b>' + (melhor === c.corretor && maxConv > 0 ? ' <span title="Maior conversão (mín. 5 leads)">🏆</span>' : '') + '</td>' +
      '<td class="num"><span class="barra-mini" style="width:' + Math.round((c.total / totalGeral) * 100) + 'px"></span>' + fmtNum(c.total) + '</td>' +
      '<td class="num">' + (parados > 0 ? '<span class="tag-sit sit-vermelho">' + parados + '</span>' : '<span class="sub">0</span>') + '</td>' +
      '<td class="num">' + fmtNum(c.visita) + '</td><td class="num">' + fmtNum(c.em_negociacao) + '</td><td class="num">' + fmtNum(c.venda) + '</td>' +
      '<td class="num badge-pct">' + conv.toFixed(1).replace('.', ',') + '%</td></tr>';
  }).join('');
  el.onclick = function (ev) { var t = ev.target.closest('[data-ord]'); if (t) ordenarTabela(t.getAttribute('data-ord')); };
  el.innerHTML = '<div class="tabela-wrap"><table><thead><tr>' +
    th('corretor', 'Corretor', false) + th('total', 'Leads', true) + th('parados', 'Parados +2d', true) +
    th('visita', 'Visitas', true) + th('em_negociacao', 'Negociação', true) + th('venda', 'Vendas', true) + th('conversao', 'Conversão', true) +
    '</tr></thead><tbody>' + linhas + '</tbody></table></div>';
}

function destruir(id) { if (CHARTS[id]) { CHARTS[id].destroy(); delete CHARTS[id]; } }
function semDados(ctx) { ctx.parentElement.innerHTML = '<div class="vazio">Sem dados no período</div>'; }

function desenharTendencia(tendencia, sdr) {
  destruir('tendencia');
  var ctx = document.getElementById('chart-tendencia');
  tendencia = tendencia || []; sdr = sdr || [];
  if (tendencia.length === 0 && sdr.length === 0) { semDados(ctx); return; }
  var mapaG = {}, mapaS = {}, dias = {};
  tendencia.forEach(function (t) { mapaG[t.dia] = t.total; dias[t.dia] = 1; });
  sdr.forEach(function (t) { mapaS[t.dia] = t.total; dias[t.dia] = 1; });
  var lista = Object.keys(dias).sort();
  var ds = [{ label: 'Leads (campanha e cadastros)', data: lista.map(function (d) { return mapaG[d] || 0; }), backgroundColor: CORES.accent, borderRadius: 4, maxBarThickness: 28 }];
  if (sdr.length) ds.push({ label: 'SDR (reaquecimento)', data: lista.map(function (d) { return mapaS[d] || 0; }), backgroundColor: '#f2941c', borderRadius: 4, maxBarThickness: 28 });
  CHARTS.tendencia = new Chart(ctx, {
    type: 'bar',
    data: { labels: lista.map(function (d) { return formatarDataBR(d).slice(0, 5); }), datasets: ds },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: ds.length > 1 }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + fmtNum(c.raw); } } } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 14 } }, y: { beginAtZero: true, grid: { color: '#eef0f6' }, ticks: { precision: 0 } } }
    }
  });
}

function tabelaPorDia(tendencia, sdr) {
  tendencia = tendencia || []; sdr = sdr || [];
  if (!sdr.length) return '';
  var mapaG = {}, mapaS = {}, dias = {}, totG = 0, totS = 0;
  tendencia.forEach(function (t) { mapaG[t.dia] = t.total; dias[t.dia] = 1; totG += t.total; });
  sdr.forEach(function (t) { mapaS[t.dia] = t.total; dias[t.dia] = 1; totS += t.total; });
  var lista = Object.keys(dias).sort().reverse();
  var l = lista.map(function (d) { return '<tr><td>' + esc(formatarDataBR(d)) + '</td><td class="num">' + fmtNum(mapaG[d] || 0) + '</td><td class="num">' + fmtNum(mapaS[d] || 0) + '</td></tr>'; }).join('');
  return '<div class="tabela-wrap" style="max-height:280px;overflow:auto;margin-top:10px"><table><thead><tr><th>Dia</th><th class="num">Leads</th><th class="num">SDR (reaquecimento)</th></tr></thead><tbody>' + l + '<tr><td><b>Total</b></td><td class="num"><b>' + fmtNum(totG) + '</b></td><td class="num"><b>' + fmtNum(totS) + '</b></td></tr></tbody></table></div>';
}

function desenharHoras(horas) {
  destruir('horas');
  var ctx = document.getElementById('chart-horas');
  if (!horas || horas.length === 0) { semDados(ctx); return; }
  var v = []; for (var i = 0; i < 24; i++) v.push(0);
  horas.forEach(function (x) { v[x.hora] = x.total; });
  var max = Math.max.apply(null, v);
  CHARTS.horas = new Chart(ctx, {
    type: 'bar',
    data: { labels: v.map(function (_, i) { return i + 'h'; }), datasets: [{ data: v, backgroundColor: v.map(function (n) { return n === max && max > 0 ? CORES.warn : CORES.accent2; }), borderRadius: 3 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return fmtNum(c.raw) + ' leads'; } } } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } }, y: { beginAtZero: true, grid: { color: '#eef0f6' }, ticks: { precision: 0 } } }
    }
  });
}

function desenharOrigem(origens) {
  destruir('origem');
  var ctx = document.getElementById('chart-origem');
  if (!origens || origens.length === 0) { semDados(ctx); return; }
  CHARTS.origem = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: origens.map(function (o) { return o.origem; }), datasets: [{ data: origens.map(function (o) { return o.total; }), backgroundColor: PALETA, borderWidth: 2, borderColor: '#fff' }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12 } } } } }
  });
}

function desenharEtapas(etapas) {
  destruir('etapas');
  var ctx = document.getElementById('chart-etapas');
  if (!etapas || etapas.length === 0) { semDados(ctx); return; }
  var mapa = {}; etapas.forEach(function (e) { mapa[e.etapa] = e.total; });
  var rotulos = ORDEM_ETAPAS.filter(function (e) { return mapa[e]; });
  Object.keys(mapa).forEach(function (e) { if (rotulos.indexOf(e) < 0) rotulos.push(e); });
  var cores = { 'Sem corretor ainda': '#5a6072', 'Novo': '#8a9099', 'Reaquecido': '#f2941c', 'Venda': CORES.ok, 'Sem retorno': CORES.danger, 'Em negociação': CORES.warn };
  CHARTS.etapas = new Chart(ctx, {
    type: 'bar',
    data: { labels: rotulos, datasets: [{ data: rotulos.map(function (e) { return mapa[e]; }), backgroundColor: rotulos.map(function (e) { return cores[e] || CORES.accent; }), borderRadius: 5, maxBarThickness: 22 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return fmtNum(c.raw) + ' leads'; } } } },
      scales: { x: { beginAtZero: true, grid: { color: '#eef0f6' }, ticks: { precision: 0 } }, y: { grid: { display: false } } }
    }
  });
}

function configurarAuto() {
  var cb = document.getElementById('auto-atualizar');
  if (AUTO_TIMER) { clearInterval(AUTO_TIMER); AUTO_TIMER = null; }
  if (cb && cb.checked) {
    AUTO_TIMER = setInterval(function () {
      var ini = document.getElementById('data-inicio').value || null, fim = document.getElementById('data-fim').value || null;
      carregarDados(ini, fim, true);
    }, 120000);
  }
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


// ─── Orçamento do patrocinado × leads ───
var ORC = null;
function orcFmtMoeda(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function orcSomaDias(iso, n) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function orcDiasEntre(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); }

async function carregarOrcamento() {
  var box = document.getElementById('orcamento-painel');
  var btn = document.getElementById('btn-repassados');
  if (!box || (btn && btn.style.display === 'none')) return; // só equipe (não aparece pra corretor)
  try {
    var res = await fetch('/api/analytics/orcamentos');
    var data = await res.json();
    if (!data.ok) throw new Error(data.erro || 'Erro');
    ORC = data;
    box.style.display = 'block';
    renderOrcamento();
  } catch (err) {
    box.style.display = 'block';
    box.innerHTML = '<div class="painel"><div class="vazio">Erro ao carregar orçamento: ' + esc(err.message) + '</div></div>';
  }
}

function renderOrcamento() {
  var box = document.getElementById('orcamento-painel');
  var orc = ORC.orcamentos || [];
  var hoje = ORC.hoje;
  // períodos: cada registro vale até o dia anterior ao próximo registro (o último vale até hoje)
  var periodos = [];
  var leadsPorDia = {}; (ORC.leads || []).forEach(function (x) { leadsPorDia[x.dia] = x.total; });
  orc.forEach(function (o, i) {
    var fim = (i + 1 < orc.length) ? orcSomaDias(orc[i + 1].data, -1) : hoje;
    if (fim < o.data) return;
    var dias = orcDiasEntre(o.data, fim) + 1, leads = 0;
    for (var k = 0; k < dias; k++) leads += leadsPorDia[orcSomaDias(o.data, k)] || 0;
    periodos.push({ id: o.id, inicio: o.data, fim: fim, valor: o.valor, obs: o.obs, dias: dias, leads: leads, porDia: dias ? leads / dias : 0,
      custoLead: (leads > 0 && o.valor > 0) ? (o.valor * dias) / leads : null, investido: o.valor * dias });
  });
  var zer = periodos.filter(function (p) { return p.valor === 0; });
  var com = periodos.filter(function (p) { return p.valor > 0; });
  function media(arr) { var d = arr.reduce(function (s, p) { return s + p.dias; }, 0), l = arr.reduce(function (s, p) { return s + p.leads; }, 0); return d ? { porDia: l / d, dias: d } : null; }
  var mz = media(zer), mc = media(com);

  var h = '<div class="painel"><h2>💰 Orçamento do patrocinado × chegada de leads <span class="dica">registre cada mudança de orçamento (valor por dia; 0 = zerado)</span></h2>' +
    '<div class="orc-form">' +
    '<label>A partir do dia<input type="date" id="orc-data" value="' + hoje + '"></label>' +
    '<label>Orçamento por dia (R$)<input type="text" inputmode="decimal" id="orc-valor" placeholder="ex: 50 ou 0"></label>' +
    '<label>Observação (opcional)<input type="text" id="orc-obs" placeholder="ex: campanha Gran Veneza" maxlength="200"></label>' +
    '<button id="orc-salvar">Salvar</button></div>';

  if (!orc.length) {
    h += '<div class="vazio">Nenhum orçamento registrado ainda. Registre o primeiro acima para começar a comparação.</div></div>';
    box.innerHTML = h; ligarOrcamento(); return;
  }

  h += '<div class="orc-resumo">' +
    (mc ? '<div class="caixa"><b>' + mc.porDia.toFixed(1).replace('.', ',') + ' leads/dia</b><span>com orçamento (' + mc.dias + ' dias)</span></div>' : '') +
    (mz ? '<div class="caixa"><b>' + mz.porDia.toFixed(1).replace('.', ',') + ' leads/dia</b><span>com orçamento zerado (' + mz.dias + ' dias)</span></div>' : '') +
    (mc && mz && mc.porDia > 0 ? '<div class="caixa"><b>' + Math.round((1 - mz.porDia / mc.porDia) * 100) + '%</b><span>de queda na chegada com o orçamento zerado</span></div>' : '') +
    '</div>';
  h += '<div class="chart-wrap"><canvas id="chart-orcamento"></canvas></div>';
  h += '<div class="tabela-wrap"><table><thead><tr><th>Período</th><th class="num">Orçamento/dia</th><th class="num">Dias</th><th class="num">Leads</th><th class="num">Leads/dia</th><th class="num">Custo por lead</th><th>Obs.</th><th></th></tr></thead><tbody>' +
    periodos.slice().reverse().map(function (p) {
      return '<tr><td>' + formatarDataBR(p.inicio) + ' a ' + formatarDataBR(p.fim) + '</td>' +
        '<td class="num">' + (p.valor === 0 ? '<span class="tag-zero">ZERADO</span>' : orcFmtMoeda(p.valor)) + '</td>' +
        '<td class="num">' + p.dias + '</td><td class="num">' + fmtNum(p.leads) + '</td>' +
        '<td class="num badge-pct">' + p.porDia.toFixed(1).replace('.', ',') + '</td>' +
        '<td class="num">' + (p.custoLead != null ? orcFmtMoeda(p.custoLead) : '—') + '</td>' +
        '<td>' + esc(p.obs || '') + '</td>' +
        '<td><button class="orc-apagar" data-id="' + p.id + '" title="Apagar este registro">🗑</button></td></tr>';
    }).join('') + '</tbody></table></div>';
  h += '<div class="nota-comp" style="margin:10px 0 0">Leads = patrocinados que chegaram no dia (todos, de qualquer corretor). Custo por lead = orçamento/dia × dias ÷ leads, só uma estimativa (o gasto real está no Meta). Leva alguns dias para o efeito aparecer, então compare períodos longos.</div></div>';
  box.innerHTML = h;
  ligarOrcamento();

  // gráfico: barras = leads/dia, linha em degrau = orçamento/dia
  destruir('orcamento');
  var primeiro = ORC.leads.length ? ORC.leads[0].dia : orc[0].data;
  var ini = primeiro < orc[0].data ? primeiro : orc[0].data;
  var dias = [], vl = [], vo = [];
  for (var d = ini; d <= hoje; d = orcSomaDias(d, 1)) {
    dias.push(d); vl.push(leadsPorDia[d] || 0);
    var atual = null; orc.forEach(function (o) { if (o.data <= d) atual = o.valor; });
    vo.push(atual);
    if (dias.length > 400) break;
  }
  CHARTS.orcamento = new Chart(document.getElementById('chart-orcamento'), {
    data: {
      labels: dias.map(function (x) { return formatarDataBR(x).slice(0, 5); }),
      datasets: [
        { type: 'bar', label: 'Leads patrocinados/dia', data: vl, backgroundColor: CORES.accent, borderRadius: 3, yAxisID: 'y', order: 2 },
        { type: 'line', label: 'Orçamento/dia (R$)', data: vo, borderColor: CORES.warn, backgroundColor: CORES.warn, stepped: true, pointRadius: 0, borderWidth: 3, yAxisID: 'y2', order: 1, spanGaps: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 14 } },
        y: { beginAtZero: true, grid: { color: '#eef0f6' }, ticks: { precision: 0 }, title: { display: true, text: 'Leads' } },
        y2: { position: 'right', beginAtZero: true, grid: { display: false }, title: { display: true, text: 'R$ por dia' } }
      }
    }
  });
}

function ligarOrcamento() {
  var b = document.getElementById('orc-salvar');
  if (b) b.addEventListener('click', salvarOrcamento);
  document.querySelectorAll('.orc-apagar').forEach(function (el) {
    el.addEventListener('click', async function () {
      if (!confirm('Apagar este registro de orçamento?')) return;
      await fetch('/api/analytics/orcamentos/' + el.getAttribute('data-id'), { method: 'DELETE' });
      carregarOrcamento();
    });
  });
}

async function salvarOrcamento() {
  var data = document.getElementById('orc-data').value;
  var valor = document.getElementById('orc-valor').value.trim();
  var obs = document.getElementById('orc-obs').value.trim();
  if (!data || valor === '') { alert('Preencha o dia e o valor (use 0 se o orçamento foi zerado).'); return; }
  var res = await fetch('/api/analytics/orcamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: data, valor: valor, obs: obs }) });
  var j = await res.json();
  if (!j.ok) { alert(j.erro || 'Não foi possível salvar.'); return; }
  carregarOrcamento();
}

document.getElementById('btn-atualizar-agora').addEventListener('click', function () {
  carregarDados(document.getElementById('data-inicio').value || null, document.getElementById('data-fim').value || null);
});
document.getElementById('auto-atualizar').addEventListener('change', configurarAuto);

// Carrega "Tudo" por padrão
carregarDados(null, null);
carregarOrcamento();
</script>
</body>
</html>`;

module.exports = { ANALYTICS_HTML };
