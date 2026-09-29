// =========================================================================
// login.js — controla a página de login/cadastro
// =========================================================================

const provedorGoogle = new firebase.auth.GoogleAuthProvider();

// Redireciona preservando o destino que levou o usuário ao login.
async function redirecionarDepoisLogin() {
  if (typeof window.aguardarTermosAceitos === "function") {
    await window.aguardarTermosAceitos();
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("redirect") === "chat") {
    const bot = params.get("bot");
    window.location.href = bot ? "chat.html?bot=" + encodeURIComponent(bot) : "chat.html";
  } else {
    window.location.href = "perfil.html";
  }
}

// Se o usuário já estiver logado, manda para o destino solicitado.
auth.onAuthStateChanged((user) => {
  if (user) redirecionarDepoisLogin();
});

// ------- Troca de abas (Entrar / Criar conta) -------
const abas = document.querySelectorAll(".auth-tab");
const painelLogin = document.getElementById("painel-login");
const painelCadastro = document.getElementById("painel-cadastro");

abas.forEach((aba) => {
  aba.addEventListener("click", () => {
    abas.forEach((a) => a.classList.remove("active"));
    aba.classList.add("active");
    esconderErro();

    if (aba.dataset.tab === "login") {
      painelLogin.style.display = "block";
      painelCadastro.style.display = "none";
    } else {
      painelLogin.style.display = "none";
      painelCadastro.style.display = "block";
    }
  });
});

function mostrarErro(msg) {
  const el = document.getElementById("auth-erro");
  el.textContent = msg;
  el.classList.remove("sucesso");
  el.classList.add("mostrar");
}

function mostrarSucesso(msg) {
  const el = document.getElementById("auth-erro");
  el.textContent = msg;
  el.classList.add("sucesso", "mostrar");
}

function esconderErro() {
  const el = document.getElementById("auth-erro");
  el.classList.remove("mostrar", "sucesso");
}

// Traduz os erros mais comuns do Firebase para o português
function traduzirErro(codigo) {
  const mapa = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-not-found": "Não existe conta com esse e-mail.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Já existe uma conta com esse e-mail.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde e tente novamente.",
    "auth/user-disabled": "Esta conta foi desativada.",
    "auth/operation-not-allowed": "Este método de login ainda não está habilitado.",
    "auth/popup-closed-by-user": "Janela do Google fechada antes de concluir.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
    "auth/missing-email": "Informe seu e-mail para recuperar a senha.",
    "auth/expired-action-code": "Este pedido de recuperação expirou. Solicite outro."
  };
  return mapa[codigo] || "Ocorreu um erro. Tente novamente.";
}

// ------- Login com Google -------
function loginComGoogle() {
  esconderErro();
  authPersistenceReady
    .then(() => auth.signInWithPopup(provedorGoogle))
    .then(() => redirecionarDepoisLogin())
    .catch((err) => mostrarErro(traduzirErro(err.code)));
}

document.getElementById("btn-google-login").addEventListener("click", loginComGoogle);
document.getElementById("btn-google-cadastro").addEventListener("click", loginComGoogle);

document.getElementById("btn-esqueci-senha").addEventListener("click", () => {
  esconderErro();
  const email = document.getElementById("login-email").value.trim();
  if (!email) {
    mostrarErro("Informe seu e-mail para recuperar a senha.");
    document.getElementById("login-email").focus();
    return;
  }

  auth.sendPasswordResetEmail(email)
    .then(() => mostrarSucesso("Enviamos um link de recuperação para seu e-mail."))
    .catch((err) => mostrarErro(traduzirErro(err.code)));
});

// ------- Login com e-mail e senha -------
document.getElementById("form-login").addEventListener("submit", (e) => {
  e.preventDefault();
  esconderErro();

  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-senha").value;
  const lembrar = document.getElementById("login-lembrar").checked;

  const persistencia = lembrar
    ? firebase.auth.Auth.Persistence.LOCAL
    : firebase.auth.Auth.Persistence.SESSION;

  auth.setPersistence(persistencia)
    .then(() => auth.signInWithEmailAndPassword(email, senha))
    .then(() => redirecionarDepoisLogin())
    .catch((err) => mostrarErro(traduzirErro(err.code)));
});

// ------- Criar conta com e-mail e senha -------
document.getElementById("form-cadastro").addEventListener("submit", (e) => {
  e.preventDefault();
  esconderErro();

  const nome = document.getElementById("cadastro-nome").value.trim();
  const email = document.getElementById("cadastro-email").value.trim();
  const senha = document.getElementById("cadastro-senha").value;

  auth.createUserWithEmailAndPassword(email, senha)
    .then((cred) => cred.user.updateProfile({ displayName: nome }))
    .then(() => salvarPerfilUsuario(auth.currentUser))
    .then(() => redirecionarDepoisLogin())
    .catch((err) => mostrarErro(traduzirErro(err.code)));
});
