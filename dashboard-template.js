const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Diniz Imóveis — Painel de Leads</title>
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
  }
  .origem-chip .count { font-family: 'JetBrains Mono', monospace; font-weight: 600; color: var(--amber); }

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
      <button id="refresh-btn" onclick="carregarDados()">↻ Atualizar</button>
      <div id="last-sync" style="margin-top:6px;">Ainda não atualizado</div>
    </div>
  </header>

  <div class="metrics">
    <div class="metric"><div class="label">Leads distribuídos (7 dias)</div><div class="value" id="m-distribuidos">—</div><div class="sub" id="m-distribuidos-sub">&nbsp;</div></div>
    <div class="metric accent"><div class="label">Entraram em contato</div><div class="value" id="m-contataram">—</div><div class="sub" id="m-contataram-sub">&nbsp;</div></div>
    <div class="metric warn-metric"><div class="label">Sem corretor identificado</div><div class="value" id="m-semcorretor">—</div><div class="sub">últimas 24h</div></div>
    <div class="metric"><div class="label">Tempo médio até 1º contato</div><div class="value" id="m-tempo">—</div><div class="sub">da distribuição à resposta</div></div>
  </div>

  <div class="corretores" id="corretores-strip"></div>
  <div class="origem-strip" id="origem-strip"></div>

  <div class="panel" style="margin-bottom:28px;">
    <div class="panel-head">
      <h2>Campanhas (imóveis)</h2>
    </div>
    <div id="campanhas-container" style="padding:16px 22px;"></div>
  </div>

  <div class="panel">
    <div class="panel-head">
      <h2>Atividade recente</h2>
      <div class="filters">
        <select id="filtro-corretor" onchange="renderTabela()"><option value="">Todos os corretores</option></select>
        <select id="filtro-campanha" onchange="renderTabela()"><option value="">Todas as campanhas</option></select>
        <select id="filtro-origem" onchange="renderTabela()">
          <option value="">Todas as origens</option>
          <option value="OLX/Canal Pro">OLX/Canal Pro</option>
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
          <option value="Venda">Venda</option>
          <option value="Perdido">Perdido</option>
        </select>
      </div>
    </div>
    <div class="table-scroll" id="tabela-container">
      <div class="empty-state">Clique em "Atualizar" pra carregar os leads.</div>
    </div>
  </div>

  <footer class="note" id="footer-note">diniz-leads-olx · painel manual — atualiza somente ao clicar · edite Origem, Status, Visita, Proposta e Venda direto na tabela</footer>

</div>

