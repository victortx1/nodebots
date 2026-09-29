// =========================================================================
// auth.js — controla o estado de login em todas as páginas do site
// =========================================================================

// Cria (ou atualiza) o documento do usuário no Firestore
async function salvarPerfilUsuario(user) {
  try {
    await db.collection("usuarios").doc(user.uid).set(
      {
        nome: user.displayName || "Usuário",
        email: user.email,
        foto: user.photoURL || "",
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Erro ao salvar perfil:", err);
  }
}

// Atualiza os elementos do cabeçalho (nome, foto, botões) conforme o login
function atualizarUIAuth(user) {
  const loginBtn = document.getElementById("login-nav-btn");
  const perfilBox = document.getElementById("perfil-box");
  const perfilFoto = document.getElementById("perfil-foto");
  const perfilNome = document.getElementById("perfil-nome");

  if (!loginBtn || !perfilBox) return;

  if (user) {
    loginBtn.style.display = "none";
    perfilBox.style.display = "flex";
    if (perfilNome) perfilNome.textContent = user.displayName || user.email.split("@")[0];
    if (perfilFoto) {
      perfilFoto.src = user.photoURL || "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(user.displayName || user.email);
    }
  } else {
    loginBtn.style.display = "";
    perfilBox.style.display = "none";
  }
}

// Observa mudanças no login em qualquer página que incluir este script
if (typeof auth !== "undefined") {
  auth.onAuthStateChanged((user) => {
    atualizarUIAuth(user);
    if (user) salvarPerfilUsuario(user);
  });
}

// Logout — usado pelo botão no menu de perfil
function fazerLogout() {
  auth.signOut()
    .then(() => { window.location.href = "index.html"; })
    .catch((err) => console.error("Erro ao sair:", err));
}

// Alterna o menu dropdown do perfil
document.addEventListener("click", (e) => {
  const perfilBox = document.getElementById("perfil-box");
  const dropdown = document.getElementById("perfil-dropdown");
  if (!perfilBox || !dropdown) return;

  if (perfilBox.contains(e.target)) {
    dropdown.classList.toggle("aberto");
  } else {
    dropdown.classList.remove("aberto");
  }
});
