
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


// CONFIGURACIÓN DE FIREBASE
// Sustituye estos valores por los de tu proyecto.

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROYECTO.firebasestorage.app",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};


// INICIALIZACIÓN

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

let currentUser = null;
let activeEntryId = null;
let entries = [];
let saveTimer = null;


// REFERENCIA A LAS ENTRADAS DEL USUARIO

function entriesRef() {
  return collection(
    db,
    "users",
    currentUser.uid,
    "entries"
  );
}


// FORMATO DE FECHA

function formatDate(value) {
  const date = value?.toDate
    ? value.toDate()
    : value
      ? new Date(value)
      : new Date();

  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}


// MENSAJES DE ACCESO

function showMessage(message) {
  $("authMessage").textContent = message;
}


// ABRIR DIARIO

function openDiary(user) {
  currentUser = user;

  $("lockScreen").classList.add("hidden");
  $("diaryScreen").classList.remove("hidden");

  $("userLabel").textContent = user.email || "";

  loadEntries();
}


// CERRAR DIARIO

function closeDiary() {
  $("diaryScreen").classList.add("hidden");
  $("lockScreen").classList.remove("hidden");

  $("password").value = "";

  currentUser = null;
  activeEntryId = null;
  entries = [];
}


// CARGAR ENTRADAS

async function loadEntries() {
  $("entryList").innerHTML =
    '<p class="empty-list">Cargando tus páginas...</p>';

  try {
    const snapshot = await getDocs(
      query(entriesRef(), orderBy("updatedAt", "desc"))
    );

    entries = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    renderEntryList();

    if (entries.length > 0) {
      selectEntry(entries[0].id);
    } else {
      createBlankPage();
    }

  } catch (error) {
    console.error(error);

    $("entryList").innerHTML =
      '<p class="empty-list">No se pudieron cargar tus páginas.</p>';
  }
}


// MOSTRAR HISTORIAL

function renderEntryList() {
  const list = $("entryList");

  if (!entries.length) {
    list.innerHTML =
      '<p class="empty-list">Aún no tienes páginas.</p>';
    return;
  }

  list.innerHTML = "";

  entries.forEach(entry => {
    const button = document.createElement("button");

    button.className =
      "entry-item" +
      (entry.id === activeEntryId ? " active" : "");

    const title = document.createElement("strong");
    title.textContent = entry.title?.trim() || "Sin título";

    const date = document.createElement("small");
    date.textContent = formatDate(
      entry.updatedAt || entry.createdAt
    );

    button.append(title, date);

    button.addEventListener("click", async () => {
      clearTimeout(saveTimer);
      await saveEntry();
      selectEntry(entry.id);
    });

    list.append(button);
  });
}


// ABRIR UNA PÁGINA

function selectEntry(id) {
  const entry = entries.find(item => item.id === id);

  if (!entry) return;

  activeEntryId = id;

  $("entryTitle").value = entry.title || "";
  $("entryBody").value = entry.body || "";

  $("entryDate").textContent = formatDate(
    entry.createdAt || entry.updatedAt
  );

  $("saveStatus").textContent = "Guardado";

  $("deleteButton").classList.remove("hidden");

  renderEntryList();
}


// CREAR PÁGINA NUEVA

function createBlankPage() {
  activeEntryId = null;

  $("entryTitle").value = "";
  $("entryBody").value = "";

  $("entryDate").textContent = formatDate(new Date());

  $("saveStatus").textContent = "Nueva página";

  $("deleteButton").classList.add("hidden");

  renderEntryList();

  $("entryTitle").focus();
}


// GUARDAR ENTRADA

async function saveEntry() {
  if (!currentUser) return;

  const title = $("entryTitle").value;
  const body = $("entryBody").value;

  if (!title.trim() && !body.trim()) {
    $("saveStatus").textContent = "Nueva página";
    return;
  }

  $("saveStatus").textContent = "Guardando...";

  try {
    const now = serverTimestamp();

    if (activeEntryId) {

      await updateDoc(
        doc(
          db,
          "users",
          currentUser.uid,
          "entries",
          activeEntryId
        ),
        {
          title,
          body,
          updatedAt: now
        }
      );

    } else {

      const ref = await addDoc(entriesRef(), {
        title,
        body,
        createdAt: now,
        updatedAt: now
      });

      activeEntryId = ref.id;
    }

    const snapshot = await getDocs(
      query(entriesRef(), orderBy("updatedAt", "desc"))
    );

    entries = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    $("saveStatus").textContent = "Guardado";

    $("deleteButton").classList.remove("hidden");

    renderEntryList();

  } catch (error) {
    console.error(error);

    $("saveStatus").textContent =
      "No se pudo guardar";
  }
}


// GUARDADO AUTOMÁTICO

function scheduleSave() {
  $("saveStatus").textContent = "Cambios pendientes...";

  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    saveEntry();
  }, 900);
}


// INICIAR SESIÓN

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  try {
    showMessage("Abriendo diario...");

    await signInWithEmailAndPassword(
      auth,
      $("email").value.trim(),
      $("password").value
    );

    showMessage("");

  } catch (error) {
    console.error(error);

    showMessage(
      "No se pudo entrar. Revisa tu correo y contraseña."
    );
  }
});


// NUEVA PÁGINA

$("newEntryButton").addEventListener("click", async () => {
  clearTimeout(saveTimer);

  await saveEntry();

  createBlankPage();
});


// ESCUCHAR CAMBIOS DE TEXTO

$("entryTitle").addEventListener("input", scheduleSave);

$("entryBody").addEventListener("input", scheduleSave);


// ELIMINAR PÁGINA

$("deleteButton").addEventListener("click", async () => {
  if (!activeEntryId) return;

  const confirmed = confirm(
    "¿Quieres eliminar esta página? Esta acción no se puede deshacer."
  );

  if (!confirmed) return;

  clearTimeout(saveTimer);

  await deleteDoc(
    doc(
      db,
      "users",
      currentUser.uid,
      "entries",
      activeEntryId
    )
  );

  entries = entries.filter(
    item => item.id !== activeEntryId
  );

  activeEntryId = null;

  renderEntryList();

  if (entries.length) {
    selectEntry(entries[0].id);
  } else {
    createBlankPage();
  }
});


// CERRAR SESIÓN

$("logoutButton").addEventListener("click", async () => {
  clearTimeout(saveTimer);

  await saveEntry();

  await signOut(auth);
});


// COMPROBAR SESIÓN

onAuthStateChanged(auth, user => {
  if (user) {
    openDiary(user);
  } else {
    closeDiary();
  }
});
