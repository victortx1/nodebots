const ADMINS_COLLECTION = "admins";
const CONVERSAS_COLLECTION = "conversas";
const BOT_PARAM = "bot";
const CONVERSA_PARAM = "conversa";

let usuarioAtual = null;
let souAdmin = false;
let conversaAtualId = null;
let conversaAtualDados = null;
let unsubscribeMensagens = null;
let unsubscribeConversas = null;

function escaparTexto(valor) {
  return String(valor || "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

function timestampNumero(ts) {
  try { return ts?.toMillis ? ts.toMillis() : new Date(ts || 0).getTime() || 0; }
  catch (_) { return 0; }
}

function formatarHora(ts) {
  if (!ts) return "agora";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("pt-BR", {day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"});
}

async function verificarAdmin(user) {
  const email = String(user?.email || "").trim();
  if (!email) return false;
  try {
    // O documento existente no Firebase é admins/<gmail> com ativo:true.
    const ids = [...new Set([email, email.toLowerCase()])];
    for (const id of ids) {
      const snap = await db.collection(ADMINS_COLLECTION).doc(id).get();
      if (snap.exists && snap.data().ativo === true) return true;
    }
  } catch (err) {
    console.error("[NodeBots] Falha ao verificar admin:", err);
  }
  return false;
}

async function obterConversaPermitida(id) {
  if (!id || !usuarioAtual) return null;
  const snap = await db.collection(CONVERSAS_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  const dados = snap.data();
  if (souAdmin || dados.usuarioId === usuarioAtual.uid) return {id:snap.id, dados};
  return null;
}

async function criarOuAbrirConversa(botNome) {
  if (!termosAceitos) throw new Error("Termos ainda não aceitos.");

  // Consulta somente pelo UID. A ordenação é feita no navegador para não exigir índice composto.
  const snap = await db.collection(CONVERSAS_COLLECTION)
    .where("usuarioId", "==", usuarioAtual.uid)
    .get();

  const docs = snap.docs
    .filter(d => d.data().botNome === botNome)
    .sort((a,b) => timestampNumero(b.data().atualizadoEm) - timestampNumero(a.data().atualizadoEm));

  if (docs.length) {
    const doc = docs[0];
    if (doc.data().status === "fechada") {
      await doc.ref.update({status:"aberta", atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});
    }
    return doc.id;
  }

  const ref = await db.collection(CONVERSAS_COLLECTION).add({
    usuarioId: usuarioAtual.uid,
    usuarioNome: usuarioAtual.displayName || usuarioAtual.email.split("@")[0],
    usuarioEmail: usuarioAtual.email,
    botNome,
    status:"aberta",
    atendimentoStatus:"aguardando",
    ultimaMensagem:"",
    criadoEm:firebase.firestore.FieldValue.serverTimestamp(),
    atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()
  });

  await ref.collection("mensagens").add({
    texto:`Olá! Você escolheu o ${botNome}. Pode me contar o que você precisa?`,
    autorId:"sistema",
    autorNome:"NodeBots",
    autorEmail:"",
    criadoEm:firebase.firestore.FieldValue.serverTimestamp()
  });

  return ref.id;
}

function renderizarListaConversas(snapshot) {
  const lista = document.getElementById("lista-conversas");
  const docs = [...snapshot.docs].sort((a,b) => timestampNumero(b.data().atualizadoEm) - timestampNumero(a.data().atualizadoEm));
  lista.innerHTML = "";

  if (!docs.length) {
    lista.innerHTML = `<div class="chat-empty">${souAdmin ? "Nenhuma conversa de cliente ainda." : "Nenhuma conversa ainda."}</div>`;
    return;
  }

  docs.forEach(doc => {
    const c = doc.data();
    const button = document.createElement("button");
    button.className = "conversation-item" + (doc.id === conversaAtualId ? " active" : "");
    button.dataset.id = doc.id;

    if (souAdmin) {
      const emAtendimento = c.atendimentoStatus === "em_atendimento";
      button.innerHTML = `<strong>${escaparTexto(c.usuarioNome || c.usuarioEmail || "Cliente")}</strong><span>${escaparTexto(c.usuarioEmail || "")}</span><span>${emAtendimento ? "🟡 Em atendimento" : "🟢 Aguardando atendimento"}</span>`;
    } else {
      button.innerHTML = `<strong>${escaparTexto(c.botNome || "Atendimento")}</strong><span>${escaparTexto(c.ultimaMensagem || (c.status === "fechada" ? "Conversa fechada" : "Abrir conversa"))}</span>`;
    }

    button.addEventListener("click", () => abrirConversa(doc.id, c.botNome, c));
    lista.appendChild(button);
  });
}

function ouvirConversas() {
  if (unsubscribeConversas) unsubscribeConversas();

  // IMPORTANTE: sem orderBy. Isso evita erro de índice composto no Firestore.
  let query = db.collection(CONVERSAS_COLLECTION);
  if (!souAdmin) query = query.where("usuarioId", "==", usuarioAtual.uid);

  unsubscribeConversas = query.onSnapshot(renderizarListaConversas, err => {
    console.error("[NodeBots] Erro ao listar conversas:", err);
    document.getElementById("lista-conversas").innerHTML = `<div class="chat-empty">Não foi possível carregar as conversas.</div>`;
  });
}

function garantirControlesAdmin() {
  if (!souAdmin || document.getElementById("admin-atendimento-controles")) return;
  const head = document.querySelector(".chat-head");
  if (!head) return;
  const box = document.createElement("div");
  box.id = "admin-atendimento-controles";
  box.style.cssText = "display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;";
  box.innerHTML = `<span id="admin-atendimento-status" class="chat-status">Selecione uma conversa</span><button id="btn-assumir-atendimento" class="btn btn-primary" type="button">Assumir atendimento</button><button id="btn-liberar-atendimento" class="btn" type="button" style="display:none">Liberar</button>`;
  head.appendChild(box);
  document.getElementById("btn-assumir-atendimento").addEventListener("click", assumirAtendimento);
  document.getElementById("btn-liberar-atendimento").addEventListener("click", liberarAtendimento);
}

function atualizarControlesAdmin() {
  if (!souAdmin) return;
  garantirControlesAdmin();
  const status = document.getElementById("admin-atendimento-status");
  const assumir = document.getElementById("btn-assumir-atendimento");
  const liberar = document.getElementById("btn-liberar-atendimento");
  if (!conversaAtualDados) { status.textContent="Selecione uma conversa"; assumir.disabled=true; liberar.style.display="none"; return; }

  const ocupado = conversaAtualDados.atendimentoStatus === "em_atendimento";
  const meuAtendimento = ocupado && conversaAtualDados.atendidoPorId === usuarioAtual.uid;
  status.textContent = ocupado ? (meuAtendimento ? "🟢 Você está atendendo" : `🟡 ${conversaAtualDados.atendidoPorNome || "Outro administrador"} está atendendo`) : "Não assumida";
  assumir.disabled = ocupado;
  assumir.style.display = meuAtendimento ? "none" : "inline-block";
  liberar.style.display = meuAtendimento ? "inline-block" : "none";
}

async function assumirAtendimento() {
  if (!souAdmin || !conversaAtualId) return;
  const ref = db.collection(CONVERSAS_COLLECTION).doc(conversaAtualId);
  try {
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("Conversa não encontrada.");
      const c = snap.data();
      if (c.atendimentoStatus === "em_atendimento" && c.atendidoPorId !== usuarioAtual.uid) throw new Error("Esta conversa já está sendo atendida por outro administrador.");
      tx.update(ref, {
        atendimentoStatus:"em_atendimento",
        atendidoPorId:usuarioAtual.uid,
        atendidoPorEmail:usuarioAtual.email,
        atendidoPorNome:usuarioAtual.displayName || usuarioAtual.email.split("@")[0],
        atendidoEm:firebase.firestore.FieldValue.serverTimestamp(),
        atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()
      });
    });
  } catch (err) { console.error(err); alert(err.message || "Não foi possível assumir o atendimento."); }
}

async function liberarAtendimento() {
  if (!souAdmin || !conversaAtualId) return;
  if (conversaAtualDados?.atendidoPorId !== usuarioAtual.uid) return;
  try {
    await db.collection(CONVERSAS_COLLECTION).doc(conversaAtualId).update({
      atendimentoStatus:"aguardando",
      atendidoPorId:firebase.firestore.FieldValue.delete(),
      atendidoPorEmail:firebase.firestore.FieldValue.delete(),
      atendidoPorNome:firebase.firestore.FieldValue.delete(),
      atendidoEm:firebase.firestore.FieldValue.delete(),
      atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) { console.error(err); alert("Não foi possível liberar o atendimento."); }
}

async function abrirConversa(id, botNome, dados={}) {
  const permitida = await obterConversaPermitida(id);
  if (!permitida) {
    if (!souAdmin) alert("Esta conversa não pertence à conta atual.");
    return;
  }
  dados = permitida.dados;
  conversaAtualId = id;
  conversaAtualDados = dados;

  document.getElementById("chat-titulo").textContent = souAdmin ? `${dados.usuarioNome || "Cliente"} — ${botNome || "Atendimento"}` : (botNome || "Atendimento privado");
  document.getElementById("chat-status").textContent = dados.status === "fechada" ? "Fechada" : "Online";
  document.getElementById("input-mensagem").disabled = false;
  document.querySelectorAll(".conversation-item").forEach(el => el.classList.toggle("active", el.dataset.id === id));
  atualizarControlesAdmin();

  if (unsubscribeMensagens) unsubscribeMensagens();
  document.getElementById("mensagens").innerHTML = `<div class="chat-empty">Carregando mensagens…</div>`;

  // Sem orderBy para evitar dependência de índice; ordenamos no cliente.
  unsubscribeMensagens = db.collection(CONVERSAS_COLLECTION).doc(id).collection("mensagens")
    .onSnapshot(snapshot => {
      const area = document.getElementById("mensagens");
      const docs = [...snapshot.docs].sort((a,b) => timestampNumero(a.data().criadoEm) - timestampNumero(b.data().criadoEm));
      area.innerHTML = "";
      docs.forEach(doc => {
        const m = doc.data();
        const mine = m.autorId === usuarioAtual.uid;
        const div = document.createElement("div");
        div.className = "message" + (mine ? " mine" : "");
        div.innerHTML = `<div class="message-author">${escaparTexto(m.autorNome || "Usuário")}</div><div class="message-text">${escaparTexto(m.texto)}</div><div class="message-time">${formatarHora(m.criadoEm)}</div>`;
        area.appendChild(div);
      });
      area.scrollTop = area.scrollHeight;
    }, err => {
      console.error("[NodeBots] Erro nas mensagens:", err);
      document.getElementById("mensagens").innerHTML = `<div class="chat-empty">Não foi possível carregar as mensagens.</div>`;
    });
}

async function registrarNotificacaoAdmin(texto, conversa) {
  if (souAdmin) return;
  try {
    await db.collection("notificacoes_admin").add({
      conversaId:conversaAtualId,
      clienteId:usuarioAtual.uid,
      clienteEmail:usuarioAtual.email,
      clienteNome:usuarioAtual.displayName || usuarioAtual.email.split("@")[0],
      botNome:conversa?.botNome || "",
      mensagem:texto,
      criadoEm:firebase.firestore.FieldValue.serverTimestamp(),
      lida:false
    });
  } catch (err) {
    console.warn("[NodeBots] Notificação administrativa não registrada:", err);
  }
}

async function enviarMensagem(e) {
  e.preventDefault();
  if (!usuarioAtual || !conversaAtualId) return;
  if (!souAdmin && typeof termosAceitos !== "undefined" && !termosAceitos) return;

  const permitida = await obterConversaPermitida(conversaAtualId);
  if (!permitida) return;

  const input = document.getElementById("input-mensagem");
  const texto = input.value.trim();
  if (!texto) return;
  input.value = "";

  try {
    const ref = db.collection(CONVERSAS_COLLECTION).doc(conversaAtualId);
    await ref.collection("mensagens").add({
      texto,
      autorId:usuarioAtual.uid,
      autorNome:souAdmin ? (usuarioAtual.displayName || "Administrador") : (usuarioAtual.displayName || usuarioAtual.email.split("@")[0]),
      autorEmail:usuarioAtual.email,
      criadoEm:firebase.firestore.FieldValue.serverTimestamp()
    });
    await ref.update({ultimaMensagem:texto.slice(0,120), atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});
    if (!souAdmin) await registrarNotificacaoAdmin(texto, permitida.dados);
  } catch (err) {
    console.error("[NodeBots] Erro ao enviar mensagem:", err);
    input.value = texto;
    alert("Não foi possível enviar a mensagem.");
  }
}

async function iniciar() {
  usuarioAtual = await authReady;
  if (!usuarioAtual) {
    const bot = new URLSearchParams(location.search).get(BOT_PARAM) || "";
    location.href = bot ? `login.html?redirect=chat&bot=${encodeURIComponent(bot)}` : "login.html";
    return;
  }

  souAdmin = await verificarAdmin(usuarioAtual);

  if (!souAdmin) {
    if (typeof window.aguardarTermosAceitos === "function") await window.aguardarTermosAceitos();
    if (typeof termosAceitos !== "undefined" && !termosAceitos) return;
  }

  document.getElementById("status-admin").style.display = souAdmin ? "inline-block" : "none";
  document.getElementById("chat-tipo").textContent = souAdmin ? "CENTRAL DO ADMINISTRADOR" : "ATENDIMENTO PRIVADO";
  document.getElementById("form-mensagem").addEventListener("submit", enviarMensagem);
  document.getElementById("btn-sair-chat").addEventListener("click", fazerLogout);
  if (souAdmin) { garantirControlesAdmin(); document.getElementById("chat-titulo").textContent="Todas as conversas"; }

  ouvirConversas();

  const params = new URLSearchParams(location.search);
  const bot = params.get(BOT_PARAM);
  const idUrl = params.get(CONVERSA_PARAM);

  if (!souAdmin && bot) {
    const id = await criarOuAbrirConversa(bot);
    history.replaceState({}, "", `chat.html?bot=${encodeURIComponent(bot)}&conversa=${encodeURIComponent(id)}`);
    const doc = await db.collection(CONVERSAS_COLLECTION).doc(id).get();
    if (doc.exists) await abrirConversa(id, bot, doc.data());
    return;
  }

  if (idUrl) {
    const permitida = await obterConversaPermitida(idUrl);
    if (permitida) await abrirConversa(permitida.id, permitida.dados.botNome, permitida.dados);
    else history.replaceState({}, "", bot ? `chat.html?bot=${encodeURIComponent(bot)}` : "chat.html");
    return;
  }

  if (!souAdmin) {
    // Sem orderBy: não precisa de índice composto.
    const snap = await db.collection(CONVERSAS_COLLECTION).where("usuarioId", "==", usuarioAtual.uid).get();
    const docs = [...snap.docs].sort((a,b) => timestampNumero(b.data().atualizadoEm) - timestampNumero(a.data().atualizadoEm));
    if (docs.length) await abrirConversa(docs[0].id, docs[0].data().botNome, docs[0].data());
    else document.getElementById("chat-titulo").textContent = "Escolha um bot na página inicial";
  }
}

iniciar().catch(err => {
  console.error("[NodeBots] Erro ao iniciar:", err);
  document.getElementById("lista-conversas").innerHTML = `<div class="chat-empty">Não foi possível carregar as conversas.</div>`;
});
