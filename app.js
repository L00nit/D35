
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* PEGA AQUÍ LOS DATOS DE TU PROYECTO FIREBASE */

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROYECTO.firebasestorage.app",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const PIN = "2012";

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentEntry = null;
let entries = [];
let saveTimer = null;

const lockScreen = $("lockScreen");
const diaryScreen = $("diaryScreen");
const pinInput = $("pinInput");
const pinMessage = $("pinMessage");
const titleInput = $("entryTitle");
const contentInput = $("entryContent");
const entriesList = $("entriesList");
const saveStatus = $("saveStatus");

/* DESBLOQUEAR */

$("pinForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (pinInput.value !== PIN) {
    pinMessage.textContent = "Código incorrecto. Inténtalo otra vez.";
    pinInput.value = "";
    return;
  }

  pinMessage.textContent = "Abriendo tu diario...";

  try {
    if (!auth.currentUser) {
      const credential = await signInAnonymously(auth);
      currentUser = credential.user;
    } else {
      currentUser = auth.currentUser;
    }

    await openDiary();
    pinInput.value = "";
    pinMessage.textContent = "";
  } catch (error) {
    console.error(error);
    pinMessage.textContent = "No se pudo conectar. Revisa Firebase.";
  }
});

/* ABRIR DIARIO */

async function openDiary() {
  lockScreen.classList.add("hidden");
  diaryScreen.classList.remove("hidden");

  await loadEntries();

  if (entries.length > 0) {
    selectEntry(entries[0].id);
  } else {
    await createEntry();
  }
}

/* CARGAR PÁGINAS */

function entriesCollection() {
  return collection(db, "users", currentUser.uid, "entries");
}

async function loadEntries() {
  const q = query(entriesCollection(), orderBy("updatedAt", "desc"));
  const snapshot = await getDocs(q);

  entries = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

  renderEntries();
}

/* MOSTRAR LISTA */

function renderEntries() {
  entriesList.innerHTML = "";

  entries.forEach((entry) => {
    const button = document.createElement("button");
    button.className = "entry-item";
    button.textContent = entry.title || "Página sin título";

    if (entry.id === currentEntry) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => selectEntry(entry.id));
    entriesList.appendChild(button);
  });
}

/* SELECCIONAR PÁGINA */

function selectEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  currentEntry = id;
  titleInput.value = entry.title || "";
  contentInput.value = entry.content || "";

  saveStatus.textContent = "Página guardada";
  renderEntries();
}

/* CREAR PÁGINA */

async function createEntry() {
  const newEntry = {
    title: "",
    content: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const result = await addDoc(entriesCollection(), newEntry);

  entries.unshift({
    id: result.id,
    title: "",
    content: ""
  });

  selectEntry(result.id);
  titleInput.focus();
}

/* GUARDAR AUTOMÁTICAMENTE */

function scheduleSave() {
  if (!currentEntry) return;

  saveStatus.textContent = "Guardando...";

  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveEntry, 700);
}

async function saveEntry() {
  if (!currentEntry || !currentUser) return;

  const id = currentEntry;
  const title = titleInput.value;
  const content = contentInput.value;

  try {
    await updateDoc(
      doc(db, "users", currentUser.uid, "entries", id),
      {
        title,
        content,
        updatedAt: serverTimestamp()
      }
    );

    const entry = entries.find((item) => item.id === id);

    if (entry) {
      entry.title = title;
      entry.content = content;
    }

    saveStatus.textContent = "Guardado";
    renderEntries();
  } catch (error) {
    console.error(error);
    saveStatus.textContent = "No se pudo guardar";
  }
}

titleInput.addEventListener("input", scheduleSave);
contentInput.addEventListener("input", scheduleSave);

/* NUEVA PÁGINA */

$("newPage").addEventListener("click", async () => {
  clearTimeout(saveTimer);
  await saveEntry();
  await createEntry();
});

/* ELIMINAR PÁGINA */

$("deletePage").addEventListener("click", async () => {
  if (!currentEntry) return;

  const confirmed = confirm("¿Quieres eliminar esta página?");
  if (!confirmed) return;

  clearTimeout(saveTimer);

  try {
    await deleteDoc(
      doc(db, "users", currentUser.uid, "entries", currentEntry)
    );

    entries = entries.filter((item) => item.id !== currentEntry);
    currentEntry = null;

    if (entries.length > 0) {
      selectEntry(entries[0].id);
    } else {
      await createEntry();
    }
  } catch (error) {
    console.error(error);
    alert("No se pudo eliminar la página.");
  }
});

/* CERRAR DIARIO */

$("closeDiary").addEventListener("click", async () => {
  clearTimeout(saveTimer);
  await saveEntry();

  diaryScreen.classList.add("hidden");
  lockScreen.classList.remove("hidden");
  pinInput.value = "";
});
