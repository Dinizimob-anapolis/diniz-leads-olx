const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Diniz Imóveis — Painel de Leads</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

  :root {
    --bg: #FAF9F6;
    --bg-card: #FFFFFF;
    --ink: #24211D;
    --ink-soft: #6B675F;
    --line: #E7E3DA;
    --amber: #B8863B;
    --amber-soft: #F3E7D2;
    --ok: #4A7A5E;
    --ok-soft: #E4EFE7;
    --warn: #B14B3B;
    --warn-soft: #F6E4E0;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: 'Space Grotesk', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .wrap { max-width: 1320px; margin: 0 auto; padding: 40px 28px 80px; }

  header.top {
    display: flex; align-items: flex-end; justify-content: space-between;
    margin-bottom: 36px; padding-bottom: 20px; border-bottom: 1px solid var(--line);
  }

  .brand-eyebrow {
    font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--amber); margin-bottom: 6px;
  }

  h1 { font-size: 28px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }

  .top-right { text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-soft); }

  #refresh-btn {
    font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 500; color: var(--ink);
    background: var(--bg-card); border: 1px solid var(--line); border-radius: 6px;
    padding: 7px 12px; cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease;
  }
  #refresh-btn:hover { border-color: var(--amber); background: var(--amber-soft); }
  #refresh-btn:active { transform: translateY(1px); }
  #refresh-btn.loading { color: var(--ink-soft); cursor: default; }

  #add-lead-btn {
    font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; color: #fff;
    background: var(--amber); border: 1px solid var(--amber); border-radius: 6px;
    padding: 7px 12px; cursor: pointer; margin-right: 8px; transition: opacity 0.15s ease;
  }
  #add-lead-btn:hover { opacity: 0.88; }

  #import-btn {
    font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 500; color: var(--ink);
    background: var(--bg-card); border: 1px solid var(--line); border-radius: 6px;
    padding: 7px 12px; cursor: pointer; margin-right: 8px; transition: border-color 0.15s ease, background 0.15s ease;
  }
  #import-btn:hover { border-color: var(--amber); background: var(--amber-soft); }
  #import-btn.loading { color: var(--ink-soft); cursor: default; }

  #sync-btn {
    font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 500; color: var(--ink);
    background: var(--bg-card); border: 1px solid var(--line); border-radius: 6px;
    padding: 7px 12px; cursor: pointer; margin-right: 8px; transition: border-color 0.15s ease, background 0.15s ease;
  }
  #sync-btn:hover { border-color: var(--ok); background: var(--ok-soft); }
  #sync-btn.loading { color: var(--ink-soft); cursor: default; }

  .modal-overlay {
    display: none; position: fixed; inset: 0; background: rgba(36, 33, 29, 0.45);
    align-items: center; justify-content: center; z-index: 100; padding: 20px;
  }
  .modal-overlay.show { display: flex; }
  .modal {
    background: var(--bg-card); border-radius: 12px; padding: 26px 28px; width: 100%; max-width: 380px;
    max-height: 90vh; overflow-y: auto;
  }
  .modal h3 { margin: 0 0 18px; font-size: 17px; font-weight: 700; }
  .modal label { display: block; font-size: 11.5px; color: var(--ink-soft); margin: 12px 0 5px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.06em; }
  .modal input[type="text"], .modal select {
    width: 100%; font-family: 'Space Grotesk', sans-serif; font-size: 13.5px; color: var(--ink);
    border: 1px solid var(--line); border-radius: 7px; padding: 9px 11px; background: var(--bg);
  }
  .modal input:focus, .modal select:focus { outline: none; border-color: var(--amber); }
  .modal-erro { color: var(--warn); font-size: 12.5px; margin-top: 10px; min-height: 16px; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
  .btn-secundario, .btn-primario {
    font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 600; border-radius: 7px;
    padding: 9px 16px; cursor: pointer; border: 1px solid var(--line);
  }
  .btn-secundario { background: var(--bg); color: var(--ink-soft); }
  .btn-primario { background: var(--amber); color: #fff; border-color: var(--amber); }
  .btn-primario:disabled { opacity: 0.6; cursor: default; }

  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 36px; }

  .metric { background: var(--bg-card); border: 1px solid var(--line); border-radius: 10px; padding: 18px 20px; }
  .metric .label { font-size: 12px; color: var(--ink-soft); margin-bottom: 10px; }
  .metric .value { font-family: 'JetBrains Mono', monospace; font-size: 30px; font-weight: 600; letter-spacing: -0.02em; }
  .metric .sub { font-size: 12px; color: var(--ink-soft); margin-top: 4px; }
  .metric.accent .value { color: var(--amber); }
  .metric.warn-metric .value { color: var(--warn); }

  .corretores { display: flex; gap: 10px; margin-bottom: 28px; flex-wrap: wrap; }
  .corretor-chip {
    background: var(--bg-card); border: 1px solid var(--line); border-radius: 8px;
    padding: 10px 16px; display: flex; align-items: center; gap: 10px; font-size: 13px;
  }
  .corretor-chip .dot { width: 8px; height: 8px; border-radius: 50%; }
  .corretor-chip .count { font-family: 'JetBrains Mono', monospace; font-weight: 600; color: var(--ink-soft); }

  .origem-strip { display: flex; gap: 10px; margin-bottom: 28px; flex-wrap: wrap; }
  .origem-chip {
    background: var(--bg-card); border: 1px solid var(--line); border-radius: 8px;
    padding: 10px 16px; display: flex; align-items: center; gap: 10px; font-size: 13px;
    cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease;
  }
  .origem-chip:hover { border-color: var(--amber); }
  .origem-chip.active { border-color: var(--amber); background: var(--amber-soft); font-weight: 600; }
  .origem-chip .count { font-family: 'JetBrains Mono', monospace; font-weight: 600; color: var(--amber); }

  .corretor-tabs { display: flex; gap: 6px; flex-wrap: wrap; border-bottom: 1px solid var(--line); padding-bottom: 16px; }
  .corretor-tab-btn {
    font-family: 'Space Grotesk', sans-serif; font-size: 12.5px; font-weight: 500; color: var(--ink-soft);
    background: var(--bg); border: 1px solid var(--line); border-radius: 20px;
    padding: 7px 14px; cursor: pointer; transition: all 0.15s ease;
  }
  .corretor-tab-btn:hover { border-color: var(--amber); color: var(--ink); }
  .corretor-tab-btn.active { background: var(--ink); border-color: var(--ink); color: #fff; }

  .atividade-balloons { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .balloon { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
  .balloon .balloon-label { font-size: 11.5px; color: var(--ink-soft); margin-bottom: 6px; }
  .balloon .balloon-value { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 600; }
  .balloon.balloon-accent .balloon-value { color: var(--amber); }
  .balloon.balloon-ok .balloon-value { color: var(--ok); }

  .panel { background: var(--bg-card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .panel-head {
    display: flex; justify-content: space-between; align-items: center;
    padding: 18px 22px; border-bottom: 1px solid var(--line);
  }
  .panel-head h2 { font-size: 15px; font-weight: 600; margin: 0; }

  .filters { display: flex; gap: 8px; flex-wrap: wrap; }
  select, input[type="date"] {
    font-family: 'Space Grotesk', sans-serif; font-size: 12px; border: 1px solid var(--line);
    background: var(--bg); color: var(--ink); padding: 7px 10px; border-radius: 6px;
  }

  .bulk-bar {
    display: flex; align-items: center; gap: 10px; padding: 12px 22px;
    border-bottom: 1px solid var(--line); background: #FCFBF9; flex-wrap: wrap;
  }
  .bulk-bar select { font-size: 12.5px; }
  #bulk-apply-btn {
    font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; color: #fff;
    background: var(--amber); border: 1px solid var(--amber); border-radius: 6px;
    padding: 7px 12px; cursor: pointer;
  }
  #bulk-apply-btn:hover { opacity: 0.88; }
  #bulk-export-btn {
    font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 500; color: var(--ink);
    background: var(--bg-card); border: 1px solid var(--line); border-radius: 6px;
    padding: 7px 12px; cursor: pointer;
  }
  #bulk-export-btn:hover { border-color: var(--amber); background: var(--amber-soft); }
  #bulk-count { color: var(--ink-soft); }

  .table-scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; min-width: 1040px; }
  thead th {
    text-align: left; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--ink-soft); padding: 10px 16px; background: #FCFBF9;
    border-bottom: 1px solid var(--line); white-space: nowrap;
  }
  tbody td { padding: 10px 16px; border-bottom: 1px solid var(--line); font-size: 13.5px; vertical-align: middle; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: #FCFBF9; }

  .lead-name { font-weight: 600; }
  .lead-meta { color: var(--ink-soft); font-size: 12px; margin-top: 2px; }
  .mono { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: var(--ink-soft); }

  .tag {
    display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 500;
    padding: 4px 9px; border-radius: 20px;
  }
  .tag-ok { background: var(--ok-soft); color: var(--ok); }
  .tag-warn { background: var(--warn-soft); color: var(--warn); }
  .tag-pending { background: var(--amber-soft); color: var(--amber); }

  .corretor-badge { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13px; }
  .corretor-badge .dot { width: 7px; height: 7px; border-radius: 50%; }

  .time-ago { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-soft); }

  .empty-state { padding: 48px 22px; text-align: center; color: var(--ink-soft); font-size: 13.5px; }

  footer.note { margin-top: 20px; font-size: 11.5px; color: var(--ink-soft); font-family: 'JetBrains Mono', monospace; }

  /* ─── Campos editáveis inline ─── */
  .edit-select, .edit-date {
    font-family: 'Space Grotesk', sans-serif; font-size: 12.5px; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line); border-radius: 6px;
    padding: 5px 8px; min-width: 110px; cursor: pointer;
  }
  .edit-select.pendente { border-color: var(--amber); background: var(--amber-soft); color: var(--amber); font-weight: 500; }
  .edit-select:focus, .edit-date:focus { outline: none; border-color: var(--amber); }

  .edit-text {
    font-family: 'Space Grotesk', sans-serif; font-size: 12.5px; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line); border-radius: 6px;
    padding: 5px 8px; width: 100%; min-width: 140px;
  }
  .edit-text:focus { outline: none; border-color: var(--amber); }
  .edit-text-nome { font-weight: 600; font-size: 13.5px; margin-bottom: 3px; }

  .edit-check { display: flex; align-items: center; justify-content: center; }
  .edit-check input[type="checkbox"] {
    width: 17px; height: 17px; cursor: pointer; accent-color: var(--ok);
  }

  .saving-dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: var(--amber); margin-left: 6px; opacity: 0; transition: opacity 0.15s ease;
  }
  .saving-dot.show { opacity: 1; }

  @media (max-width: 720px) {
    .metrics { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body>
<div class="wrap">

  <header class="top">
    <div>
      <div class="brand-eyebrow">Diniz Imóveis · Operação de Leads</div>
      <h1>Quem tá com qual lead</h1>
    </div>
    <div class="top-right">
      <button id="sync-btn" onclick="sincronizarPlanilha()">⇄ Sincronizar planilha</button>
      <button id="infer-btn" onclick="inferirOrigens()" style="background:#F3E7D2; border-color:#B8863B; color:#B8863B;">🔍 Preencher origens pendentes</button>
      <button id="clean-btn" onclick="limparDuplicados()" style="background:#F6E4E0; border-color:#B14B3B; color:#B14B3B;">🧹 Limpar duplicados</button>
      <button id="import-btn" onclick="document.getElementById('arquivo-planilha').click()">⇪ Importar arquivo</button>
      <input type="file" id="arquivo-planilha" accept=".xlsx,.xls,.csv" style="display:none" onchange="importarPlanilha(this.files[0])">
      <button id="add-lead-btn" onclick="abrirModalLead()">+ Adicionar lead</button>
      <button id="refresh-btn" onclick="carregarDados()">↻ Atualizar</button>
      <div id="last-sync" style="margin-top:6px;">Ainda não atualizado</div>
    </div>
  </header>

  <div id="modal-overlay" class="modal-overlay" onclick="if(event.target===this) fecharModalLead()">
    <div class="modal">
      <h3>Adicionar lead manualmente</h3>
      <label>Nome</label>
      <input type="text" id="novo-nome" placeholder="Nome do cliente">
      <label>WhatsApp</label>
      <input type="text" id="novo-whatsapp" placeholder="(62) 99999-9999">
      <label>Origem</label>
      <select id="novo-origem">
        <option value="">— escolher —</option>
        \${ORIGENS.map(o => \`<option value="\${o}">\${o}</option>\`).join('')}
      </select>
      <label>Corretor</label>
      <select id="novo-corretor"></select>
      <label>Imóvel de interesse (opcional)</label>
      <input type="text" id="novo-imovel" placeholder="Ex: Apto 3 quartos Bairro X">
      <div id="modal-erro" class="modal-erro"></div>
      <div class="modal-actions">
        <button class="btn-secundario" onclick="fecharModalLead()">Cancelar</button>
        <button class="btn-primario" onclick="salvarNovoLead()">Salvar lead</button>
      </div>
    </div>
  </div>

  <div class="metrics">
    <div class="metric"><div class="label">Total de leads</div><div class="value" id="m-distribuidos">—</div><div class="sub" id="m-distribuidos-sub">&nbsp;</div></div>
    <div class="metric accent"><div class="label">Total de aprovações</div><div class="value" id="m-aprovados">—</div><div class="sub">&nbsp;</div></div>
    <div class="metric"><div class="label">Total de visitas</div><div class="value" id="m-visitas">—</div><div class="sub">&nbsp;</div></div>
    <div class="metric"><div class="label">Total de vendas</div><div class="value" id="m-vendas">—</div><div class="sub">&nbsp;</div></div>
  </div>

  <div class="corretores" id="corretores-strip"></div>
  <div class="origem-strip" id="origem-strip"></div>

  <div class="panel" style="margin-bottom:28px;">
    <div class="panel-head">
      <h2>Campanhas (imóveis)</h2>
    </div>
    <div id="campanhas-container" style="padding:16px 22px;"></div>
  </div>

  <div class="panel" style="margin-bottom:28px;">
    <div class="panel-head">
      <h2>Atividade por corretor</h2>
    </div>
    <div class="corretor-tabs" id="corretor-tabs" style="padding:16px 22px 0;"></div>
    <div id="corretor-tab-content" style="padding:16px 22px;"></div>
  </div>

  <div class="panel" style="margin-bottom:28px;">
    <div class="panel-head">
      <h2>Leads sem número válido <span id="sem-numero-count" class="mono"></span></h2>
    </div>
    <div id="sem-numero-container" style="padding:16px 22px;"></div>
  </div>

  <div class="panel">
    <div class="panel-head">
      <h2>Atividade recente</h2>
      <div class="filters">
        <input type="text" id="filtro-busca-texto" placeholder="Buscar texto (ex: CRM)…" oninput="renderTabela()" style="min-width:180px;">
        <select id="filtro-corretor" onchange="renderTabela()"><option value="">Todos os corretores</option></select>
        <select id="filtro-campanha" onchange="renderTabela()"><option value="">Todas as campanhas</option></select>
        <select id="filtro-origem" onchange="renderTabela()">
          <option value="">Todas as origens</option>
          <option value="OLX/Canal Pro">OLX/Canal Pro</option>
          <option value="Patrocinado">Patrocinado</option>
          <option value="TikTok">TikTok</option>
          <option value="Instagram">Instagram</option>
          <option value="Comentário">Comentário</option>
          <option value="Outro">Outro</option>
          <option value="__pendente">Origem pendente</option>
        </select>
        <select id="filtro-status" onchange="renderTabela()">
          <option value="">Todos os status</option>
          <option value="sem_corretor">Sem corretor</option>
          <option value="Novo">Novo</option>
          <option value="Em atendimento">Em atendimento</option>
          <option value="Visita agendada">Visita agendada</option>
          <option value="Proposta">Proposta</option>
          <option value="Sem retorno">Sem retorno</option>
          <option value="Venda">Venda</option>
          <option value="Perdido">Perdido</option>
        </select>
      </div>
    </div>
    <div class="bulk-bar" id="bulk-bar">
      <span id="bulk-count" class="mono"></span>
      <select id="bulk-origem-select">
        <option value="">— escolher origem —</option>
        <option value="OLX/Canal Pro">OLX/Canal Pro</option>
        <option value="Patrocinado">Patrocinado</option>
        <option value="TikTok">TikTok</option>
        <option value="Instagram">Instagram</option>
        <option value="Comentário">Comentário</option>
        <option value="Outro">Outro</option>
      </select>
      <button id="bulk-apply-btn" onclick="aplicarOrigemEmMassa()">Aplicar aos leads filtrados</button>
      <button id="bulk-export-btn" onclick="exportarCSV()">⇩ Exportar CSV</button>
    </div>
    <div class="table-scroll" id="tabela-container">
      <div class="empty-state">Clique em "Atualizar" pra carregar os leads.</div>
    </div>
  </div>

  <footer class="note" id="footer-note">diniz-leads-olx · painel manual — atualiza somente ao clicar · edite Origem, Status, Visita, Proposta e Venda direto na tabela</footer>

</div>

<script>
  const CORES_CORRETOR = ['#B8863B', '#4A7A5E', '#6B5CA5', '#B14B3B', '#3B6EB8'];
  const ORIGENS = ['OLX/Canal Pro', 'Patrocinado', 'TikTok', 'Instagram', 'Comentário', 'Outro'];
  const STATUS_OPCOES = ['Novo', 'Em atendimento', 'Visita agendada', 'Proposta', 'Sem retorno', 'Venda', 'Perdido'];
  let CORRETORES_DISPONIVEIS = [];
  let ULTIMO_ESTADO = null;
  let LEADS_FILTRADOS_IDS = [];
  let LEADS_FILTRADOS_OBJS = [];

  function corDoCorretor(nome) {
    if (!nome) return '#B14B3B';
    let hash = 0;
    for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
    return CORES_CORRETOR[Math.abs(hash) % CORES_CORRETOR.length];
  }

  function tempoRelativo(dataIso) {
    if (!dataIso) return '—';
    const diffMs = Date.now() - new Date(dataIso).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return \`há \${min} min\`;
    const h = Math.floor(min / 60);
    const restoMin = min % 60;
    if (h < 24) return \`há \${h}h \${restoMin.toString().padStart(2, '0')}\`;
    const d = Math.floor(h / 24);
    return \`há \${d}d\`;
  }

  function formatarTempoMedio(segundos) {
    if (segundos === null || segundos === undefined) return '—';
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    if (h === 0) return \`\${m}min\`;
    return \`\${h}h\${m.toString().padStart(2, '0')}\`;
  }

  async function carregarDados() {
    const btn = document.getElementById('refresh-btn');
    btn.classList.add('loading');
    btn.textContent = '↻ Atualizando…';

    try {
      const res = await fetch('/api/leads');
      if (!res.ok) throw new Error('Falha ao buscar dados (' + res.status + ')');
      const data = await res.json();
      ULTIMO_ESTADO = data;
      renderTudo(data);
      document.getElementById('last-sync').textContent = 'Última atualização: agora mesmo';
    } catch (err) {
      document.getElementById('last-sync').textContent = 'Erro ao atualizar: ' + err.message;
    } finally {
      btn.classList.remove('loading');
      btn.textContent = '↻ Atualizar';
    }
  }

  // Salva um campo editável direto na tabela, sem recarregar tudo.
  // tipo: 'lead' (padrão) ou 'nao_identificado' — este último promove o contato
  // a lead completo assim que qualquer campo é editado, e recarrega a lista inteira.
  async function salvarCampo(id, campo, valor, elemento, tipo) {
    tipo = tipo || 'lead';
    const url = tipo === 'lead' ? '/api/leads/' + id : '/api/leads-nao-identificados/' + id;
    const dot = elemento.parentElement.querySelector('.saving-dot');
    if (dot) dot.classList.add('show');
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campo, valor }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error('Falha ao salvar');

      if (tipo === 'nao_identificado') {
        // Contato promovido a lead completo — some da lista de não identificados
        await carregarDados();
        return;
      }

      if (ULTIMO_ESTADO) {
        const lead = ULTIMO_ESTADO.leads.find(l => l.id === id);
        if (lead) lead[campo] = valor;
      }
      if ((campo === 'origem' || campo === 'corretor') && elemento.classList) {
        elemento.classList.toggle('pendente', !valor);
      }
    } catch (err) {
      alert('Não consegui salvar essa alteração. Tenta de novo.');
    } finally {
      if (dot) setTimeout(() => dot.classList.remove('show'), 400);
    }
  }

  async function inferirOrigens() {
    const btn = document.getElementById('infer-btn');
    btn.disabled = true;
    btn.textContent = '🔍 Analisando…';
    try {
      const res = await fetch('/api/admin/inferir-origens-pendentes', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.erro || 'Falha ao inferir origens');
      alert(\`\${data.atualizados} de \${data.totalPendentes} leads pendentes tiveram a origem preenchida. Os que não deu pra descobrir continuam pendentes pra você escolher manualmente.\`);
      await carregarDados();
    } catch (err) {
      alert('Não consegui preencher: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🔍 Preencher origens pendentes';
    }
  }

  async function limparDuplicados() {
    if (!confirm('Isso vai apagar os leads duplicados sem número válido (mesmo nome), mantendo só o mais antigo de cada. Confirma?')) return;
    const btn = document.getElementById('clean-btn');
    btn.disabled = true;
    btn.textContent = '🧹 Limpando…';
    try {
      const res = await fetch('/api/admin/limpar-duplicados-sem-numero', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.erro || 'Falha ao limpar');
      alert(\`\${data.removidos} lead\${data.removidos === 1 ? '' : 's'} duplicado\${data.removidos === 1 ? '' : 's'} removido\${data.removidos === 1 ? '' : 's'}.\`);
      await carregarDados();
    } catch (err) {
      alert('Não consegui limpar: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🧹 Limpar duplicados';
    }
  }

  async function sincronizarPlanilha() {
    const btn = document.getElementById('sync-btn');
    btn.classList.add('loading');
    btn.textContent = '⇄ Sincronizando…';

    try {
      const res = await fetch('/api/sincronizar-planilha', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.erro || 'Falha ao sincronizar');

      await carregarDados();
      let resumo = \`Sincronizado: +\${data.inseridos} novo\${data.inseridos === 1 ? '' : 's'}\`;
      if (data.incompletos > 0) {
        resumo += \` · \${data.incompletos} linha\${data.incompletos === 1 ? '' : 's'} da planilha sem nome ou WhatsApp (ignorada\${data.incompletos === 1 ? '' : 's'})\`;
      }
      document.getElementById('last-sync').textContent = resumo;

      if (data.incompletos > 0 && Array.isArray(data.linhasIncompletas) && data.linhasIncompletas.length > 0) {
        console.log('Linhas da planilha ignoradas por falta de dado:', data.linhasIncompletas);
      }
    } catch (err) {
      alert('Não consegui sincronizar com a planilha: ' + err.message);
    } finally {
      btn.classList.remove('loading');
      btn.textContent = '⇄ Sincronizar planilha';
    }
  }

  // Reconhece a coluna certa mesmo que o nome varie um pouco (maiúscula, acento, espaço)
  function acharColuna(linha, possiveisNomes) {
    const chaves = Object.keys(linha);
    for (const nomePossivel of possiveisNomes) {
      const alvo = nomePossivel.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const chave = chaves.find(k => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === alvo);
      if (chave) return linha[chave];
    }
    return '';
  }

  async function importarPlanilha(arquivo) {
    if (!arquivo) return;
    const btn = document.getElementById('import-btn');
    btn.classList.add('loading');
    btn.textContent = '⇪ Lendo planilha…';

    try {
      const buffer = await arquivo.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
      const linhas = XLSX.utils.sheet_to_json(primeiraAba, { defval: '' });

      if (linhas.length === 0) {
        alert('Não encontrei nenhuma linha nessa planilha.');
        return;
      }

      const leads = linhas.map(linha => ({
        nome: String(acharColuna(linha, ['Nome', 'Cliente', 'Nome do Cliente'])).trim(),
        whatsapp: String(acharColuna(linha, ['WhatsApp', 'Whatsapp', 'Telefone', 'Fone', 'Celular'])).trim(),
        origem: String(acharColuna(linha, ['Origem', 'Canal'])).trim() || null,
        corretor: String(acharColuna(linha, ['Corretor'])).trim() || null,
        imovelDesc: String(acharColuna(linha, ['Interesse', 'Imovel', 'Imóvel'])).trim() || null,
        dataChegada: acharColuna(linha, ['Data', 'Data do Lead', 'Data de Criação', 'Data do ultimo lead gerado', 'Data do último lead gerado']) || null,
      })).filter(l => l.nome);

      if (leads.length === 0) {
        alert('Não consegui identificar a coluna de Nome nessa planilha. Confere se o cabeçalho bate com o esperado (Nome, WhatsApp, Origem, Corretor, Interesse, Data).');
        return;
      }

      btn.textContent = '⇪ Importando…';
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.erro || 'Falha ao importar');

      alert(\`Importação concluída: \${data.inseridos} lead\${data.inseridos === 1 ? '' : 's'} novo\${data.inseridos === 1 ? '' : 's'} adicionado\${data.inseridos === 1 ? '' : 's'}, \${data.jaExistiam} já existia\${data.jaExistiam === 1 ? '' : 'm'}, \${data.incompletos} linha\${data.incompletos === 1 ? '' : 's'} sem nome ou WhatsApp (ignorada\${data.incompletos === 1 ? '' : 's'}).\`);
      await carregarDados();
    } catch (err) {
      alert('Não consegui importar essa planilha: ' + err.message);
    } finally {
      btn.classList.remove('loading');
      btn.textContent = '⇪ Importar planilha';
      document.getElementById('arquivo-planilha').value = '';
    }
  }

  function exportarCSV() {
    if (LEADS_FILTRADOS_OBJS.length === 0) {
      alert('Nenhum lead filtrado pra exportar.');
      return;
    }

    const colunas = ['Nome', 'Telefone', 'Email', 'Corretor', 'Imovel', 'Origem', 'Status'];
    const escapar = v => {
      const s = String(v ?? '');
      return /[",\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    const linhas = LEADS_FILTRADOS_OBJS.map(l => [
      l.nome || '',
      l.whatsapp && !l.numero_invalido ? '+' + l.whatsapp : (l.whatsapp_bruto || ''),
      l.email || '',
      l.corretor || '',
      [l.imovel_codigo, l.imovel_desc].filter(Boolean).join(' - '),
      l.origem || '',
      l.status || 'Novo',
    ].map(escapar).join(','));

    const csv = '\uFEFF' + [colunas.join(','), ...linhas].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads-diniz-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function aplicarOrigemEmMassa() {
    const origem = document.getElementById('bulk-origem-select').value;
    if (!origem) {
      alert('Escolhe uma origem primeiro.');
      return;
    }
    if (LEADS_FILTRADOS_IDS.length === 0) {
      alert('Nenhum lead filtrado pra aplicar.');
      return;
    }
    const confirmar = confirm(\`Definir origem "\${origem}" para \${LEADS_FILTRADOS_IDS.length} lead\${LEADS_FILTRADOS_IDS.length === 1 ? '' : 's'} filtrado\${LEADS_FILTRADOS_IDS.length === 1 ? '' : 's'}?\`);
    if (!confirmar) return;

    const btn = document.getElementById('bulk-apply-btn');
    btn.disabled = true;
    btn.textContent = 'Aplicando…';

    try {
      for (const id of LEADS_FILTRADOS_IDS) {
        await fetch('/api/leads/' + id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campo: 'origem', valor: origem }),
        });
      }
      await carregarDados();
    } catch (err) {
      alert('Deu erro ao aplicar em alguns leads. Confere e tenta de novo se precisar.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Aplicar aos leads filtrados';
    }
  }

  function abrirModalLead() {
    document.getElementById('modal-erro').textContent = '';
    document.getElementById('novo-nome').value = '';
    document.getElementById('novo-whatsapp').value = '';
    document.getElementById('novo-origem').value = '';
    document.getElementById('novo-imovel').value = '';

    const selectCorretor = document.getElementById('novo-corretor');
    selectCorretor.innerHTML = CORRETORES_DISPONIVEIS.map(c => \`<option value="\${c}">\${c}</option>\`).join('');

    document.getElementById('modal-overlay').classList.add('show');
  }

  function fecharModalLead() {
    document.getElementById('modal-overlay').classList.remove('show');
  }

  async function salvarNovoLead() {
    const nome = document.getElementById('novo-nome').value.trim();
    const whatsapp = document.getElementById('novo-whatsapp').value.trim();
    const origem = document.getElementById('novo-origem').value;
    const corretor = document.getElementById('novo-corretor').value;
    const imovelDesc = document.getElementById('novo-imovel').value.trim();
    const erroEl = document.getElementById('modal-erro');
    const btnSalvar = document.querySelector('.btn-primario');

    if (!nome || !whatsapp || !corretor) {
      erroEl.textContent = 'Preencha nome, WhatsApp e corretor.';
      return;
    }

    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando…';
    erroEl.textContent = '';

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, whatsapp, origem, corretor, imovelDesc }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.erro || 'Não consegui salvar');

      fecharModalLead();
      await carregarDados();
    } catch (err) {
      erroEl.textContent = err.message;
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar lead';
    }
  }

  let ABA_CORRETOR_ATIVA = 'Geral';

  function selecionarAbaCorretor(nome) {
    ABA_CORRETOR_ATIVA = nome;
    renderCorretorTabs();
    renderCorretorTabContent();
  }

  function selecionarAbaCorretorPorIndice(botao) {
    const abas = ['Geral', ...CORRETORES_DISPONIVEIS];
    const idx = parseInt(botao.getAttribute('data-idx'), 10);
    selecionarAbaCorretor(abas[idx]);
  }

  function renderCorretorTabs() {
    const container = document.getElementById('corretor-tabs');
    const abas = ['Geral', ...CORRETORES_DISPONIVEIS];
    container.innerHTML = abas.map((nome, i) =>
      \`<button class="corretor-tab-btn \${ABA_CORRETOR_ATIVA === nome ? 'active' : ''}" data-idx="\${i}" onclick="selecionarAbaCorretorPorIndice(this)">\${nome}</button>\`
    ).join('');
  }

  function renderCorretorTabContent() {
    const container = document.getElementById('corretor-tab-content');
    if (!ULTIMO_ESTADO) return;

    let dados;
    if (ABA_CORRETOR_ATIVA === 'Geral') {
      dados = ULTIMO_ESTADO.totalGeral || { total: 0, contataram: 0, aprovados: 0, visitas: 0, propostas: 0, vendas: 0 };
    } else {
      const detalhado = (ULTIMO_ESTADO.porCorretorDetalhado || []).find(c => c.corretor === ABA_CORRETOR_ATIVA);
      dados = detalhado || { total: 0, contataram: 0, aprovados: 0, visitas: 0, propostas: 0, vendas: 0 };
    }

    container.innerHTML = \`<div class="atividade-balloons">
      <div class="balloon"><div class="balloon-label">Leads</div><div class="balloon-value">\${dados.total}</div></div>
      <div class="balloon balloon-accent"><div class="balloon-label">Aprovados</div><div class="balloon-value">\${dados.aprovados}</div></div>
      <div class="balloon"><div class="balloon-label">Visitas</div><div class="balloon-value">\${dados.visitas}</div></div>
      <div class="balloon"><div class="balloon-label">Propostas</div><div class="balloon-value">\${dados.propostas}</div></div>
      <div class="balloon balloon-ok"><div class="balloon-label">Vendas</div><div class="balloon-value">\${dados.vendas}</div></div>
    </div>\`;
  }

  function renderSemNumero() {
    const container = document.getElementById('sem-numero-container');
    const countEl = document.getElementById('sem-numero-count');
    if (!ULTIMO_ESTADO) return;

    const semNumero = ULTIMO_ESTADO.leads.filter(l => l.numero_invalido);
    countEl.textContent = semNumero.length > 0 ? \`(\${semNumero.length})\` : '';

    if (semNumero.length === 0) {
      container.innerHTML = '<div class="mono">Nenhum lead sem número no momento.</div>';
      return;
    }

    container.innerHTML = \`<div class="table-scroll"><table>
      <thead><tr><th>Nome</th><th>O que veio na planilha/mensagem</th><th>Origem</th><th>Corretor</th><th>Corrigir WhatsApp</th></tr></thead>
      <tbody>
        \${semNumero.map(l => \`<tr>
          <td><div class="lead-name">\${l.nome || 'Sem nome'}</div></td>
          <td class="mono">\${l.whatsapp_bruto || '—'}</td>
          <td class="mono">\${l.origem || '—'}</td>
          <td class="mono">\${l.corretor || '—'}</td>
          <td>
            <input type="text" class="edit-text" id="corrigir-whatsapp-\${l.id}" placeholder="(62) 99999-9999" style="min-width:150px;">
            <button class="btn-secundario" style="padding:6px 10px; margin-left:6px;" onclick="corrigirWhatsapp(\${l.id})">Salvar</button>
          </td>
        </tr>\`).join('')}
      </tbody>
    </table></div>\`;
  }

  async function corrigirWhatsapp(id) {
    const input = document.getElementById('corrigir-whatsapp-' + id);
    const valor = input.value.trim();
    if (!valor) {
      alert('Digita o número certo primeiro.');
      return;
    }
    try {
      const res = await fetch('/api/leads/' + id + '/corrigir-whatsapp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: valor }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.erro || 'Falha ao corrigir');
      await carregarDados();
    } catch (err) {
      alert('Não consegui corrigir: ' + err.message);
    }
  }

  // "Não informado" no balão corresponde à opção especial __pendente do filtro de origem
  function origemParaFiltro(origemChip) {
    return origemChip === 'Não informado' ? '__pendente' : origemChip;
  }

  function filtrarPorOrigem(valorFiltro) {
    const select = document.getElementById('filtro-origem');
    // Clicar de novo no mesmo balão já ativo remove o filtro (alterna)
    select.value = select.value === valorFiltro ? '' : valorFiltro;
    renderTudo(ULTIMO_ESTADO);
    document.getElementById('tabela-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function filtrarPorOrigemIndice(el) {
    const idx = parseInt(el.getAttribute('data-idx'), 10);
    const origens = (ULTIMO_ESTADO && ULTIMO_ESTADO.porOrigem) || [];
    const o = origens[idx];
    if (!o) return;
    filtrarPorOrigem(origemParaFiltro(o.origem));
  }

  function renderTudo(data) {
    CORRETORES_DISPONIVEIS = data.corretoresDisponiveis || [];
    document.getElementById('m-distribuidos').textContent = data.totalGeral ? data.totalGeral.total : data.stats.totalDistribuidos;
    document.getElementById('m-distribuidos-sub').textContent = '+' + data.stats.distribuidos24h + ' nas últimas 24h';

    document.getElementById('m-aprovados').textContent = data.totalGeral ? data.totalGeral.aprovados : data.stats.totalAprovados;
    document.getElementById('m-visitas').textContent = data.totalGeral ? data.totalGeral.visitas : data.stats.totalVisitas;
    document.getElementById('m-vendas').textContent = data.totalGeral ? data.totalGeral.vendas : data.stats.totalVendas;

    const corretoresMap = {};
    (data.porCorretor || []).forEach(c => { corretoresMap[c.corretor] = c.total; });

    const strip = document.getElementById('corretores-strip');
    strip.innerHTML = Object.keys(corretoresMap).map(nome =>
      \`<div class="corretor-chip"><span class="dot" style="background:\${corDoCorretor(nome)}"></span>\${nome} <span class="count">\${corretoresMap[nome]}</span></div>\`
    ).join('') || '<div class="mono">Nenhum lead distribuído ainda</div>';

    const filtroCorretor = document.getElementById('filtro-corretor');
    const atual = filtroCorretor.value;
    filtroCorretor.innerHTML = '<option value="">Todos os corretores</option>' +
      Object.keys(corretoresMap).map(n => \`<option value="\${n}">\${n}</option>\`).join('');
    filtroCorretor.value = atual;

    const origemStrip = document.getElementById('origem-strip');
    const origens = data.porOrigem || [];
    const filtroOrigemAtual = document.getElementById('filtro-origem').value;
    origemStrip.innerHTML = origens.map((o, i) => {
      const valorFiltro = origemParaFiltro(o.origem);
      const ativo = filtroOrigemAtual === valorFiltro;
      return \`<div class="origem-chip \${ativo ? 'active' : ''}" data-idx="\${i}" onclick="filtrarPorOrigemIndice(this)">\${o.origem} <span class="count">\${o.total}</span></div>\`;
    }).join('') || '<div class="mono">Nenhuma origem registrada ainda</div>';

    const campanhasContainer = document.getElementById('campanhas-container');
    const campanhas = data.porCampanha || [];
    if (campanhas.length === 0) {
      campanhasContainer.innerHTML = '<div class="mono">Nenhuma campanha ativa nos últimos 7 dias</div>';
    } else {
      campanhasContainer.innerHTML = \`<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px;">\` +
        campanhas.map(c => {
          const nomeCampanha = [c.imovel_codigo, c.imovel_desc].filter(Boolean).join(' - ') || 'Sem identificação';
          const pctCamp = c.total > 0 ? Math.round((c.total_contataram / c.total) * 100) : 0;
          return \`<div style="border:1px solid var(--line); border-radius:8px; padding:12px 14px;">
            <div style="font-weight:600; font-size:13px; margin-bottom:6px;">\${nomeCampanha}</div>
            <div class="mono" style="font-size:12px;">\${c.total} lead\${c.total == 1 ? '' : 's'} · \${pctCamp}% contataram</div>
          </div>\`;
        }).join('') + '</div>';
    }

    const filtroCampanha = document.getElementById('filtro-campanha');
    const campanhaAtual = filtroCampanha.value;
    filtroCampanha.innerHTML = '<option value="">Todas as campanhas</option>' +
      campanhas.map(c => {
        const nomeCampanha = [c.imovel_codigo, c.imovel_desc].filter(Boolean).join(' - ') || 'Sem identificação';
        return \`<option value="\${c.imovel_codigo || ''}">\${nomeCampanha}</option>\`;
      }).join('');
    filtroCampanha.value = campanhaAtual;

    renderCorretorTabs();
    renderCorretorTabContent();
    renderSemNumero();
    renderTabela();
  }

  function renderTabela() {
    const container = document.getElementById('tabela-container');
    if (!ULTIMO_ESTADO) return;

    const filtroBusca = document.getElementById('filtro-busca-texto').value.trim().toLowerCase();
    const filtroCorretor = document.getElementById('filtro-corretor').value;
    const filtroCampanha = document.getElementById('filtro-campanha').value;
    const filtroOrigem = document.getElementById('filtro-origem').value;
    const filtroStatus = document.getElementById('filtro-status').value;

    let linhas = ULTIMO_ESTADO.leads.map(l => ({ tipo: 'lead', ...l }));
    let naoIdent = ULTIMO_ESTADO.naoIdentificados.map(n => ({ tipo: 'nao_identificado', ...n }));

    let todos = [...linhas, ...naoIdent];

    if (filtroStatus === 'sem_corretor') {
      todos = naoIdent;
    } else if (filtroStatus) {
      todos = linhas.filter(l => (l.status || 'Novo') === filtroStatus);
    }

    if (filtroBusca) {
      todos = todos.filter(l => {
        const alvo = [l.nome, l.imovel_desc, l.imovel_codigo, l.interesse, l.mensagem, l.whatsapp_bruto, l.origem]
          .filter(Boolean).join(' ').toLowerCase();
        return alvo.includes(filtroBusca);
      });
    }

    if (filtroCorretor) {
      todos = todos.filter(l => l.tipo === 'lead' && l.corretor === filtroCorretor);
    }

    if (filtroCampanha) {
      todos = todos.filter(l => l.tipo === 'lead' && l.imovel_codigo === filtroCampanha);
    }

    if (filtroOrigem === '__pendente') {
      todos = todos.filter(l => l.tipo === 'lead' && !l.origem);
    } else if (filtroOrigem) {
      todos = todos.filter(l => l.tipo === 'lead' && l.origem === filtroOrigem);
    }

    todos.sort((a, b) => new Date(b.distribuido_em || b.criado_em) - new Date(a.distribuido_em || a.criado_em));

    // Guarda os IDs (e os objetos completos) dos leads atualmente filtrados —
    // pra ação em massa de definir origem, e pra exportar CSV
    const leadsFiltrados = todos.filter(l => l.tipo === 'lead');
    LEADS_FILTRADOS_IDS = leadsFiltrados.map(l => l.id);
    LEADS_FILTRADOS_OBJS = leadsFiltrados;
    const bulkCount = document.getElementById('bulk-count');
    if (bulkCount) {
      bulkCount.textContent = LEADS_FILTRADOS_IDS.length > 0
        ? \`\${LEADS_FILTRADOS_IDS.length} lead\${LEADS_FILTRADOS_IDS.length === 1 ? '' : 's'} filtrado\${LEADS_FILTRADOS_IDS.length === 1 ? '' : 's'}\`
        : 'Nenhum lead filtrado';
    }

    if (todos.length === 0) {
      container.innerHTML = '<div class="empty-state">Nenhum lead encontrado com esse filtro.</div>';
      return;
    }

    const linhasHtml = todos.map(item => {
      if (item.tipo === 'nao_identificado') {
        const imovelInputNI = \`<input type="text" class="edit-text" placeholder="— escrever —" value="" onchange="salvarCampo(\${item.id}, 'imovel_desc', this.value, this, 'nao_identificado')">\`;

        const origemSelectNI = \`<select class="edit-select \${!item.origem ? 'pendente' : ''}" onchange="salvarCampo(\${item.id}, 'origem', this.value, this, 'nao_identificado')">
          <option value="" \${!item.origem ? 'selected' : ''}>— escolher —</option>
          \${ORIGENS.map(o => \`<option value="\${o}">\${o}</option>\`).join('')}
        </select><span class="saving-dot"></span>\`;

        const corretorSelectNI = \`<select class="edit-select \${!item.corretor ? 'pendente' : ''}" onchange="salvarCampo(\${item.id}, 'corretor', this.value, this, 'nao_identificado')">
          <option value="" \${!item.corretor ? 'selected' : ''}>— escolher —</option>
          \${CORRETORES_DISPONIVEIS.map(c => \`<option value="\${c}">\${c}</option>\`).join('')}
        </select><span class="saving-dot"></span>\`;

        const statusSelectNI = \`<select class="edit-select" onchange="salvarCampo(\${item.id}, 'status', this.value, this, 'nao_identificado')">
          <option value="" selected disabled>— escolher —</option>
          \${STATUS_OPCOES.map(s => \`<option value="\${s}">\${s}</option>\`).join('')}
        </select><span class="saving-dot"></span>\`;

        const aprovadoCheckNI = \`<div class="edit-check"><input type="checkbox" onchange="salvarCampo(\${item.id}, 'aprovado', this.checked, this, 'nao_identificado')"></div>\`;
        const visitaCheckNI = \`<div class="edit-check"><input type="checkbox" onchange="salvarCampo(\${item.id}, 'visita', this.checked, this, 'nao_identificado')"></div>\`;
        const propostaCheckNI = \`<div class="edit-check"><input type="checkbox" onchange="salvarCampo(\${item.id}, 'proposta', this.checked, this, 'nao_identificado')"></div>\`;
        const vendaCheckNI = \`<div class="edit-check"><input type="checkbox" onchange="salvarCampo(\${item.id}, 'venda', this.checked, this, 'nao_identificado')"></div>\`;

        return \`<tr>
          <td><input type="text" class="edit-text edit-text-nome" value="" placeholder="— escrever nome —" onchange="salvarCampo(\${item.id}, 'nome', this.value, this, 'nao_identificado')"><div class="lead-meta mono">+\${item.whatsapp}</div></td>
          <td>\${imovelInputNI}</td>
          <td>\${origemSelectNI}</td>
          <td>\${corretorSelectNI}</td>
          <td>\${statusSelectNI}</td>
          <td>\${aprovadoCheckNI}</td>
          <td>\${visitaCheckNI}</td>
          <td>\${propostaCheckNI}</td>
          <td>\${vendaCheckNI}</td>
          <td class="time-ago">\${tempoRelativo(item.criado_em)}</td>
        </tr>\`;
      }

      const imovelAtual = [item.imovel_codigo, item.imovel_desc].filter(Boolean).join(' · ');
      const imovelInput = \`<input type="text" class="edit-text" value="\${(item.imovel_desc || '').replace(/"/g, '&quot;')}" placeholder="— escrever —" onchange="salvarCampo(\${item.id}, 'imovel_desc', this.value, this)">\`;

      const origemSelect = \`<select class="edit-select \${!item.origem ? 'pendente' : ''}" onchange="salvarCampo(\${item.id}, 'origem', this.value, this)">
        <option value="" \${!item.origem ? 'selected' : ''}>— escolher —</option>
        \${ORIGENS.map(o => \`<option value="\${o}" \${item.origem === o ? 'selected' : ''}>\${o}</option>\`).join('')}
      </select><span class="saving-dot"></span>\`;

      const corretorSelect = \`<select class="edit-select \${!item.corretor ? 'pendente' : ''}" onchange="salvarCampo(\${item.id}, 'corretor', this.value, this)">
        <option value="" \${!item.corretor ? 'selected' : ''}>— escolher —</option>
        \${CORRETORES_DISPONIVEIS.map(c => \`<option value="\${c}" \${item.corretor === c ? 'selected' : ''}>\${c}</option>\`).join('')}
        \${item.corretor && !CORRETORES_DISPONIVEIS.includes(item.corretor) ? \`<option value="\${item.corretor}" selected>\${item.corretor}</option>\` : ''}
      </select><span class="saving-dot"></span>\`;

      const statusSelect = \`<select class="edit-select" onchange="salvarCampo(\${item.id}, 'status', this.value, this)">
        \${STATUS_OPCOES.map(s => \`<option value="\${s}" \${(item.status || 'Novo') === s ? 'selected' : ''}>\${s}</option>\`).join('')}
      </select><span class="saving-dot"></span>\`;

      const aprovadoCheck = \`<div class="edit-check"><input type="checkbox" \${item.aprovado ? 'checked' : ''} onchange="salvarCampo(\${item.id}, 'aprovado', this.checked, this)"></div>\`;
      const visitaCheck = \`<div class="edit-check"><input type="checkbox" \${item.visita ? 'checked' : ''} onchange="salvarCampo(\${item.id}, 'visita', this.checked, this)"></div>\`;
      const propostaCheck = \`<div class="edit-check"><input type="checkbox" \${item.proposta ? 'checked' : ''} onchange="salvarCampo(\${item.id}, 'proposta', this.checked, this)"></div>\`;
      const vendaCheck = \`<div class="edit-check"><input type="checkbox" \${item.venda ? 'checked' : ''} onchange="salvarCampo(\${item.id}, 'venda', this.checked, this)"></div>\`;

      return \`<tr>
        <td><input type="text" class="edit-text edit-text-nome" value="\${(item.nome || '').replace(/"/g, '&quot;')}" placeholder="Sem nome" onchange="salvarCampo(\${item.id}, 'nome', this.value, this)"><div class="lead-meta mono">+\${item.whatsapp}</div></td>
        <td>\${imovelInput}</td>
        <td>\${origemSelect}</td>
        <td>\${corretorSelect}</td>
        <td>\${statusSelect}</td>
        <td>\${aprovadoCheck}</td>
        <td>\${visitaCheck}</td>
        <td>\${propostaCheck}</td>
        <td>\${vendaCheck}</td>
        <td class="time-ago">\${tempoRelativo(item.distribuido_em)}</td>
      </tr>\`;
    }).join('');

    container.innerHTML = \`<table>
      <thead><tr><th>Lead</th><th>Imóvel</th><th>Origem</th><th>Corretor</th><th>Status</th><th>Aprovado</th><th>Visita</th><th>Proposta</th><th>Venda</th><th>Chegou</th></tr></thead>
      <tbody>\${linhasHtml}</tbody>
    </table>\`;
  }
</script>
</body>
</html>`;

module.exports = { DASHBOARD_HTML };
