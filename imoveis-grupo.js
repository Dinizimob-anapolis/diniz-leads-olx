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
  // Grupo único de destino (padrão: "Infos Imóveis"). Use IMOVEIS_DESTINO_NOME=- pra voltar a mandar nos grupos Estratégico de cada corretor.
  const NOME_DESTINO = process.env.IMOVEIS_DESTINO_NOME === undefined ? 'Infos Imóveis' : process.env.IMOVEIS_DESTINO_NOME;
  const MODO_GRUPO_UNICO = !!NOME_DESTINO && NOME_DESTINO !== '-';
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

  // ── Grupo "Estratégico (nome)" de cada corretor ──
  let cacheGrupos = { em: 0, lista: [] };
  async function gruposDaInstancia() {
    if (Date.now() - cacheGrupos.em < 10 * 60 * 1000 && cacheGrupos.lista.length) return cacheGrupos.lista;
    const r = await evo('GET', `/group/fetchAllGroups/${encodeURIComponent(INSTANCIA_ENVIO)}?getParticipants=false`);
    const lista = Array.isArray(r.json) ? r.json : (r.json?.groups || []);
    if (lista.length) cacheGrupos = { em: Date.now(), lista: lista.map(g => ({ id: g.id, subject: g.subject || '' })) };
    return cacheGrupos.lista;
  }
  async function grupoDoCorretor(nome) {
    const primeiro = norm(nome).split(' ')[0];
    if (!primeiro || process.env.IMOVEIS_SO_PRIVADO === '1') return null;
    const g = (await gruposDaInstancia()).find(x => { const n = norm(x.subject); return n.includes('estrategico') && n.split(' ').includes(primeiro); });
    return g ? g.id : null;
  }
  async function grupoDestinoUnico() {
    const alvo = norm(NOME_DESTINO);
    const lista = await gruposDaInstancia();
    const g = lista.find(x => norm(x.subject) === alvo) || lista.find(x => norm(x.subject).includes(alvo));
    return g ? g.id : null;
  }
  const paraObjeto = d => typeof d === 'string' ? { nome: '', fone: d.replace(/\D/g, '') } : { nome: d.nome || '', fone: String(d.fone || '').replace(/\D/g, '') };

  // Linha de separador (———, ----, ____, ====, etc.) que a equipe usa entre um imóvel e outro
  const LINHA_SEP = /^[\s—–\-_=─━~*•.·]{4,}$/;
  const temSep = t => String(t || '').split('\n').some(l => LINHA_SEP.test(l));

  // Divide as mensagens de uma pessoa em imóveis: cada separador fecha um imóvel
  function separarImoveis(msgs) {
    const grupos = [[]];
    const fecha = () => { if (grupos[grupos.length - 1].length) grupos.push([]); };
    for (const x of msgs) {
      if (x.tipo === 'text' && temSep(x.texto)) {
        const partes = x.texto.split(/\n/).reduce((acc, l) => {
          if (LINHA_SEP.test(l)) acc.push([]); else acc[acc.length - 1].push(l);
          return acc;
        }, [[]]);
        partes.forEach((linhas, i) => {
          if (i > 0) fecha();
          const texto = linhas.join('\n').trim();
          if (texto) grupos[grupos.length - 1].push({ ...x, texto });
        });
      } else {
        const y = x.tipo !== 'text' && temSep(x.texto)
          ? { ...x, texto: x.texto.split('\n').filter(l => !LINHA_SEP.test(l)).join('\n').trim() } : x;
        grupos[grupos.length - 1].push(y);
      }
    }
    return grupos.filter(g => g.length);
  }

  // ── Limpeza da descrição: tira qualquer contato do proprietário ──
  function limparDescricao(texto) {
    let t = String(texto || '').replace(/\r/g, '');
    t = t.replace(/https?:\/\/(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\S*/gi, '');
    t = t.replace(/\bwa\.me\/\S*/gi, '');
    // links de mapa / localização (Google Maps, Waze, coordenadas)
    t = t.replace(/(?:https?:\/\/)?(?:(?:www\.|maps\.)?google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|g\.page|waze\.com|ul\.waze\.com|maps\.apple\.com|share\.google)\S*/gi, '');
    t = t.replace(/-?\d{1,2}\.\d{4,},\s*-?\d{1,3}\.\d{4,}/g, '');
    const rotulo = /(localiza[çc][aã]o|\blocal:|\bmaps\b|\bwaze\b|propriet[aá]ri|\bdono\b|\bdona\b|contato|telefone|\btel\b|\bfone\b|whats|\bzap\b|\bcel\b|celular|falar com|ligar para|ligar p\/)/i;
    t = t.split('\n').filter(l => !rotulo.test(l) && !LINHA_SEP.test(l)).join('\n');
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
    let todos = getDestinos().map(paraObjeto);
    let destinos;
    if (MODO_GRUPO_UNICO && !(soPara && String(soPara).replace(/\D/g, '').length >= 8)) {
      const jidD = await grupoDestinoUnico();
      if (!jidD) {
        console.warn(`[Imóveis] Grupo de destino "${NOME_DESTINO}" não encontrado — o 7070 precisa estar nele. Nada enviado.`);
        return { erro: `grupo "${NOME_DESTINO}" não encontrado (o 7070 precisa ser membro)` };
      }
      destinos = [{ nome: NOME_DESTINO, fone: jidD, grupoUnico: true }];
    } else if (soPara) {
      const so = String(soPara);
      if (so.replace(/\D/g, '').length >= 8) destinos = [{ nome: '', fone: so.replace(/\D/g, ''), soPrivado: true }];
      else destinos = todos.filter(d => norm(d.nome).includes(norm(so))); // teste por nome: usa o grupo do corretor
    } else destinos = todos;
    if (!MODO_GRUPO_UNICO || !destinos[0]?.grupoUnico) destinos = destinos.filter(d => d.fone && !(foneRemetente && foneRemetente.length >= 10 && d.fone.endsWith(foneRemetente.slice(-10))));
    destinos = destinos.filter((d, i) => destinos.findIndex(x => x.fone === d.fone) === i);

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
    for (const dest of destinos) {
      let fone = dest.fone, via = 'privado';
      try {
        const jidG = (dest.soPrivado || dest.grupoUnico) ? null : await grupoDoCorretor(dest.nome);
        if (jidG) { fone = jidG; via = 'grupo'; }
      } catch (e) { console.error('[Imóveis] Erro ao buscar grupo do corretor:', e.message); }
      // só no grupo "Estratégico": sem grupo, NÃO manda no privado (a menos que IMOVEIS_ENVIAR_PRIVADO=1)
      if (via === 'privado' && !dest.soPrivado && !dest.grupoUnico && process.env.IMOVEIS_ENVIAR_PRIVADO !== '1') {
        console.warn(`[Imóveis] Sem grupo Estratégico para ${dest.nome || dest.fone} — não enviado (o 7070 precisa estar no grupo)`);
        falhas.push((dest.nome || dest.fone) + ' (sem grupo)');
        continue;
      }
      try {
        const rt = await enviarTexto(fone, descricao ? `${cabecalho}\n\n${descricao}` : cabecalho, INSTANCIA_ENVIO);
        if (rt && rt._ok === false) { falhas.push(dest.nome || dest.fone); await dormir(aleatorio(1000, 2000)); continue; }
        for (const md of midias) {
          await dormir(aleatorio(1500, 3500));
          await enviarMidia(fone, md.tipo, md, '');
        }
        enviados++;
        console.log(`[Imóveis] Enviado pra ${dest.nome || '...' + dest.fone.slice(-4)} (${via})`);
      } catch (e) {
        falhas.push(dest.nome || dest.fone);
        console.error(`[Imóveis] Erro ao enviar pra ${dest.nome || dest.fone}:`, e.message);
      }
      await dormir(aleatorio(5000, 10000));
    }
    await pool.query(
      `INSERT INTO imoveis_grupo_envios (remetente, midias, destinatarios, descricao) VALUES ($1,$2,$3,$4)`,
      [remetente, midias.length, enviados, descricao.slice(0, 2000)]
    );
    console.log(`[Imóveis] Imóvel repassado: ${midias.length} mídia(s) pra ${enviados} corretor(es)`);
    return { midias: midias.length, destinatarios: enviados, falharam: falhas.length, falhas };
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
        for (const grupo of separarImoveis(m.rows)) {
          try { resultados.push(await repassar(grupo, opts.soPara)); }
          catch (e) { console.error('[Imóveis] Erro ao repassar imóvel:', e); resultados.push({ erro: e.message }); }
        }
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

  async function mostrarDestinos() {
    if (MODO_GRUPO_UNICO) { const g = await grupoDestinoUnico().catch(() => null); return { modo: 'grupo único', destino: NOME_DESTINO, jid: g, aviso: g ? null : 'grupo não encontrado — o 7070 precisa ser membro' }; }
    const out = [];
    for (const d of getDestinos().map(paraObjeto)) {
      let g = null; try { g = await grupoDoCorretor(d.nome); } catch (e) {}
      out.push({ nome: d.nome || '(sem nome)', fone: d.fone, envia_para: g ? 'grupo ' + g : (process.env.IMOVEIS_ENVIAR_PRIVADO === '1' ? 'privado (grupo não encontrado)' : 'NÃO ENVIA (grupo Estratégico não encontrado)') });
    }
    return out;
  }

  async function listarGrupos() {
    const r = await evo('GET', `/group/fetchAllGroups/${encodeURIComponent(instanciaPadrao)}?getParticipants=false`);
    const lista = Array.isArray(r.json) ? r.json : (r.json?.groups || []);
    return lista.map(g => ({ id: g.id, nome: g.subject }));
  }

  return { separarImoveis, iniciar, tratarMensagem, processarPendentes, status, mostrarDestinos, listarGrupos, resolverGrupo, limparDescricao };
}

module.exports = { criarModuloImoveis };
