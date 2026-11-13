const CORRETOR_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CRM - {{NOME_CORRETOR}}</title>
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
  .visitas-box { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
  .vis-btn { width: 38px; height: 38px; border-radius: 10px; border: 1px solid var(--card-border, #d8dce6); background: #fff; font-size: 22px; font-weight: 700; line-height: 1; cursor: pointer; font-family: inherit; }
  .vis-btn:hover { background: #f1f4fb; }
  .vis-num { min-width: 34px; text-align: center; font-size: 26px; font-weight: 800; }
  .vis-txt { font-size: 12.5px; color: #6b7280; }
  .selo-visitas { display: inline-block; margin-top: 5px; font-size: 11px; font-weight: 700; color: #1a56db; background: #e8f0fe; border: 1px solid #c3d7fb; border-radius: 999px; padding: 2px 8px; }
  .btn-editar-contato { font: inherit; font-size: 11.5px; font-weight: 700; margin-left: 8px; padding: 2px 9px; border-radius: 999px; border: 1px solid #c3d7fb; background: #e8f0fe; color: #1a56db; cursor: pointer; }
  .painel-contato { display: none; margin-top: 8px; padding: 10px 12px; border: 1px dashed #c3d7fb; border-radius: 10px; background: #f7faff; }
  .painel-contato .acoes-contato { display: flex; gap: 8px; margin-top: 8px; }
  .painel-contato .aviso-contato { font-size: 12.5px; color: #c0392b; margin-top: 6px; min-height: 16px; }
  .badge-select { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 3px 6px; border-radius: 10px; margin-top: 6px; margin-right: 4px; background: #eef0f6; border: 1px solid #d8dce6; width: auto; }
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
    cursor: pointer;
    user-select: none;
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
  .alerta-atrasadas.filtrando { background: #fff; color: #e0453f; border: 2px solid #e0453f; animation: none; }
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

  /* Linha do tempo do card */
  .tl-lista { display: flex; flex-direction: column; gap: 8px; max-height: 270px; overflow-y: auto; padding: 10px; background: #dde1ec; border: 1px solid #c5cbdb; border-radius: 10px; }
  .tl-post { background: #fff; border: 1px solid #e3e6ee; border-radius: 10px; padding: 8px 10px; }
  .tl-post.tl-legado { background: #fbf6ea; border-color: #eadfc4; }
  .tl-cab { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; margin-bottom: 3px; }
  .tl-cab span { color: #767c8c; }
  .tl-txt { white-space: pre-wrap; font-size: 13px; overflow-wrap: anywhere; }
  .tl-sis { font-size: 11.5px; color: #767c8c; padding: 0 4px; overflow-wrap: anywhere; }
  .tl-sis span { opacity: .8; }
  .tl-vazio { font-size: 12.5px; color: #767c8c; text-align: center; padding: 8px; }
  .tl-novo-box { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
  .tl-aviso { font-size: 11px; color: #767c8c; }
  .tl-novo-box label { margin-top: 4px; }
  /* Card aberto em 2 colunas: dados à esquerda, linha do tempo no centro */
  .modal.modal-largo:has(> #tl-wrap) { max-width: 1060px; display: grid; grid-template-columns: 350px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); gap: 22px; max-height: 92vh; overflow: hidden; align-items: stretch; }
  .modal.modal-largo > .mcol-esq { overflow-y: auto; padding-right: 8px; min-height: 0; }
  .modal.modal-largo > #tl-wrap { display: flex; flex-direction: column; min-height: 0; border-left: 1px solid #e3e6ee; padding-left: 22px; }
  .modal.modal-largo #tl-wrap .tl-lista { flex: 1; max-height: none; min-height: 110px; font-size: 14px; }
  .modal.modal-largo > .mcol-esq label { margin: 9px 0 3px; }
  .tl-salvar { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
  .tl-salvar .close-btn { width: auto; margin: 0; padding: 11px 30px; }
  .faixa-perdido { background: #b42318; color: #fff; border-radius: 10px; padding: 10px 14px; margin: 0 0 12px; display: flex; flex-direction: column; gap: 2px; align-items: center; text-align: center; }
  .faixa-perdido b { font-size: 14px; letter-spacing: 0.4px; }
  .faixa-perdido span { font-size: 12px; opacity: 0.95; font-weight: 700; }
  .modal.lead-perdido { border-top: 6px solid #b42318; }
  .modal.modal-largo > .mcol-esq .modal-actions { display: block; margin-top: 14px; }
  .modal.modal-largo > .mcol-esq .modal-actions > div { width: 100%; }
  .modal.modal-largo > .mcol-esq .wa-btn,
  .modal.modal-largo > .mcol-esq > .close-btn { display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box; height: 42px; margin: 8px 0 0; padding: 0 14px; }
  .modal.modal-largo > .mcol-esq .saved-flash { display: none; }
  .modal.modal-largo > .mcol-esq .saved-flash.show { display: block; text-align: center; margin: 4px 0 0; }
  .tl-salvar .primary-btn { width: auto !important; margin: 0 !important; padding: 11px 34px; }
  .perdido-bloco { flex: none; background: #fff; border-top: 1px solid #dfe2ea; border-radius: 0 0 var(--radius) var(--radius); max-height: 48vh; overflow-y: auto; position: relative; }
  .column-cards.tem-perdido { border-radius: 0; }
  .perdido-bloco.dragover-p { outline: 2px dashed #b42318; outline-offset: 1px; background: #fdecea; border-radius: 8px; }
  .perdido-topo { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; align-items: center; padding: 11px 14px; font-size: 13px; font-weight: 800; color: #4b5160; background: #eceef3; cursor: pointer; user-select: none; }
  .perdido-topo:hover { background: #e3e6ee; }
  .perdido-topo .perdido-n { background: #e3e6ee; color: #4b5160; border-radius: 99px; padding: 1px 9px; font-size: 11px; }
  .perdido-cards { padding: 9px; display: flex; flex-direction: column; gap: 9px; }
  .perdido-cards .lead { opacity: 0.78; }
  .tag-perdido-antigo { font-size: 10px; color: #b42318; font-weight: 700; margin: 0 0 -5px 4px; }
  .tag-funil-perdido { font-size: 10px; color: #b42318; font-weight: 700; margin: 0 0 -5px 4px; }
  .resumo-perdidos { flex-basis: 100%; background: #fff; border: 1px solid #f0c6c1; border-radius: var(--radius); padding: 10px 14px; font-size: 13px; color: #4b5160; }
  .resumo-perdidos b { color: #b42318; }
  .modal.modal-largo #tl-wrap .tl-txt { font-size: 14px; }
  .modal.modal-largo #tl-wrap #tl-novo { min-height: 84px; max-height: 34vh; resize: none; overflow-y: auto; flex: none; }
  .modal.modal-largo > #tl-wrap { overflow-y: auto; }
  .modal.modal-largo .tl-salvar { position: sticky; bottom: 0; background: #fff; padding: 8px 0 2px; z-index: 2; flex: none; }
  @media (max-width: 860px) {
    .modal.modal-largo:has(> #tl-wrap) { display: block; height: auto; max-height: 90vh; overflow-y: auto; max-width: 440px; }
    .modal.modal-largo > .mcol-esq { overflow: visible; padding-right: 0; }
    .modal.modal-largo > #tl-wrap { border-left: 0; padding-left: 0; overflow: visible; display: contents; }
    .modal.modal-largo > .mcol-esq div[style*="flex:1"] { min-width: 0; }
    .modal.modal-largo > .mcol-esq input { min-width: 0; max-width: 100%; }
    .modal.modal-largo #tl-wrap .tl-lista { max-height: 300px; flex: none; }
  }


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

  /* Ajustes essenciais pra celular — corretor abre esse link no telefone. */
  @media (max-width: 600px) {
    body { padding: 12px; }
    .toolbar { flex-wrap: wrap; }
    .toolbar input[type="text"] { flex: 1 1 100%; }
    .add-contato-btn {
      padding: 11px 16px;
      font-size: 14.5px;
      flex: 1 1 auto;
    }
    .column { min-width: 84vw; max-width: 84vw; }
    .lead { padding: 13px; }
    .lead-nome { font-size: 14.5px; }
    .lupa-filtro-btn { width: 26px; height: 26px; font-size: 13px; }
    .btn-historico { width: 22px; height: 22px; font-size: 11px; }
    .column-header { padding: 12px 11px; font-size: 15px; }
  }
</style>
</head>
<body>

<h1>CRM - {{NOME_CORRETOR}}</h1>
<div class="sub">Seus leads, organizados por etapa. Arraste o cartão entre as colunas pra mudar o status.</div>

<div id="alerta-atrasadas" class="alerta-atrasadas" style="display:none;"></div>

<div class="stats" id="stats"></div>

<div class="toolbar">
  <input type="text" id="busca" placeholder="Buscar por nome ou WhatsApp...">
  <button class="add-contato-btn" id="btn-adicionar">+ Adicionar contato</button>
  <button class="add-contato-btn" id="btn-atualizar" style="background:#fff;color:var(--accent);border:1px solid var(--accent);box-shadow:none;">↻ Atualizar</button>
  <button class="add-contato-btn" id="btn-salvar-backup" style="background:#fff;color:#17a34a;border:1px solid #17a34a;box-shadow:none;">💾 Salvar backup</button>
  <button class="add-contato-btn" id="btn-baixar-csv" style="background:#fff;color:#3b6cf0;border:1px solid #3b6cf0;box-shadow:none;">⬇️ Baixar planilha</button>
  <button class="add-contato-btn" id="btn-analytics" onclick="window.location.href=comParamCorretor('/analytics')" style="background:#fff;color:#7c5cff;border:1px solid #7c5cff;box-shadow:none;">📊 Meus números</button>
</div>

<div class="board" id="board"></div>

<div class="overlay" id="overlay">
  <div class="modal" id="modal"></div>
</div>

<script>
let TODOS_LEADS = [];

// CRM da Bruna SDR: ela pode transferir o lead (depois do atendimento inicial) pra outro corretor.
const CORRETORES_DESTINO = ['Junior', 'Laís', 'Patricia', 'Michelle', 'Renata', 'Cyda', 'Lucas', 'Rubens', 'Nalcio'];
function ehCrmDaSdr() {
  const h = document.querySelector('h1');
  return !!h && h.textContent.toUpperCase().indexOf('BRUNA SDR') !== -1;
}
// No CRM da Bruna, lead que ela já transferiu fica só pra acompanhar (somente leitura).
function somenteLeitura(lead) {
  return ehCrmDaSdr() && !!lead.transferido_por && String(lead.corretor || '').trim().toLowerCase() !== 'bruna sdr';
}

// Opções de canal/origem pra quando o corretor adiciona um contato.
const ORIGENS = ['OLX/Canal Pro', 'Facebook', 'Patrocinado', 'TikTok', 'Instagram', 'Comentário', 'Indicação', 'Outro'];
let BUSCA = '';
let LEAD_ARRASTADO = null;
let ULTIMO_ADICIONADO_ID = null;
let FILTROS_DATA_COLUNA = {}; // { [coluna]: { de, ate } } — filtro de período por coluna
let COLUNA_FILTRO_ABERTA = null; // qual coluna está com o painel de data aberto agora

function dataDoLeadParaFiltro(lead) {
  return lead.status_corretor_alterado_em || lead.distribuido_em;
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

const COLUNAS = ['Novo', 'Reaquecido', 'Aguardando retorno', 'Visita', 'Aguardando documentação', 'Aguardando aprovação', 'Aprovado', 'Em negociação', 'Venda'];

// Paleta viva, uma cor por coluna — usada no cabeçalho e na barrinha
// lateral de cada cartão daquela coluna.
const CORES_COLUNA = {
  'Novo':                     { header: '#3b6cf0', accent: '#3b6cf0', texto: '#ffffff' },
  'Reaquecido':               { header: '#f2941c', accent: '#f2941c', texto: '#ffffff' },
  'Aguardando retorno':       { header: '#9b4de0', accent: '#9b4de0', texto: '#ffffff' },
  'Aguardando documentação':  { header: '#0aa5c2', accent: '#0aa5c2', texto: '#ffffff' },
  'Aguardando aprovação':     { header: '#2d9cdb', accent: '#2d9cdb', texto: '#ffffff' },
  'Aprovado':                 { header: '#5b6bf5', accent: '#5b6bf5', texto: '#ffffff' },
  'Visita':                   { header: '#c9a20a', accent: '#c9a20a', texto: '#ffffff' },
  'Em negociação':            { header: '#e8479e', accent: '#e8479e', texto: '#ffffff' },
  'Venda':                    { header: '#17a34a', accent: '#17a34a', texto: '#ffffff' },
  'Sem retorno':              { header: '#6b7280', accent: '#6b7280', texto: '#ffffff' },
};

function statusDoLead(lead) {
  return COLUNAS.includes(lead.status_corretor) ? lead.status_corretor : 'Novo';
}

// ─── PERDIDOS: cada coluna tem uma aba retrátil "Perdidos" ─────────
const PERDIDO_ABERTO = new Set();
let RESUMO_PERDIDOS_ABERTO = false;
// O lead antigo da coluna "Sem retorno" (que não existe mais) conta como perdido.
function ehPerdido(l) { return l.perdido_corretor === true || l.status_corretor === 'Sem retorno'; }
function funilDoPerdido(l) {
  if (l.perdido_corretor_funil) return l.perdido_corretor_funil;
  return l.status_corretor === 'Sem retorno' ? 'Sem retorno (antes da mudança)' : statusDoLead(l);
}
async function postarPerdido(id, perdido, funil) {
  const res = await fetch('/api/leads/' + id + '/perdido', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ perdido: perdido, funil: funil, board: 'corretor' }),
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok || data.ok === false) throw new Error(data.erro || 'Não consegui salvar.');
  return data;
}
function limparPerdidoLocal(l) { l.perdido_corretor = false; l.perdido_corretor_funil = null; l.perdido_corretor_em = null; }
async function marcarPerdidoIds(ids, coluna) {
  const falhas = [];
  for (const id of ids) {
    try {
      await postarPerdido(id, true, coluna);
      const l = TODOS_LEADS.find(x => String(x.id) === String(id));
      if (l) { l.status_corretor = coluna; l.perdido_corretor = true; l.perdido_corretor_funil = coluna; l.perdido_corretor_em = new Date().toISOString(); }
    } catch (e) { falhas.push(e.message); }
  }
  PERDIDO_ABERTO.add(coluna);
  render();
  if (falhas.length) alert('Não consegui marcar ' + falhas.length + ' card(s) como perdido: ' + falhas[0]);
}
async function reativarLead(id) {
  await postarPerdido(id, false);
  const l = TODOS_LEADS.find(x => String(x.id) === String(id));
  if (l) { limparPerdidoLocal(l); if (l.status_corretor === 'Sem retorno') l.status_corretor = 'Novo'; }
}
function alternarPerdido(coluna) {
  if (PERDIDO_ABERTO.has(coluna)) PERDIDO_ABERTO.delete(coluna); else PERDIDO_ABERTO.add(coluna);
  render();
}
function alternarResumoPerdidos() { RESUMO_PERDIDOS_ABERTO = !RESUMO_PERDIDOS_ABERTO; render(); }


const PALETA_CORES = ['#3b6cf0', '#e0453f', '#f2941c', '#12b76a', '#9b4de0', '#e8479e', '#0aa5c2', '#c9a20a'];
const NOMES_OFICIAIS_CORRETORES = ['Junior', 'Laís', 'Patricia', 'Michelle', 'Renata', 'Bruno', 'Juliane', 'Amanda', 'Cyda', 'Bruna SDR', 'Lucas', 'Nalcio'];
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

// Se a Juliane (ou admin) abriu esse CRM pelo atalho da coluna do
// corretor, a própria URL já vem com ?corretor=Nome — repassa isso nas
// chamadas de API, senão elas não sabem de quem buscar os dados.
const PARAM_CORRETOR = new URLSearchParams(location.search).get('corretor');
function comParamCorretor(url) {
  if (!PARAM_CORRETOR) return url;
  const separador = url.includes('?') ? '&' : '?';
  return \`\${url}\${separador}corretor=\${encodeURIComponent(PARAM_CORRETOR)}\`;
}

// Faixa vermelha piscando no topo — avisa quando tem tarefa atrasada, sem
// precisar recarregar os dados (a data já está nos leads carregados).
let SO_ATRASADAS = false;
function leadEstaAtrasado(l) {
  const agora = new Date();
  return !!(!somenteLeitura(l) && !ehPerdido(l) && l.tarefa_data && new Date(l.tarefa_data) <= agora);
}
function atualizarAlertaAtrasadas() {
  const el = document.getElementById('alerta-atrasadas');
  if (!el) return;
  const agora = new Date();
  const atrasadas = TODOS_LEADS.filter(l => !somenteLeitura(l) && !ehPerdido(l) && l.tarefa_data && new Date(l.tarefa_data) <= agora).length;
  if (atrasadas === 0) SO_ATRASADAS = false;
  if (atrasadas > 0) {
    el.style.display = 'block';
    el.classList.toggle('filtrando', SO_ATRASADAS);
    el.textContent = SO_ATRASADAS
      ? \`👁 Mostrando só as \${atrasadas} atrasada\${atrasadas > 1 ? 's' : ''} — clique aqui pra voltar ao normal\`
      : \`⏰ Você tem \${atrasadas} tarefa\${atrasadas > 1 ? 's' : ''} atrasada\${atrasadas > 1 ? 's' : ''}! Clique pra ver só elas\`;
  } else {
    el.style.display = 'none';
  }
}
document.getElementById('alerta-atrasadas').addEventListener('click', () => { SO_ATRASADAS = !SO_ATRASADAS; render(); });
setInterval(atualizarAlertaAtrasadas, 60000);

async function carregar() {
  try {
    const res = await fetch(comParamCorretor('/api/leads/meus'), { cache: 'no-store' });
    const data = await res.json();
    TODOS_LEADS = data.leads || data || [];
    render();
  } catch (err) {
    document.getElementById('board').innerHTML = '<div style="color:var(--muted);padding:20px;">Erro ao carregar leads. Recarregue a página.</div>';
  }
}

function leadsFiltrados() {
  let lista = SO_ATRASADAS ? TODOS_LEADS.filter(leadEstaAtrasado) : TODOS_LEADS;
  if (!BUSCA) return lista;
  const b = BUSCA.toLowerCase();
  return lista.filter(l => (l.nome || '').toLowerCase().includes(b) || (l.whatsapp || '').includes(b));
}

// Monta o CSV só com o que está realmente visível na tela agora (busca +
// filtro de data por coluna), não com a carteira inteira.
function exportarCSV() {
  const leads = leadsFiltrados().filter(l => leadPassaNoFiltroDeData(l, statusDoLead(l)));
  const cabecalho = ['Nome', 'WhatsApp', 'Status', 'Origem', 'Imóvel', 'Valor do imóvel', 'Tarefa', 'Prazo da tarefa', 'Notas', 'Buscando', 'Chegou em', 'Perdido?', 'Funil onde foi perdido', 'Perdido em'];
  const linhas = leads.map(l => [
    l.nome || '', l.whatsapp || '', statusDoLead(l), l.origem || '', l.imovel_desc || '',
    l.valor_imovel_sdr || '', l.tarefa_sdr || '',
    l.tarefa_data ? new Date(l.tarefa_data).toLocaleString('pt-BR') : '',
    (l.notas_sdr || '').replace(/\\n/g, ' '), (l.buscando_sdr || '').replace(/\\n/g, ' '),
    l.distribuido_em ? new Date(l.distribuido_em).toLocaleDateString('pt-BR') : '',
    ehPerdido(l) ? 'Sim' : '', ehPerdido(l) ? funilDoPerdido(l) : '', l.perdido_corretor_em ? new Date(l.perdido_corretor_em).toLocaleDateString('pt-BR') : ''
  ]);
  const escapar = v => \`"\${String(v).replace(/"/g, '""')}"\`;
  const csv = [cabecalho, ...linhas].map(linha => linha.map(escapar).join(';')).join('\\r\\n');
  const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = \`meus-leads-\${new Date().toISOString().slice(0, 10)}.csv\`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function render() {
  atualizarAlertaAtrasadas();
  const leads = leadsFiltrados();
  const MEUS = TODOS_LEADS.filter(l => !somenteLeitura(l));
  const acompanhando = TODOS_LEADS.length - MEUS.length;
  const reaquecerCount = MEUS.filter(l => statusDoLead(l) === 'Reaquecido' && !ehPerdido(l)).length;

  const vgvTotal = MEUS.filter(l => !ehPerdido(l)).reduce((soma, lead) => soma + parseValorImovel(lead.valor_imovel_sdr), 0);
  const PERDIDOS = MEUS.filter(ehPerdido);
  const contagemFunil = {};
  PERDIDOS.forEach(l => { const f = funilDoPerdido(l); contagemFunil[f] = (contagemFunil[f] || 0) + 1; });
  const ordemFunis = COLUNAS.filter(c => contagemFunil[c]).concat(Object.keys(contagemFunil).filter(f => !COLUNAS.includes(f)));
  const visitasTotal = MEUS.reduce((soma, lead) => soma + (visitaContabilizada(lead) ? (parseInt(lead.visitas_qtd, 10) || 0) : 0), 0);
  const clientesComVisita = MEUS.filter(visitaContabilizada).length;

  atualizarAlertaAtrasadas();

  document.getElementById('stats').innerHTML = \`
    <div class="stat"><span class="num">\${MEUS.length - PERDIDOS.length}</span>na carteira</div>
    \${PERDIDOS.length > 0 ? \`<div class="stat" style="color:#b42318;cursor:pointer;" title="Clique pra ver em qual funil foram perdidos" onclick="alternarResumoPerdidos()"><span class="num">\${PERDIDOS.length}</span>perdidos \${RESUMO_PERDIDOS_ABERTO ? '▴' : '▾'}</div>\` : ''}
    \${acompanhando > 0 ? \`<div class="stat" style="color:#1a56db"><span class="num">\${acompanhando}</span>transferidos (só acompanhar)</div>\` : ''}
    <div class="stat" style="color:#b5720a"><span class="num">\${reaquecerCount}</span>pra reaquecer</div>
    \${vgvTotal > 0 ? \`<div class="stat" style="color:#17a34a"><span class="num">\${formatarReais(vgvTotal)}</span>VGV total</div>\` : ''}
    \${visitasTotal > 0 ? \`<div class="stat" style="color:#1a56db"><span class="num">\${visitasTotal}</span>visitas feitas (\${clientesComVisita} cliente\${clientesComVisita > 1 ? 's' : ''})</div>\` : ''}
    \${RESUMO_PERDIDOS_ABERTO && PERDIDOS.length > 0 ? \`<div class="resumo-perdidos"><b>Perdidos por funil:</b> \${ordemFunis.map(f => f + ' <b>' + contagemFunil[f] + '</b>').join(' · ')}</div>\` : ''}
  \`;

  const board = document.getElementById('board');
  board.innerHTML = COLUNAS.map(coluna => {
    const leadsColunaSemFiltro = leads.filter(l => statusDoLead(l) === coluna && !ehPerdido(l));
    const leadsColuna = leadsColunaSemFiltro.filter(l => leadPassaNoFiltroDeData(l, coluna));
    const perdidosColuna = leads.filter(l => statusDoLead(l) === coluna && ehPerdido(l) && leadPassaNoFiltroDeData(l, coluna));
    const perdidoAberto = PERDIDO_ABERTO.has(coluna);
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
        <div class="column-cards tem-perdido" data-coluna="\${coluna}">
          \${leadsColuna.map(lead => cardHtml(lead, cor.accent)).join('') || (leadsColunaSemFiltro.length > 0 ? '<div style="text-align:center;color:var(--muted);font-size:12px;padding:12px;">Nenhum nesse período</div>' : '')}
        </div>
        <div class="perdido-bloco" data-coluna="\${coluna}">
          <div class="perdido-topo" onclick="alternarPerdido('\${coluna}')" title="Arraste um card pra cá pra marcar como perdido nessa etapa">
            <span>\${perdidoAberto ? '▾' : '▸'} Perdidos</span><span class="perdido-n">\${perdidosColuna.length}</span>
          </div>
          \${perdidoAberto ? \`<div class="perdido-cards">\${perdidosColuna.map(lead => (lead.status_corretor === 'Sem retorno' ? '<div class="tag-perdido-antigo">Sem retorno (antes da mudança)</div>' : '') + cardHtml(lead, '#9aa0ae')).join('') || '<div style="text-align:center;color:var(--muted);font-size:12px;padding:8px;">Nenhum perdido aqui</div>'}</div>\` : ''}
        </div>
      </div>
    \`;
  }).join('');

  board.querySelectorAll('.lead').forEach(el => {
    el.addEventListener('dragstart', e => {
      const ld = TODOS_LEADS.find(l => String(l.id) === String(el.dataset.id));
      if (ld && somenteLeitura(ld)) { e.preventDefault(); return; }
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
        salvarCampo(LEAD_ARRASTADO, 'status_corretor', novoStatus, () => { render(); });
        LEAD_ARRASTADO = null;
      }
    });
  });

  board.querySelectorAll('.perdido-bloco').forEach(bl => {
    bl.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); bl.classList.add('dragover-p'); });
    bl.addEventListener('dragleave', () => bl.classList.remove('dragover-p'));
    bl.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      bl.classList.remove('dragover-p');
      if (!LEAD_ARRASTADO) return;
      const coluna = bl.dataset.coluna;
      const idPerdido = LEAD_ARRASTADO;
      LEAD_ARRASTADO = null;
      marcarPerdidoIds([idPerdido], coluna);
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
  const dataEtapa = formatarData(lead.status_corretor_alterado_em || lead.distribuido_em);
  const tarefaAtrasada = !!(lead.tarefa_data && new Date(lead.tarefa_data) <= new Date());
  const classeDestaque = \`\${tarefaAtrasada ? 'atrasado' : ''} \${lead.cliente_ouro ? 'cliente-ouro' : ''}\`.trim();
  const botaoOuro = \`<button class="btn-ouro modal-versao \${lead.cliente_ouro ? 'ativo' : ''}" onclick="event.stopPropagation();alternarClienteOuro('\${lead.id}', \${!lead.cliente_ouro})" title="\${lead.cliente_ouro ? 'Cliente Ouro — clique pra desmarcar' : 'Marcar como Cliente Ouro'}">⭐</button>\`;
  return \`
    <div class="lead \${classeDestaque}" draggable="\${somenteLeitura(lead) ? 'false' : 'true'}" data-id="\${lead.id}" style="\${classeDestaque.includes('atrasado') ? '' : \`border-left-color:\${corBorda}\`}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
        <div class="lead-nome">\${lead.nome || 'Sem nome'}\${botaoOuro}</div>
        \${lead.valor_imovel_sdr ? \`<span style="font-size:10px;font-weight:700;color:#17a34a;white-space:nowrap;">💰 \${lead.valor_imovel_sdr}</span>\` : ''}
      </div>
      <div class="lead-meta">\${lead.whatsapp || 'sem WhatsApp'}</div>
      \${(parseInt(lead.visitas_qtd, 10) || 0) > 0 ? \`<div class="selo-visitas" \${visitaContabilizada(lead) ? '' : 'style="color:#6b7280;background:#f1f3f7;border-color:#d8dce6;" title="Ainda não entra na contagem: precisa ficar mais de 10h na coluna Visita"'}>🏠 \${parseInt(lead.visitas_qtd, 10)} visita\${parseInt(lead.visitas_qtd, 10) > 1 ? 's' : ''}\${visitaContabilizada(lead) ? '' : ' · a confirmar'}</div>\` : ''}
      \${dataEtapa ? \`<div class="lead-meta">Nessa etapa desde \${dataEtapa}</div>\` : ''}
      \${somenteLeitura(lead) ? \`<span class="badge" style="background:#e8f0fe;color:#1a56db;border:1px solid #c3d7fb;">➡ Transferido para \${lead.corretor}</span>\` : ''}
      \${lead.origem ? \`<span class="badge origem">\${lead.origem}</span>\` : ''}
      \${lead.tipo_sdr === 'novo' ? \`<span class="badge" style="background:#e3f8ee;color:#0f7a4a;border:1px solid #17a34a;" title="Lead novo de campanha, atendido do zero pela Bruna (SDR)">🆕 SDR · Atendido do zero</span>\` : (lead.tipo_sdr === 'reaquecido' || lead.veio_sdr) ? \`<span class="badge" style="background:#fff1e0;color:#c2700a;border:1px solid #f2941c;" title="Lead antigo reaquecido pela SDR">🔁 SDR · Reaquecido</span>\` : ''}
      \${badgeImovel(lead)}
      \${lead.tipo_lead === 'Pessoal' ? \`<span class="badge" style="background:#fff3e0;color:#c96a12;border:1px solid #ffdca8;">👤 Lead pessoal</span>\` : \`<span class="badge" style="background:#e8f0fe;color:#1a56db;border:1px solid #c3d7fb;">🏢 Lead da imobiliária</span>\`}
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
  const data = lead.distribuido_em ? new Date(lead.distribuido_em).toLocaleDateString('pt-BR') : '—';
  const waLink = lead.whatsapp ? \`https://wa.me/\${lead.whatsapp}\` : null;

  if (somenteLeitura(lead)) {
    document.getElementById('modal').innerHTML = \`
      <h2>\${lead.nome || 'Sem nome'}</h2>
      <div class="lead-meta">\${lead.whatsapp || 'sem WhatsApp'} · chegou em \${data}</div>
      <div class="aviso-modal ok" style="margin-top:10px;">➡ Transferido para <b>\${lead.corretor}</b>\${lead.transferido_em ? ' em ' + formatarData(lead.transferido_em) : ''}. Você só acompanha — quem altera agora é o corretor.</div>
      \${lead.origem ? \`<span class="badge origem">\${lead.origem}</span>\` : ''}
      \${badgeImovel(lead)}
      <label>Etapa atual com o corretor</label>
      <div style="font-weight:700;">\${statusDoLead(lead)}</div>
      \${lead.status_corretor_alterado_em ? \`<div class="lead-meta" style="margin-top:4px;">Nessa etapa desde \${formatarData(lead.status_corretor_alterado_em)}</div>\` : ''}
      \${lead.tarefa_sdr ? \`<label>Tarefa do corretor</label><div>\${lead.tarefa_sdr}</div>\` : ''}
      <label>Linha do tempo</label><div class="tl-lista" id="tl-lista">Carregando…</div>
      \${lead.buscando_sdr ? \`<label>O que está buscando</label><div style="white-space:pre-wrap;font-size:13px;">\${lead.buscando_sdr}</div>\` : ''}
      <div class="modal-actions">
        <button class="close-btn" id="modal-fechar">Fechar</button>
        \${waLink ? \`<a class="wa-btn" href="\${waLink}" target="_blank">WhatsApp ↗</a>\` : ''}
      </div>
    \`;
    document.getElementById('overlay').classList.add('show');
    carregarTimeline(lead);
    document.getElementById('modal-fechar').addEventListener('click', fecharModal);
    return;
  }

  document.getElementById('modal').innerHTML = \`
    \${ehPerdido(lead) ? '<div class="faixa-perdido"><b>❌ LEAD PERDIDO</b><span>Funil: ' + funilDoPerdido(lead) + '</span></div>' : ''}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
      <h2>\${lead.nome || 'Sem nome'}<button class="btn-ouro modal-versao \${lead.cliente_ouro ? 'ativo' : ''}" onclick="alternarClienteOuro('\${lead.id}', \${!lead.cliente_ouro})" title="\${lead.cliente_ouro ? 'Cliente Ouro — clique pra desmarcar' : 'Marcar como Cliente Ouro'}">⭐</button></h2>
      <span id="badge-valor-imovel">\${lead.valor_imovel_sdr ? \`<span class="badge" style="background:#eafcea;color:#17a34a;border:1px solid #a8ecca;white-space:nowrap;">💰 \${lead.valor_imovel_sdr}</span>\` : ''}</span>
    </div>
    <div class="lead-meta">\${lead.whatsapp || 'sem WhatsApp'} · chegou em \${data}\${ehCrmDaSdr() ? '<button type="button" class="btn-editar-contato" onclick="abrirEdicaoContato()">✎ Corrigir contato</button>' : ''}</div>
    \${ehCrmDaSdr() ? \`    <div class="painel-contato" id="painel-contato">
      <label>Nome</label>
      <input type="text" id="ed-nome" value="\${(lead.nome || '').replace(/"/g, '&quot;')}">
      <label>WhatsApp (com DDD)</label>
      <input type="text" id="ed-whats" inputmode="tel" placeholder="(62) 99999-9999" value="\${lead.whatsapp || ''}">
      <div class="aviso-contato" id="ed-aviso"></div>
      <div class="acoes-contato">
        <button type="button" class="primary-btn" onclick="salvarContato('\${lead.id}')">Salvar contato</button>
        <button type="button" class="close-btn" onclick="abrirEdicaoContato()">Cancelar</button>
      </div>
    </div>
    <select id="modal-origem" class="badge-select"><option value="" \${!lead.origem ? 'selected' : ''}>— sem canal —</option>\${(ORIGENS_SDR.includes(lead.origem) || !lead.origem ? ORIGENS_SDR : [lead.origem, ...ORIGENS_SDR]).map(o => \`<option value="\${o}" \${lead.origem === o ? 'selected' : ''}>\${o}</option>\`).join('')}</select>\` : (lead.origem ? \`<span class="badge origem">\${lead.origem}</span>\` : '')}
    \${badgeImovel(lead)}

    <label>Tipo de lead</label>
    <select id="modal-tipo-lead">
      <option value="Imobiliária" \${lead.tipo_lead !== 'Pessoal' ? 'selected' : ''}>🏢 Lead da imobiliária</option>
      <option value="Pessoal" \${lead.tipo_lead === 'Pessoal' ? 'selected' : ''}>👤 Lead pessoal</option>
    </select>

    <label>Status</label>
    <select id="modal-status">
      \${COLUNAS.map(c => \`<option value="\${c}" \${statusDoLead(lead) === c ? 'selected' : ''}>\${c}</option>\`).join('')}
    </select>
    \${lead.status_corretor_alterado_em ? \`<div class="lead-meta" style="margin-top:4px;">Nessa etapa desde \${formatarData(lead.status_corretor_alterado_em)}</div>\` : ''}

    \${ehCrmDaSdr() ? \`
      <label>Transferir para corretor (atendimento inicial feito)</label>
      <div style="display:flex;gap:6px;">
        <select id="modal-transferir"><option value="">Escolha o corretor…</option>\${CORRETORES_DESTINO.map(c => \`<option value="\${c}">\${c}</option>\`).join('')}</select>
        <button type="button" class="primary-btn" id="modal-transferir-btn" style="background:#f2941c;white-space:nowrap;">➡ Transferir</button>
      </div>
    \` : ''}

    \${mostrarCampoVisitas(lead) ? \`
    <label>Visitas com este cliente</label>
    <div class="visitas-box">
      <button type="button" class="vis-btn" onclick="ajustarVisitas('\${lead.id}', -1)" aria-label="Diminuir visitas">−</button>
      <span class="vis-num" id="vis-num">\${parseInt(lead.visitas_qtd, 10) || 0}</span>
      <button type="button" class="vis-btn" onclick="ajustarVisitas('\${lead.id}', 1)" aria-label="Aumentar visitas">+</button>
      <span class="vis-txt" id="vis-txt">\${(parseInt(lead.visitas_qtd, 10) || 0) === 1 ? 'imóvel visitado com este cliente' : 'imóveis visitados com este cliente'}</span>
    </div>

    \` : ''}

    <label>Tarefa</label>
    <input type="text" id="modal-tarefa" placeholder="Próximo passo, ex: ligar amanhã 14h" value="\${lead.tarefa_sdr || ''}">

    <label>Prazo da tarefa</label>
    <input type="datetime-local" id="modal-tarefa-data" value="\${lead.tarefa_data ? new Date(new Date(lead.tarefa_data).getTime() - new Date(lead.tarefa_data).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}">
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

    <div id="tl-wrap">
      <label>Linha do tempo</label>
      <div class="tl-lista" id="tl-lista">Carregando…</div>
      <div class="tl-novo-box">
        <label for="tl-novo">Última atualização</label>
        <textarea id="tl-novo" placeholder="O que aconteceu agora? Escreva aqui e clique em Salvar: vira um post na linha do tempo."></textarea>
        <div class="tl-aviso">Ao clicar em Salvar, o que você escreveu aqui e qualquer alteração feita ao lado viram posts. Depois de salvos, não podem ser editados nem apagados.</div>
      </div>
    </div>

    <label>O que está buscando</label>
    <textarea id="modal-buscando" placeholder="Ex: apartamento 2 quartos, até R$ 300 mil, região X...">\${lead.buscando_sdr || ''}</textarea>

    <div class="modal-actions">
      <button class="close-btn" id="modal-fechar">Fechar</button>
      <div>
        \${waLink ? \`<a class="wa-btn" href="\${waLink}" target="_blank">WhatsApp ↗</a>\` : ''}
        <span class="saved-flash" id="modal-flash">salvo ✓</span>
      </div>
    </div>
    <button class="close-btn" id="modal-perdido" style="width:100%;margin-top:8px;color:#b42318;border-color:#f0c6c1;">\${ehPerdido(lead) ? '↩ Reativar lead (sai de Perdidos)' : '❌ Marcar como perdido'}</button>
    <button class="primary-btn" id="modal-salvar" style="width:100%;margin-top:10px;">💾 Salvar</button>
  \`;

  document.getElementById('overlay').classList.add('show');
  document.getElementById('modal').classList.toggle('lead-perdido', ehPerdido(lead));
  ligarTimeline(lead);
  document.getElementById('modal-fechar').addEventListener('click', fecharModal);
  document.getElementById('modal-perdido').addEventListener('click', async () => {
    try {
      if (ehPerdido(lead)) {
        await reativarLead(id);
      } else {
        if (!confirm('Marcar "' + (lead.nome || 'esse contato') + '" como perdido no funil "' + statusDoLead(lead) + '"?')) return;
        await marcarPerdidoIds([id], statusDoLead(lead));
      }
      fecharModal();
      render();
    } catch (e) { alert(e.message); }
  });
  document.getElementById('modal-tipo-lead').addEventListener('change', e => {
    const novoTipo = e.target.value;
    salvarBlocoTexto(id, lead, () => {
      salvarCampo(id, 'tipo_lead', novoTipo, () => { render(); abrirModalLead(id); });
    });
  });
  const selectOrigem = document.getElementById('modal-origem');
  if (selectOrigem) {
    selectOrigem.addEventListener('change', e => {
      lead.origem = e.target.value;
      salvarCampo(id, 'origem', e.target.value, () => { render(); flashModal(); });
    });
  }
  document.getElementById('modal-status').addEventListener('change', e => {
    const novoStatus = e.target.value;
    // Salva primeiro o que estiver digitado (notas, tarefa etc.) antes de
    // trocar o status — senão o texto digitado e não salvo se perdia.
    salvarBlocoTexto(id, lead, () => {
      salvarCampo(id, 'status_corretor', novoStatus, () => { render(); abrirModalLead(id); });
    });
  });
  const btnTransferir = document.getElementById('modal-transferir-btn');
  if (btnTransferir) {
    btnTransferir.addEventListener('click', () => {
      const para = document.getElementById('modal-transferir').value;
      if (!para) { alert('Escolha pra qual corretor vai o lead.'); return; }
      if (!confirm('Transferir "' + (lead.nome || 'esse lead') + '" para ' + para + '? Ele continua aparecendo pra você só pra acompanhar (sem editar) e o corretor é avisado no WhatsApp.')) return;
      btnTransferir.disabled = true;
      btnTransferir.textContent = 'Transferindo...';
      salvarBlocoTexto(id, lead, () => {
        fetch('/api/leads/' + id + '/transferir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ para }) })
          .then(r => r.json())
          .then(data => {
            if (!data.ok) { alert('Não transferiu: ' + (data.erro || 'erro')); btnTransferir.disabled = false; btnTransferir.textContent = '➡ Transferir'; return; }
            fecharModal();
            carregar();
            mostrarFlashSalvoGrande();
            if (!data.avisado) alert('Transferido para ' + data.para + ', mas não consegui avisar no WhatsApp. Avise manualmente.');
          })
          .catch(() => { alert('Não consegui transferir. Confere a internet e tenta de novo.'); btnTransferir.disabled = false; btnTransferir.textContent = '➡ Transferir'; });
      });
    });
  }
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
      flashModal();
      carregarTimeline(lead); // o card continua aberto: só atualiza a linha do tempo
    });
  });
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

// ── Linha do tempo do card: posts que depois de publicados não podem ser editados ──
function tlEscapar(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function tlQuando(iso) {
  try { return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return ''; }
}
function tlRender(box, d) {
  let h = '';
  if (d.legado && String(d.legado).trim()) {
    h += '<div class="tl-post tl-legado"><div class="tl-cab"><b>Anotações anteriores</b></div><div class="tl-txt">' + tlEscapar(d.legado) + '</div></div>';
  }
  (d.posts || []).forEach(function (p) {
    if (p.tipo === 'nota') {
      h += '<div class="tl-post"><div class="tl-cab"><b>' + tlEscapar(p.autor || '') + '</b><span>' + tlQuando(p.criado_em) + '</span></div><div class="tl-txt">' + tlEscapar(p.texto) + '</div></div>';
    } else {
      h += '<div class="tl-sis"><span>' + tlQuando(p.criado_em) + '</span> · ' + tlEscapar(p.autor || '') + ': ' + tlEscapar(p.texto) + '</div>';
    }
  });
  if (!h) h = '<div class="tl-vazio">Nenhuma atualização ainda. Escreva a primeira abaixo.</div>';
  box.innerHTML = h;
  box.scrollTop = box.scrollHeight;
}
async function carregarTimeline(lead) {
  const box = document.getElementById('tl-lista');
  if (!box) return;
  try {
    const res = await fetch('/api/leads/' + lead.id + '/timeline', { cache: 'no-store' });
    const d = await res.json();
    if (!res.ok || d.ok === false) throw new Error(d.erro || 'erro');
    if (document.getElementById('tl-lista') === box) tlRender(box, d);
  } catch (e) {
    box.textContent = 'Não consegui carregar a linha do tempo. Feche e abra o card de novo.';
  }
}
async function publicarTimeline(lead) {
  const ta = document.getElementById('tl-novo');
  if (!ta) return false;
  const texto = ta.value.trim();
  if (!texto) return false;
  const btn = document.getElementById('tl-pub');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/leads/' + lead.id + '/timeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: texto }) });
    const d = await res.json();
    if (!res.ok || d.ok === false) throw new Error(d.erro || 'Não consegui publicar.');
    ta.value = '';
    lead.notas_sdr = '[' + tlQuando(d.post.criado_em) + ' ' + (d.post.autor || '') + '] ' + texto + (lead.notas_sdr ? String.fromCharCode(10) + lead.notas_sdr : '');
    await carregarTimeline(lead);
    return true;
  } catch (e) {
    alert('⚠️ ' + (e.message || 'Não consegui publicar.') + ' O texto continua na caixa — tente de novo.');
    return false;
  } finally {
    if (btn) btn.disabled = false;
  }
}
function montarModalLargo() {
  const m = document.getElementById('modal');
  const tl = document.getElementById('tl-wrap');
  if (!m || !tl || tl.parentNode !== m) return;
  const esq = document.createElement('div');
  esq.className = 'mcol-esq';
  Array.from(m.children).forEach(function (c) { if (c !== tl) esq.appendChild(c); });
  m.insertBefore(esq, tl);
  m.classList.add('modal-largo');
  // Um único botão Salvar, no canto direito, embaixo da linha do tempo.
  const sv = document.getElementById('modal-salvar');
  if (sv) {
    const cx = document.createElement('div');
    cx.className = 'tl-salvar';
    const fc = document.getElementById('modal-fechar');
    if (fc) cx.appendChild(fc);
    cx.appendChild(sv);
    tl.appendChild(cx);
  }
}
function ligarTimeline(lead) {
  montarModalLargo();
  const b = document.getElementById('tl-pub');
  if (b) b.addEventListener('click', () => publicarTimeline(lead));
  const t = document.getElementById('tl-novo');
  if (t) t.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); const s = document.getElementById('modal-salvar'); if (s) s.click(); } });
  carregarTimeline(lead);
}

// Junta tudo que está digitado nos campos de texto do modal e salva de uma
// vez. Usada tanto pelo botão "Salvar" quanto antes de trocar Status/Tipo —
// assim, texto digitado e não salvo não se perde mais ao mudar a coluna.
function salvarBlocoTexto(id, lead, aoTerminar) {
  if (!document.getElementById('modal-buscando')) { if (aoTerminar) aoTerminar(); return; }
  // O que estiver digitado na linha do tempo e ainda não publicado vai junto (não se perde ao trocar de coluna).
  const tlPendente = document.getElementById('tl-novo');
  const pubP = (tlPendente && tlPendente.value.trim()) ? publicarTimeline(lead) : Promise.resolve(true);
  const buscando = document.getElementById('modal-buscando').value;
  const tarefa = document.getElementById('modal-tarefa').value;
  const tarefaData = document.getElementById('modal-tarefa-data').value;
  const dataAtualizacao = document.getElementById('modal-ultima-atualizacao').value;
  const valorDigitado = document.getElementById('modal-valor-imovel').value;
  const numero = parseValorImovel(valorDigitado);
  const valorFormatado = numero > 0 ? formatarReais(numero) : '';
  const campoValorEl = document.getElementById('modal-valor-imovel');
  if (campoValorEl) campoValorEl.value = valorFormatado;

  lead.buscando_sdr = buscando;
  lead.tarefa_sdr = tarefa;
  lead.tarefa_data = tarefaData ? new Date(tarefaData).toISOString() : null;
  lead.ultima_atualizacao_sdr = dataAtualizacao;
  lead.valor_imovel_sdr = valorFormatado;

  const campos = [
    ['buscando_sdr', buscando],
    ['tarefa_sdr', tarefa],
    ['tarefa_data', lead.tarefa_data],
    ['ultima_atualizacao_sdr', dataAtualizacao],
    ['valor_imovel_sdr', valorFormatado],
  ];

  Promise.all([pubP, salvarCamposComRetry(id, campos)]).then((r) => {
    if (r[0] === false) return; // não conseguiu publicar a atualização: mantém o card aberto com o texto na caixa
    if (aoTerminar) aoTerminar(valorFormatado);
  }).catch(() => {
    alert('⚠️ Não consegui confirmar que salvou (rede instável). NÃO troque de status/coluna agora — tenta de novo até aparecer "Salvo ✓".');
  });
}

// Salva um campo com até 3 tentativas (rede de tablet/celular costuma cair um
// pouquinho) — só considera sucesso se o servidor realmente confirmar ok:true,
// nunca assume que salvou só porque o fetch não deu erro de rede.
async function salvarUmCampoComRetry(id, campo, valor, tentativas = 3) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const res = await fetch(\`/api/leads/\${id}\`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campo, valor }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.ok) return true;
    } catch (err) {
      // rede caiu no meio — tenta de novo
    }
    if (i < tentativas - 1) await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

// Roda todos os campos em paralelo (cada um com seu próprio retry) e só
// resolve com sucesso se TODOS confirmaram — senão rejeita, e quem chamou
// sabe que não pode seguir em frente (ex: trocar o status).
async function salvarCamposComRetry(id, campos) {
  const resultados = await Promise.all(campos.map(([campo, valor]) => salvarUmCampoComRetry(id, campo, valor)));
  if (resultados.some(ok => !ok)) throw new Error('Falha ao salvar um ou mais campos');
}

function abrirModalAdicionar() {
  document.getElementById('modal').innerHTML = \`
    <h2>Adicionar contato</h2>
    <div class="lead-meta">Se já for seu, só atualiza. Se for de outro corretor, avisa e não mexe.</div>

    <label>Nome</label>
    <input type="text" id="add-nome" placeholder="Nome do contato">

    <label>WhatsApp</label>
    <input type="text" id="add-whatsapp" placeholder="Com DDD, ex: 62999998888">

    <label>Tipo de lead</label>
    <select id="add-tipo-lead">
      <option value="Imobiliária">🏢 Lead da imobiliária</option>
      <option value="Pessoal">👤 Lead pessoal (contato meu)</option>
    </select>

    <label>Origem</label>
    <select id="add-origem">
      \${ORIGENS.map(o => \`<option value="\${o}">\${o}</option>\`).join('')}
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
      body: JSON.stringify({ nome, whatsapp, corretorAlvo: PARAM_CORRETOR || undefined, tipoLead: document.getElementById('add-tipo-lead').value, origem: document.getElementById('add-origem').value }),
    });
    const data = await res.json();

    if (!data.ok) {
      avisoEl.innerHTML = \`<div class="aviso-modal warn">⚠️ \${data.erro}</div>\`;
      return;
    }

    avisoEl.innerHTML = data.encontrado
      ? '<div class="aviso-modal ok">✅ Já existia — atualizado na sua carteira.</div>'
      : '<div class="aviso-modal ok">✅ Novo contato, adicionado à sua carteira.</div>';

    ULTIMO_ADICIONADO_ID = data.lead.id;
    await carregar();
    setTimeout(fecharModal, 900);
  } catch (err) {
    avisoEl.innerHTML = '<div class="aviso-modal warn">⚠️ Erro ao adicionar. Tenta de novo.</div>';
  }
}

const LISTA_LEADS_VISITAS = { find: (fn) => TODOS_LEADS.find(fn) };
// O campo de visitas aparece quando o card está na coluna Visita ou em qualquer
// etapa depois dela (ou se já tem visita registrada, pra o número não sumir).
const ETAPAS_DEPOIS_DA_VISITA = ['Aguardando documentação', 'Aguardando aprovação', 'Aprovado', 'Em negociação', 'Venda'];
function mostrarCampoVisitas(lead) {
  if ((parseInt(lead.visitas_qtd, 10) || 0) > 0) return true;
  return lead.status_corretor === 'Visita' || ETAPAS_DEPOIS_DA_VISITA.includes(lead.status_corretor);
}
// Só CONTA no total depois de confirmada: o card precisa ter ficado mais de 10h
// na coluna Visita (tempo da Juliane conferir se não foi engano) ou já ter
// avançado pras etapas seguintes. Card movido por engano e desfeito não conta.
function visitaContabilizada(lead) {
  if ((parseInt(lead.visitas_qtd, 10) || 0) <= 0) return false;
  if (ETAPAS_DEPOIS_DA_VISITA.includes(lead.status_corretor)) return true;
  if (lead.status_corretor !== 'Visita' || !lead.status_corretor_alterado_em) return false;
  const desde = new Date(lead.status_corretor_alterado_em).getTime();
  return !isNaN(desde) && (Date.now() - desde) > 10 * 60 * 60 * 1000;
}

function ajustarVisitas(id, delta) {
  const lead = LISTA_LEADS_VISITAS.find(l => String(l.id) === String(id));
  if (!lead) return;
  const novo = Math.max(0, Math.min(99, (parseInt(lead.visitas_qtd, 10) || 0) + delta));
  if (novo === (parseInt(lead.visitas_qtd, 10) || 0)) return;
  lead.visitas_qtd = novo;
  if (novo > 0) lead.visita = true;
  const chk = document.querySelector('#etapas-venda input[data-campo="visita"]');
  if (chk && novo > 0) { chk.checked = true; const lb = chk.closest('.etapa-item'); if (lb) lb.classList.add('marcada'); }
  const el = document.getElementById('vis-num');
  if (el) el.textContent = novo;
  const txt = document.getElementById('vis-txt');
  if (txt) txt.textContent = novo === 1 ? 'imóvel visitado com este cliente' : 'imóveis visitados com este cliente';
  salvarCampo(id, 'visitas_qtd', novo, () => { render(); });
}

const LEAD_POR_ID = (id) => TODOS_LEADS.find(l => String(l.id) === String(id));
const ORIGENS_SDR = ['OLX/Canal Pro', 'Meta Ads', 'Facebook', 'Patrocinado', 'TikTok', 'Instagram', 'Comentário', 'Indicação', 'SDR', 'Outro'];
function abrirEdicaoContato() {
  const p = document.getElementById('painel-contato');
  if (p) p.style.display = p.style.display === 'block' ? 'none' : 'block';
}

async function patchLeadComErro(id, campo, valor) {
  const res = await fetch(\`/api/leads/\${id}\`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campo, valor }),
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok || data.ok === false) throw new Error(data.erro || 'Não consegui salvar.');
  return data;
}

async function salvarContato(id) {
  const lead = LEAD_POR_ID(id);
  const aviso = document.getElementById('ed-aviso');
  if (!lead || !aviso) return;
  aviso.textContent = '';
  const nome = document.getElementById('ed-nome').value.trim();
  const whats = document.getElementById('ed-whats').value.trim();
  try {
    if (whats && whats !== String(lead.whatsapp || '')) {
      const r = await patchLeadComErro(id, 'whatsapp', whats);
      lead.whatsapp = r.whatsapp || whats;
      lead.numero_invalido = false;
    }
    if (nome && nome !== (lead.nome || '')) {
      await patchLeadComErro(id, 'nome', nome);
      lead.nome = nome;
    }
    render();
    abrirModalLead(id);
  } catch (err) {
    aviso.textContent = err.message || 'Não consegui salvar.';
  }
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
    if (lead && campo === 'status_corretor') limparPerdidoLocal(lead);
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

module.exports = { CORRETOR_HTML };
