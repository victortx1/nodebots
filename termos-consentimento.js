// ================================================================
// GATE DE TERMOS — NodeBots
// O usuário precisa aceitar os termos uma única vez por versão.
// O aceite é salvo no Firestore quando há uma conta e também no
// navegador para permitir aceitar os termos antes do login.
// ================================================================

const VERSAO_TERMOS = "2026-09-07-v1";
const STORAGE_KEY = "nodebots_termos_aceitos";
let termosAceitos = false;
let termosProntoResolve;
const termosPronto = new Promise(resolve => { termosProntoResolve = resolve; });

function estaNaPaginaDeTermos() {
  return /(^|\/)termos\.html$/i.test(window.location.pathname);
}

function temAceiteLocal() {
  try {
    const dados = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return dados?.aceito === true && dados?.versao === VERSAO_TERMOS;
  } catch (_) {
    return false;
  }
}

function salvarAceiteLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    aceito: true,
    versao: VERSAO_TERMOS,
    aceitoEm: new Date().toISOString()
  }));
}

async function salvarAceiteNoBanco(user) {
  if (!user) return;
  await db.collection("usuarios").doc(user.uid).set({
    termosAceitos: true,
    termosVersao: VERSAO_TERMOS,
    termosAceitosEm: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function verificarAceiteNoBanco(user) {
  if (!user) return false;
  const snap = await db.collection("usuarios").doc(user.uid).get();
  const dados = snap.exists ? snap.data() : {};
  return dados.termosAceitos === true && dados.termosVersao === VERSAO_TERMOS;
}

function bloquearPagina() {
  document.documentElement.classList.add("termos-bloqueado");
  document.body.classList.add("termos-bloqueado");
}

function liberarPagina() {
  termosAceitos = true;
  document.documentElement.classList.remove("termos-bloqueado");
  document.body.classList.remove("termos-bloqueado");
  const modal = document.getElementById("modal-termos");
  if (modal) modal.remove();
  termosProntoResolve(true);
  window.dispatchEvent(new CustomEvent("nodebots:termos-aceitos"));
}

function mostrarAvisoTermos() {
  if (document.getElementById("modal-termos") || estaNaPaginaDeTermos()) return;

  bloquearPagina();

  const modal = document.createElement("div");
  modal.id = "modal-termos";
  modal.innerHTML = `
    <div class="termos-overlay">
      <div class="termos-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-termos">
        <div class="termos-icone">⚠️</div>
        <h2 id="titulo-termos">Leia os termos antes de continuar</h2>
        <p>Para entrar no site, comprar, acessar o chat ou entrar no Discord, você precisa aceitar uma vez os Termos de Compra, Uso, Privacidade e Segurança.</p>
        <a href="termos.html" target="_blank" rel="noopener" class="termos-link">📄 Ler os termos completos</a>
        <label class="termos-checkbox">
          <input type="checkbox" id="checkbox-termos">
          <span>Li e concordo com os Termos de Compra, Uso, Privacidade e Segurança.</span>
        </label>
        <p id="erro-termos" class="erro-termos"></p>
        <button id="btn-aceitar-termos" class="btn-aceitar-termos" type="button">Aceitar e continuar</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  document.getElementById("btn-aceitar-termos").addEventListener("click", aceitarTermos);
}

async function aceitarTermos() {
  const checkbox = document.getElementById("checkbox-termos");
  const erro = document.getElementById("erro-termos");
  const botao = document.getElementById("btn-aceitar-termos");

  if (!checkbox?.checked) {
    erro.textContent = "Marque a caixa para aceitar os termos.";
    return;
  }

  botao.disabled = true;
  botao.textContent = "Salvando aceite...";
  erro.textContent = "";

  try {
    const user = firebase.auth().currentUser;

    // Aceite local para liberar o site imediatamente, inclusive antes do login.
    salvarAceiteLocal();

    // Se já estiver logado, o aceite também precisa estar no Firestore.
    if (user) await salvarAceiteNoBanco(user);

    liberarPagina();
  } catch (erroFirebase) {
    console.error("Erro ao salvar aceite:", erroFirebase);
    // Não libera quando o usuário está logado e o banco recusou o registro.
    const user = firebase.auth().currentUser;
    if (user) {
      botao.disabled = false;
      botao.textContent = "Aceitar e continuar";
      erro.textContent = "Não foi possível registrar o aceite no banco. Verifique sua conexão e tente novamente.";
      return;
    }
    // Sem login, o aceite local continua válido; será sincronizado após o login.
    liberarPagina();
  }
}

async function inicializarTermos() {
  if (estaNaPaginaDeTermos()) {
    termosProntoResolve(true);
    return;
  }

  bloquearPagina();

  try {
    // Aguarda o Firebase restaurar a sessão antes de consultar o Firestore.
    const user = typeof authReady !== "undefined" ? await authReady : firebase.auth().currentUser;

    if (user) {
      const aceitoBanco = await verificarAceiteNoBanco(user);
      if (aceitoBanco) {
        salvarAceiteLocal();
        liberarPagina();
        return;
      }

      // Se aceitou antes de criar/logar na conta, sincroniza o aceite local.
      if (temAceiteLocal()) {
        await salvarAceiteNoBanco(user);
        liberarPagina();
        return;
      }
    } else if (temAceiteLocal()) {
      liberarPagina();
      return;
    }

    mostrarAvisoTermos();
  } catch (erro) {
    console.error("Erro ao verificar termos:", erro);
    // Se o navegador já possui um aceite válido, não fica preso por uma falha momentânea.
    if (temAceiteLocal()) {
      liberarPagina();
    } else {
      mostrarAvisoTermos();
    }
  }
}

// Aguarde este Promise em qualquer página protegida antes de iniciar funções importantes.
window.aguardarTermosAceitos = () => termosPronto;

// Sincroniza o aceite local assim que o usuário fizer login.
if (typeof auth !== "undefined") {
  auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    try {
      if (temAceiteLocal()) await salvarAceiteNoBanco(user);
    } catch (erro) {
      console.warn("Não foi possível sincronizar o aceite dos termos:", erro);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarTermos, { once: true });
} else {
  inicializarTermos();
}
