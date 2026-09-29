const ADMINS_COLLECTION = "admins";
const CONVERSAS_COLLECTION = "conversas";

let adminAtual = null;
let conversaAtualId = null;
let conversaAtual = null;
let unsubscribeConversas = null;
let unsubscribeMensagens = null;

const $ = (id) => document.getElementById(id);

function escaparTexto(valor) {
  return String(valor || "").replace(/[&<>'"]/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])
  );
}

function formatarHora(ts) {
  if (!ts) return "agora";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("pt-BR", {
    day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"
  });
}

async function verificarAdmin(user) {
  if (!user) return false;

  // O administrador é definido pelo documento admins/<e-mail> no Firestore.
  // O e-mail do Firebase Auth é normalizado para evitar diferenças de maiúsculas/espaços.
  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return false;

  try {
    // Recarrega o usuário para garantir que estamos trabalhando com a sessão atual.
    try { await user.reload(); } catch (_) {}

    const atual = firebase.auth().currentUser;
    const emailAtual = String(atual?.email || user.email || "").trim().toLowerCase();
    const ids = [...new Set([email, emailAtual])].filter(Boolean);

    for (const id of ids) {
      const snap = await db.collection(ADMINS_COLLECTION).doc(id).get();
      if (snap.exists) {
        const dados = snap.data() || {};
        // Seu documento atual possui ativo:true e admins:true.
        if (dados.ativo === true && (dados.admins === true || dados.admins === undefined)) {
          return true;
        }
      }
    }

    console.error("[NodeBots] Gmail autenticado não está autorizado:", emailAtual);
    console.error("[NodeBots] O documento esperado é admins/" + emailAtual + " com ativo:true.");
    return false;
  } catch (err) {
    console.error("[NodeBots] Falha ao verificar admin:", err);
    return false;
  }
}

function statusConversa(c) {
  if (c.atendimentoStatus === "em_atendimento") return "busy";
  return c.status === "fechada" ? "" : "open";
}

function textoStatus(c) {
  if (c.atendimentoStatus === "em_atendimento") {
    return `Atendendo: ${c.atendidoPorNome || c.atendidoPorEmail || "Administrador"}`;
  }
  if (c.status === "fechada") return "Fechada";
  return "Aguardando atendimento";
}

function renderizarConversas(snapshot) {
  const lista = $("lista-conversas");
  $("contador").textContent = snapshot.size;
  lista.innerHTML = "";

  if (snapshot.empty) {
    lista.innerHTML = '<div class="empty">Nenhuma conversa encontrada.</div>';
    return;
  }

  snapshot.forEach(doc => {
    const c = doc.data();
    const button = document.createElement("button");
    button.className = "conversation-item" + (doc.id === conversaAtualId ? " active" : "");
    button.dataset.id = doc.id;

    button.innerHTML = `
      <strong>${escaparTexto(c.usuarioNome || "Cliente")}</strong>
      <span class="email">${escaparTexto(c.usuarioEmail || "")}</span>
      <span class="meta">
        <i class="dot-status ${statusConversa(c)}"></i>
        ${escaparTexto(textoStatus(c))}
      </span>
    `;

    button.addEventListener("click", () => abrirConversa(doc.id, c));
    lista.appendChild(button);
  });
}

function ouvirConversas() {
  if (unsubscribeConversas) unsubscribeConversas();

  unsubscribeConversas = db.collection(CONVERSAS_COLLECTION)
    .orderBy("atualizadoEm", "desc")
    .onSnapshot(renderizarConversas, err => {
      console.error("Erro ao carregar conversas:", err);
      $("lista-conversas").innerHTML =
        '<div class="empty">Não foi possível carregar as conversas.</div>';
    });
}

function atualizarBotoesAtendimento() {
  const assumida = conversaAtual?.atendimentoStatus === "em_atendimento";
  const souEu = assumida &&
    (conversaAtual.atendidoPorId === adminAtual.uid ||
     conversaAtual.atendidoPorEmail === adminAtual.email);

  $("btn-atender").disabled = !conversaAtualId || (assumida && !souEu);
  $("btn-liberar").disabled = !conversaAtualId || !souEu;
  $("btn-atender").textContent = assumida
    ? (souEu ? "Atendimento ativo" : "Já está em atendimento")
    : "Assumir atendimento";

  $("atendimento-status").textContent = assumida
    ? `Atendendo: ${conversaAtual.atendidoPorNome || conversaAtual.atendidoPorEmail || "Administrador"}`
    : "Não assumida";
}

async function abrirConversa(id, dados) {
  conversaAtualId = id;
  conversaAtual = dados;

  document.querySelectorAll(".conversation-item")
    .forEach(el => el.classList.toggle("active", el.dataset.id === id));

  $("cliente-nome").textContent = dados.usuarioNome || "Cliente";
  $("cliente-email").textContent = dados.usuarioEmail || "CLIENTE";
  $("bot-nome").textContent = dados.botNome ? `Bot: ${dados.botNome}` : "";

  $("input-mensagem").disabled = false;
  $("form-mensagem").querySelector("button").disabled = false;
  atualizarBotoesAtendimento();

  if (unsubscribeMensagens) unsubscribeMensagens();

  $("mensagens").innerHTML = '<div class="empty">Carregando mensagens…</div>';

  unsubscribeMensagens = db.collection(CONVERSAS_COLLECTION)
    .doc(id).collection("mensagens")
    .orderBy("criadoEm", "asc")
    .onSnapshot(snapshot => {
      const area = $("mensagens");
      area.innerHTML = "";

      snapshot.forEach(doc => {
        const m = doc.data();
        const mine = m.autorId === adminAtual.uid;
        const div = document.createElement("div");
        div.className = "message" + (mine ? " mine" : "");
        div.innerHTML = `
          <div class="message-author">${escaparTexto(m.autorNome || "Usuário")}</div>
          <div class="message-text">${escaparTexto(m.texto)}</div>
          <div class="message-time">${formatarHora(m.criadoEm)}</div>
        `;
        area.appendChild(div);
      });

      area.scrollTop = area.scrollHeight;
    }, err => {
      console.error(err);
      $("mensagens").innerHTML =
        '<div class="empty">Não foi possível carregar as mensagens.</div>';
    });
}

async function assumirAtendimento() {
  if (!conversaAtualId || !adminAtual) return;

  try {
    const ref = db.collection(CONVERSAS_COLLECTION).doc(conversaAtualId);
    const snap = await ref.get();
    if (!snap.exists) return;

    const atual = snap.data();
    if (atual.atendimentoStatus === "em_atendimento" &&
        atual.atendidoPorId !== adminAtual.uid &&
        atual.atendidoPorEmail !== adminAtual.email) {
      alert("Esta conversa já está sendo atendida por outro administrador.");
      return;
    }

    await ref.update({
      atendimentoStatus: "em_atendimento",
      atendidoPorId: adminAtual.uid,
      atendidoPorEmail: adminAtual.email,
      atendidoPorNome: adminAtual.displayName || adminAtual.email.split("@")[0],
      atendidoEm: firebase.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    conversaAtual = {
      ...atual,
      atendimentoStatus: "em_atendimento",
      atendidoPorId: adminAtual.uid,
      atendidoPorEmail: adminAtual.email,
      atendidoPorNome: adminAtual.displayName || adminAtual.email.split("@")[0]
    };
    atualizarBotoesAtendimento();
  } catch (err) {
    console.error(err);
    alert("Não foi possível assumir o atendimento.");
  }
}

async function liberarAtendimento() {
  if (!conversaAtualId || !adminAtual) return;

  try {
    await db.collection(CONVERSAS_COLLECTION).doc(conversaAtualId).update({
      atendimentoStatus: "aguardando",
      atendidoPorId: firebase.firestore.FieldValue.delete(),
      atendidoPorEmail: firebase.firestore.FieldValue.delete(),
      atendidoPorNome: firebase.firestore.FieldValue.delete(),
      atendidoEm: firebase.firestore.FieldValue.delete(),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    conversaAtual = {
      ...conversaAtual,
      atendimentoStatus: "aguardando",
      atendidoPorId: null,
      atendidoPorEmail: null,
      atendidoPorNome: null
    };
    atualizarBotoesAtendimento();
  } catch (err) {
    console.error(err);
    alert("Não foi possível liberar o atendimento.");
  }
}

async function enviarMensagem(e) {
  e.preventDefault();

  if (!conversaAtualId || !adminAtual) return;

  const input = $("input-mensagem");
  const texto = input.value.trim();
  if (!texto) return;

  input.value = "";

  try {
    const ref = db.collection(CONVERSAS_COLLECTION).doc(conversaAtualId);

    await ref.collection("mensagens").add({
      texto,
      autorId: adminAtual.uid,
      autorNome: adminAtual.displayName || "Administrador",
      autorEmail: adminAtual.email,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    await ref.update({
      ultimaMensagem: texto.slice(0, 120),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error(err);
    input.value = texto;
    alert("Não foi possível enviar a mensagem.");
  }
}

async function iniciar() {
  try {
    await authPersistenceReady.catch(() => {});

    const user = firebase.auth().currentUser || await new Promise((resolve) => {
      const unsub = firebase.auth().onAuthStateChanged((u) => {
        unsub();
        resolve(u);
      });
    });

    if (!user) {
      window.location.href = "login.html";
      return;
    }

    await user.reload().catch(() => {});
    const usuarioAtualFirebase = firebase.auth().currentUser || user;
    const autorizado = await verificarAdmin(usuarioAtualFirebase);

    if (!autorizado) {
      console.error("[NodeBots] ACESSO NEGADO. Gmail autenticado:", usuarioAtualFirebase.email);
      $("acesso-negado").hidden = false;
      return;
    }

    adminAtual = usuarioAtualFirebase;
    $("painel").hidden = false;

    $("btn-atender").addEventListener("click", assumirAtendimento);
    $("btn-liberar").addEventListener("click", liberarAtendimento);
    $("form-mensagem").addEventListener("submit", enviarMensagem);
    $("btn-sair").addEventListener("click", fazerLogout);

    ouvirConversas();
  } catch (err) {
    console.error(err);
    $("acesso-negado").hidden = false;
  }
}

iniciar();