<script>
  const CORES_CORRETOR = ['#B8863B', '#4A7A5E', '#6B5CA5', '#B14B3B', '#3B6EB8'];
  const ORIGENS = ['OLX/Canal Pro', 'TikTok', 'Instagram', 'Comentário', 'Outro'];
  const STATUS_OPCOES = ['Novo', 'Em atendimento', 'Visita agendada', 'Proposta', 'Venda', 'Perdido'];
  let ULTIMO_ESTADO = null;

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

  function formatarDataInput(dataIso) {
    if (!dataIso) return '';
    return new Date(dataIso).toISOString().slice(0, 10);
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

  // Salva um campo editável direto na tabela, sem recarregar tudo
  async function salvarCampo(id, campo, valor, elemento) {
    const dot = elemento.parentElement.querySelector('.saving-dot');
    if (dot) dot.classList.add('show');
    try {
      const res = await fetch('/api/leads/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campo, valor }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');

      // Atualiza o estado local pra manter os filtros/contadores coerentes sem novo fetch
      if (ULTIMO_ESTADO) {
        const lead = ULTIMO_ESTADO.leads.find(l => l.id === id);
        if (lead) lead[campo] = valor;
      }
      if (campo === 'origem' && elemento.classList) {
        elemento.classList.toggle('pendente', !valor);
      }
    } catch (err) {
      alert('Não consegui salvar essa alteração. Tenta de novo.');
    } finally {
      if (dot) setTimeout(() => dot.classList.remove('show'), 400);
    }
  }

  function renderTudo(data) {
    document.getElementById('m-distribuidos').textContent = data.stats.totalDistribuidos;
    document.getElementById('m-distribuidos-sub').textContent = '+' + data.stats.distribuidos24h + ' nas últimas 24h';

    document.getElementById('m-contataram').textContent = data.stats.totalContataram;
    const pct = data.stats.totalDistribuidos > 0
      ? Math.round((data.stats.totalContataram / data.stats.totalDistribuidos) * 100)
      : 0;
    document.getElementById('m-contataram-sub').textContent = pct + '% dos distribuídos';

    document.getElementById('m-semcorretor').textContent = data.stats.semCorretor24h;
    document.getElementById('m-tempo').textContent = formatarTempoMedio(data.stats.tempoMedioContatoSegundos);

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
    origemStrip.innerHTML = origens.map(o =>
      \`<div class="origem-chip">\${o.origem} <span class="count">\${o.total}</span></div>\`
    ).join('') || '<div class="mono">Nenhuma origem registrada ainda</div>';

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

    renderTabela();
  }

  function renderTabela() {
    const container = document.getElementById('tabela-container');
    if (!ULTIMO_ESTADO) return;

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

    if (todos.length === 0) {
      container.innerHTML = '<div class="empty-state">Nenhum lead encontrado com esse filtro.</div>';
      return;
    }

    const linhasHtml = todos.map(item => {
      if (item.tipo === 'nao_identificado') {
        return \`<tr>
          <td><div class="lead-name">Número não identificado</div><div class="lead-meta mono">+\${item.whatsapp}</div></td>
          <td class="mono">—</td>
          <td>—</td>
          <td><span class="tag tag-warn">Sem corretor</span></td>
          <td><span class="tag tag-warn">● Verificar</span></td>
          <td>—</td><td>—</td><td>—</td><td>—</td>
          <td class="time-ago">\${tempoRelativo(item.criado_em)}</td>
        </tr>\`;
      }

      const imovel = [item.imovel_codigo, item.imovel_desc].filter(Boolean).join(' · ') || '—';
      const statusTag = item.contatou
        ? '<span class="tag tag-ok">● Contatou</span>'
        : '<span class="tag tag-pending">Aguardando</span>';

      const origemSelect = \`<select class="edit-select \${!item.origem ? 'pendente' : ''}" onchange="salvarCampo(\${item.id}, 'origem', this.value, this)">
        <option value="" \${!item.origem ? 'selected' : ''}>— escolher —</option>
        \${ORIGENS.map(o => \`<option value="\${o}" \${item.origem === o ? 'selected' : ''}>\${o}</option>\`).join('')}
      </select><span class="saving-dot"></span>\`;

      const statusSelect = \`<select class="edit-select" onchange="salvarCampo(\${item.id}, 'status', this.value, this)">
        \${STATUS_OPCOES.map(s => \`<option value="\${s}" \${(item.status || 'Novo') === s ? 'selected' : ''}>\${s}</option>\`).join('')}
      </select><span class="saving-dot"></span>\`;

      const ultimoContatoInput = \`<input type="date" class="edit-date" value="\${formatarDataInput(item.ultimo_contato)}" onchange="salvarCampo(\${item.id}, 'ultimo_contato', this.value, this)"><span class="saving-dot"></span>\`;

      const visitaCheck = \`<div class="edit-check"><input type="checkbox" \${item.visita ? 'checked' : ''} onchange="salvarCampo(\${item.id}, 'visita', this.checked, this)"></div>\`;
      const propostaCheck = \`<div class="edit-check"><input type="checkbox" \${item.proposta ? 'checked' : ''} onchange="salvarCampo(\${item.id}, 'proposta', this.checked, this)"></div>\`;
      const vendaCheck = \`<div class="edit-check"><input type="checkbox" \${item.venda ? 'checked' : ''} onchange="salvarCampo(\${item.id}, 'venda', this.checked, this)"></div>\`;

      return \`<tr>
        <td><div class="lead-name">\${item.nome || 'Sem nome'}</div><div class="lead-meta mono">+\${item.whatsapp}</div></td>
        <td class="mono">\${imovel}</td>
        <td>\${origemSelect}</td>
        <td><span class="corretor-badge"><span class="dot" style="background:\${corDoCorretor(item.corretor)}"></span>\${item.corretor || '—'}</span></td>
        <td>\${statusSelect}</td>
        <td>\${ultimoContatoInput}</td>
        <td>\${visitaCheck}</td>
        <td>\${propostaCheck}</td>
        <td>\${vendaCheck}</td>
        <td class="time-ago">\${tempoRelativo(item.distribuido_em)}</td>
      </tr>\`;
    }).join('');

    container.innerHTML = \`<table>
      <thead><tr><th>Lead</th><th>Imóvel</th><th>Origem</th><th>Corretor</th><th>Status</th><th>Último contato</th><th>Visita</th><th>Proposta</th><th>Venda</th><th>Chegou</th></tr></thead>
      <tbody>\${linhasHtml}</tbody>
    </table>\`;
  }
</script>
</body>
</html>`;

module.exports = { DASHBOARD_HTML };
