// ─── AUTOMAÇÃO: IMÓVEIS DO GRUPO "Descrição dos imóveis" ─────
// Separada do CRM. O número 7070 fica no grupo; tudo que um membro posta em
// sequência (fotos, vídeos e descrição) vira UM imóvel. Depois de uma pausa
// (padrão 3 min sem mensagem nova daquela pessoa) o imóvel é repassado pra todos
// os corretores — só foto, vídeo e descrição, SEM o contato do proprietário.

function criarModuloImoveis({ pool, evolutionUrl, evolutionToken, instanciaPadrao, getDestinos, enviarTexto }) {
  const NOME_GRUPO = process.env.IMOVEIS_GRUPO_NOME || 'Descrição dos imóveis';
  const JID_FIXO = process.env.IMOVEIS_GRUPO_JID || '';
  const PAUSA_MS = Math.max(1, parseFloat(process.env.IMOVEIS_PAUSA_MIN) || 3) * 60 * 1000;
  const MAX_MIDIAS = parseInt(process.env.IMOVEIS_MAX_MIDIAS, 10) || 40;
  const INSTANCIA_ENVIO = process.env.IMOVEIS_INSTANCIA_ENVIO || instanciaPadrao;
  const DESATIVADO = String(process.env.IMOVEIS_GRUPO_DESATIVADO || '') === '1';

  let jidGrupo = JID_FIXO;
  let ultimaBusca = 0;
  let processando = false;

  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  const aleatorio = (a, b) => a + Math.random() * (b - a);

  async function evo(metodo, caminho, corpo) {
    const res = await fetch(`${evolutionUrl}${caminho}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', apikey: evolutionToken },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, json };
  }

  async function iniciarTabela() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS imoveis_grupo_msgs (
        id SERIAL PRIMARY KEY,
        msg_id TEXT UNIQUE NOT NULL,
        instancia TEXT,
        remetente TEXT NOT NULL,
        remetente_nome TEXT,
        tipo TEXT NOT NULL,
        texto TEXT,
        mimetype TEXT,
        criado_em TIMESTAMP DEFAULT now(),
        processado BOOLEAN DEFAULT false
      )`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS imoveis_grupo_envios (
        id SERIAL PRIMARY KEY,
        remetente TEXT,
        midias INT,
        destinatarios INT,
        descricao TEXT,
        criado_em TIMESTAMP DEFAULT now()
      )`);
  }

  async function resolverGrupo(forcar) {
    if (jidGrupo && !forcar) return jidGrupo;
    if (!forcar && Date.now() - ultimaBusca < 5 * 60 * 1000) return jidGrupo;
    ultimaBusca = Date.now();
    const r = await evo('GET', `/group/fetchAllGroups/${encodeURIComponent(instanciaPadrao)}?getParticipants=false`);
    const lista = Array.isArray(r.json) ? r.json : (r.json?.groups || []);
    const alvo = norm(NOME_GRUPO);
    const g = lista.find(x => norm(x.subject) === alvo) || lista.find(x => norm(x.subject).includes(alvo));
    if (g) {
      jidGrupo = g.id;
      console.log(`[Imóveis] Grupo "${g.subject}" encontrado: ${g.id}`);
    } else {
      console.warn(`[Imóveis] Grupo "${NOME_GRUPO}" não encontrado entre os ${lista.length} grupos do número (HTTP ${r.status}). O 7070 precisa estar no grupo.`);
    }
    return jidGrupo;
  }

  // ── Limpeza da descrição: tira qualquer contato do proprietário ──
  function limparDescricao(texto) {
    let t = String(texto || '').replace(/\r/g, '');
    t = t.replace(/https?:\/\/(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\S*/gi, '');
    t = t.replace(/\bwa\.me\/\S*/gi, '');
    const rotulo = /(propriet[aá]ri|\bdono\b|\bdona\b|contato|telefone|\btel\b|\bfone\b|whats|\bzap\b|\bcel\b|celular|falar com|ligar para|ligar p\/)/i;
    t = t.split('\n').filter(l => !rotulo.test(l)).join('\n');
    t = t.replace(/\+?\d[\d\s().-]{8,}\d/g, (m, pos, tudo) => {
      const antes = tudo.slice(Math.max(0, pos - 4), pos);
      if (/R\$\s*$/i.test(antes) || m.includes(',')) return m;
      const digitos = m.replace(/\D/g, '').length;
      return digitos >= 10 && digitos <= 13 ? '' : m;
    });
    return t.split('\n').map(l => l.replace(/[ \t]+$/g, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // ── Entrada: chamada pelo webhook de mensagens ──
  // Retorna true se a mensagem era de grupo (tratada aqui ou ignorada).
  async function tratarMensagem(body) {
    const d = body?.data || body || {};
    const jid = d?.key?.remoteJid || '';
    if (!jid.includes('@g.us')) return false;
    if (DESATIVADO) return true;
    try {
      console.log(`[Imóveis] Mensagem de grupo recebida: ${jid} fromMe=${!!d.key.fromMe} de=${d.pushName || d.key.participant || '?'} tipos=${Object.keys(d.message || {}).join(',')}`);
      if (d.key.fromMe) { console.log('[Imóveis] Ignorada: enviada pelo próprio número (7070)'); return true; }
      const alvo = await resolverGrupo(false);
      if (!alvo || jid !== alvo) { console.log(`[Imóveis] Ignorada: não é o grupo alvo (${alvo || 'grupo ainda não encontrado'})`); return true; }

      const m = d.message || {};
      let tipo = null, texto = '', mimetype = null;
      if (m.imageMessage) { tipo = 'image'; texto = m.imageMessage.caption || ''; mimetype = m.imageMessage.mimetype; }
      else if (m.videoMessage) { tipo = 'video'; texto = m.videoMessage.caption || ''; mimetype = m.videoMessage.mimetype; }
      else if (m.conversation || m.extendedTextMessage?.text) { tipo = 'text'; texto = m.conversation || m.extendedTextMessage.text; }
      else return true; // contato, áudio, figurinha etc. — ignora

      const remetente = String(d.key.participant || d.participant || d.pushName || 'desconhecido');
      const msgId = d.key.id || `${remetente}-${Date.now()}-${Math.random()}`;
      await pool.query(
        `INSERT INTO imoveis_grupo_msgs (msg_id, instancia, remetente, remetente_nome, tipo, texto, mimetype)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (msg_id) DO NOTHING`,
        [msgId, body?.instance || instanciaPadrao, remetente, d.pushName || null, tipo, texto, mimetype]
      );
      console.log(`[Imóveis] Mensagem do grupo guardada (${tipo}) de ${d.pushName || remetente}`);
    } catch (err) {
      console.error('[Imóveis] Erro ao guardar mensagem do grupo:', err);
    }
    return true;
  }

  async function baixarMidia(msgId, instancia) {
    const r = await evo('POST', `/chat/getBase64FromMediaMessage/${encodeURIComponent(instancia)}`, {
      message: { key: { id: msgId } }, convertToMp4: false,
    });
    const b64 = r.json?.base64;
    if (!r.ok || !b64) return null;
    return { base64: String(b64).replace(/^data:[^,]*,/, ''), mimetype: r.json.mimetype || null, fileName: r.json.fileName || null };
  }

  async function enviarMidia(fone, tipo, midia, legenda) {
    const ext = (midia.mimetype || '').split('/')[1]?.split(';')[0] || (tipo === 'video' ? 'mp4' : 'jpg');
    const r = await evo('POST', `/message/sendMedia/${encodeURIComponent(INSTANCIA_ENVIO)}`, {
      number: fone,
      mediatype: tipo,
      mimetype: midia.mimetype || (tipo === 'video' ? 'video/mp4' : 'image/jpeg'),
      caption: legenda || '',
      media: midia.base64,
      fileName: midia.fileName || `imovel.${ext}`,
    });
    if (!r.ok) console.error(`[Imóveis] Falha ao enviar mídia (HTTP ${r.status}):`, JSON.stringify(r.json).slice(0, 300));
    return r.ok;
  }

  // ── Repasse de um imóvel (lote de mensagens do mesmo remetente) ──
  async function repassar(msgs, soPara) {
    const remetente = msgs[0].remetente;
    const midiasMsgs = msgs.filter(x => x.tipo !== 'text').slice(0, MAX_MIDIAS);
    const textoBruto = msgs.map(x => x.texto).filter(Boolean).join('\n\n');
    const descricao = limparDescricao(textoBruto);

    // precisa ter cara de imóvel: mídia, ou texto razoável
    if (!midiasMsgs.length && descricao.length < 40) {
      console.log('[Imóveis] Sequência ignorada (sem mídia e sem descrição relevante)');
      return { ignorado: true };
    }

    const foneRemetente = remetente.replace(/\D/g, '');
    let destinos = (soPara ? [soPara.replace(/\D/g, '')] : getDestinos())
      .filter(f => f && !(foneRemetente && foneRemetente.length >= 10 && f.endsWith(foneRemetente.slice(-10))));
    destinos = [...new Set(destinos)];

    // baixa cada mídia uma vez só
    const midias = [];
    for (const x of midiasMsgs) {
      try {
        const b = await baixarMidia(x.msg_id, x.instancia || instanciaPadrao);
        if (b) midias.push({ tipo: x.tipo, ...b });
        else console.warn('[Imóveis] Não consegui baixar uma mídia (id ' + x.msg_id + ')');
      } catch (e) { console.error('[Imóveis] Erro ao baixar mídia:', e.message); }
    }

    const cabecalho = '🏠 *Imóvel novo do grupo*';
    let enviados = 0;
    const falhas = [];
    for (const fone of destinos) {
      try {
        const rt = await enviarTexto(fone, descricao ? `${cabecalho}\n\n${descricao}` : cabecalho, INSTANCIA_ENVIO);
        if (rt && rt._ok === false) { falhas.push(fone); await dormir(aleatorio(1000, 2000)); continue; }
        for (const md of midias) {
          await dormir(aleatorio(1500, 3500));
          await enviarMidia(fone, md.tipo, md, '');
        }
        enviados++;
      } catch (e) {
        falhas.push(fone);
        console.error(`[Imóveis] Erro ao enviar pra ...${fone.slice(-4)}:`, e.message);
      }
      await dormir(aleatorio(5000, 10000));
    }
    await pool.query(
      `INSERT INTO imoveis_grupo_envios (remetente, midias, destinatarios, descricao) VALUES ($1,$2,$3,$4)`,
      [remetente, midias.length, enviados, descricao.slice(0, 2000)]
    );
    console.log(`[Imóveis] Imóvel repassado: ${midias.length} mídia(s) pra ${enviados} corretor(es)`);
    return { midias: midias.length, destinatarios: enviados, falharam: falhas.length };
  }

  // Varre o banco: remetentes cuja última mensagem tem mais de PAUSA_MS
  async function processarPendentes(opts = {}) {
    if (processando) return { ocupado: true };
    processando = true;
    const resultados = [];
    try {
      const r = await pool.query(`
        SELECT remetente FROM imoveis_grupo_msgs
        WHERE processado = false
        GROUP BY remetente
        HAVING ${opts.agora ? 'true' : `max(criado_em) < now() - ($1::text || ' milliseconds')::interval`}`,
        opts.agora ? [] : [String(PAUSA_MS)]);
      for (const row of r.rows) {
        const m = await pool.query(
          `SELECT * FROM imoveis_grupo_msgs WHERE remetente = $1 AND processado = false ORDER BY criado_em, id`, [row.remetente]);
        // marca antes de enviar: nunca reenvia em duplicidade se travar no meio
        await pool.query(`UPDATE imoveis_grupo_msgs SET processado = true WHERE id = ANY($1)`, [m.rows.map(x => x.id)]);
        try { resultados.push(await repassar(m.rows, opts.soPara)); }
        catch (e) { console.error('[Imóveis] Erro ao repassar imóvel:', e); resultados.push({ erro: e.message }); }
      }
    } finally { processando = false; }
    return resultados;
  }

  async function iniciar() {
    if (DESATIVADO) { console.log('[Imóveis] Automação do grupo desativada (IMOVEIS_GRUPO_DESATIVADO=1)'); return; }
    await iniciarTabela();
    resolverGrupo(true).catch(e => console.error('[Imóveis] Erro ao buscar grupo:', e.message));
    setInterval(() => processarPendentes().catch(e => console.error('[Imóveis] Erro no ciclo:', e)), 30 * 1000);
    console.log(`✅ Automação de imóveis do grupo "${NOME_GRUPO}" ativa (pausa de ${PAUSA_MS / 60000} min)`);
  }

  async function status() {
    const pend = await pool.query(`SELECT remetente, count(*)::int n, max(criado_em) ultima FROM imoveis_grupo_msgs WHERE processado=false GROUP BY remetente`);
    const env = await pool.query(`SELECT remetente, midias, destinatarios, left(descricao,120) descricao, criado_em FROM imoveis_grupo_envios ORDER BY id DESC LIMIT 10`);
    return { grupo: NOME_GRUPO, jid: jidGrupo || null, pausaMin: PAUSA_MS / 60000, destinos: getDestinos().length, pendentes: pend.rows, ultimosEnvios: env.rows };
  }

  async function listarGrupos() {
    const r = await evo('GET', `/group/fetchAllGroups/${encodeURIComponent(instanciaPadrao)}?getParticipants=false`);
    const lista = Array.isArray(r.json) ? r.json : (r.json?.groups || []);
    return lista.map(g => ({ id: g.id, nome: g.subject }));
  }

  return { iniciar, tratarMensagem, processarPendentes, status, listarGrupos, resolverGrupo, limparDescricao };
}

module.exports = { criarModuloImoveis };
