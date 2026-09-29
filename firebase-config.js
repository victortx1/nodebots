const firebaseConfig = window.NODEBOTS_FIREBASE_CONFIG || {
  apiKey: "AIzaSyAcmH-ok2oSbGRbEQEzXgfnpVO55nTjozk",
  authDomain: "nodebots-a3e13.firebaseapp.com",
  projectId: "nodebots-a3e13",
  storageBucket: "nodebots-a3e13.firebasestorage.app",
  messagingSenderId: "35267949935",
  appId: "1:35267949935:web:da0ba52978291741fe649a"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const authReady = new Promise((resolve) => {
  let unsubscribe = () => {};
  unsubscribe = auth.onAuthStateChanged((user) => {
    unsubscribe();
    resolve(user);
  });
});

const authPersistenceReady = auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((err) => {
  console.warn("Não foi possível definir a persistência padrão da sessão:", err);
});
