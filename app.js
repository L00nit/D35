import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

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
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

// FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDJDno2lw59Tj5oLfpPPIKw_2hoLQ_-Xm8",
  authDomain: "d35y-b5dde.firebaseapp.com",
  projectId: "d35y-b5dde",
  storageBucket: "d35y-b5dde.firebasestorage.app",
  messagingSenderId: "439194252926",
  appId: "1:439194252926:web:daba55647c35d253b00a2f",
  measurementId: "G-5SFCEREQ90"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// CONFIGURACIÓN
const PIN = "2012";

let currentUser = null;
let entries = [];
let currentEntryId = null;
let saveTimer = null;
let isSaving = false;

// ELEMENTOS
const lockScreen = document.getElementById("lockScreen");
const diaryScreen = document.getElementById("diaryScreen");
const pinForm = document.getElementById("pinForm");
const pinInput = document.getElementById("pinInput");
const pinMessage = document.getElementById("pinMessage");

const newPageButton = document.getElementById("newPage");
const entriesList = document.getElementById("entriesList");
const entryTitle = document.getElementById("entryTitle");
const entryContent = document.getElementById("entryContent");
const saveStatus = document.getElementById("saveStatus");
const deleteButton = document.getElementById("deletePage");
const lockButton = document.getElementById("lockButton");

// INICIAR FIREBASE
async function initializeDiary() {
  try {
    const result = await signInAnonymously(auth);
    currentUser = result.user;
  } catch (error) {
    console.error(error);
    pinMessage.textContent = "No se pudo conectar con Firebase.";
  }
}

await initializeDiary();

// RUTA DE LAS PÁGINAS DEL USUARIO
function entriesCollection() {
  return collection(db, "users", currentUser.uid, "entries");
}

// ABRIR DIARIO
pinForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (pinInput.value !== PIN) {
    pinMessage.textContent = "Código incorrecto.";
    pinInput.value = "";
    return;
  }

  if (!currentUser) {
    pinMessage.textContent = "Espera un momento e inténtalo otra vez.";
    return;
  }

  pinMessage.textContent = "";

  try {
    await loadEntries();
    lockScreen.classList.add("hidden");
    diaryScreen.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    pinMessage.textContent = "No se pudieron cargar tus páginas.";
  }

  pinInput.value = "";
});

// CERRAR VISUALMENTE EL DIARIO
lockButton.addEventListener("click", async () => {
  await saveCurrentEntry();

  diaryScreen.classList.add("hidden");
  lockScreen.classList.remove("hidden");

  pinInput.value = "";
  pinMessage.textContent = "";
});

// CARGAR PÁGINAS
async function loadEntries() {
  const entriesQuery = query(
    entriesCollection(),
    orderBy("updatedAt", "desc")
  );

  const snapshot = await getDocs(entriesQuery);

  entries = snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data()
  }));

  renderEntries();

  if (entries.length > 0) {
    selectEntry(entries[0].id);
  } else {
    clearEditor();
  }
}

// MOSTRAR LISTA
function renderEntries() {
  entriesList.innerHTML = "";

  if (entries.length === 0) {
    entriesList.innerHTML =
      '<p class="empty-list">Todavía no hay páginas.</p>';
    return;
  }

  entries.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "entry-item";

    if (entry.id === currentEntryId) {
      button.classList.add("active");
    }

    const title = document.createElement("strong");
    title.textContent = entry.title || "Página sin título";

    const date = document.createElement("small");
    date.textContent = formatDate(entry.updatedAt);

    button.append(title, date);

    button.addEventListener("click", async () => {
      await saveCurrentEntry();
      selectEntry(entry.id);
    });

    entriesList.appendChild(button);
  });
}

// FORMATEAR FECHA
function formatDate(value) {
  if (!value) return "Nueva página";

  const date = value.toDate
    ? value.toDate()
    : new Date(value);

  return date.toLocaleDateString("es-DO", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

// SELECCIONAR PÁGINA
function selectEntry(id) {
  const entry = entries.find((item) => item.id === id);

  if (!entry) return;

  currentEntryId = id;
  entryTitle.value = entry.title || "";
  entryContent.value = entry.content || "";

  entryTitle.disabled = false;
  entryContent.disabled = false;
  deleteButton.disabled = false;

  saveStatus.textContent = "Página guardada.";
  renderEntries();
}

// LIMPIAR EDITOR
function clearEditor() {
  currentEntryId = null;

  entryTitle.value = "";
  entryContent.value = "";

  entryTitle.disabled = true;
  entryContent.disabled = true;
  deleteButton.disabled = true;

  saveStatus.textContent = "Crea una página para comenzar.";
  renderEntries();
}

// CREAR PÁGINA
newPageButton.addEventListener("click", async () => {
  await saveCurrentEntry();

  try {
    saveStatus.textContent = "Creando página...";

    const newEntry = await addDoc(entriesCollection(), {
      title: "",
      content: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    entries.unshift({
      id: newEntry.id,
      title: "",
      content: "",
      updatedAt: new Date()
    });

    selectEntry(newEntry.id);
    entryTitle.focus();
  } catch (error) {
    console.error(error);
    saveStatus.textContent = "No se pudo crear la página.";
  }
});

// GUARDADO AUTOMÁTICO
entryTitle.addEventListener("input", scheduleSave);
entryContent.addEventListener("input", scheduleSave);

function scheduleSave() {
  saveStatus.textContent = "Guardando...";

  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    saveCurrentEntry();
  }, 800);
}

// GUARDAR PÁGINA ACTUAL
async function saveCurrentEntry() {
  clearTimeout(saveTimer);

  if (!currentEntryId || !currentUser) return;

  const id = currentEntryId;
  const title = entryTitle.value;
  const content = entryContent.value;

  isSaving = true;

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
      entry.updatedAt = new Date();
    }

    entries.sort((a, b) => {
      const dateA = a.updatedAt?.toMillis
        ? a.updatedAt.toMillis()
        : new Date(a.updatedAt || 0).getTime();

      const dateB = b.updatedAt?.toMillis
        ? b.updatedAt.toMillis()
        : new Date(b.updatedAt || 0).getTime();

      return dateB - dateA;
    });

    saveStatus.textContent = "Guardado.";
    renderEntries();
  } catch (error) {
    console.error(error);
    saveStatus.textContent = "Error al guardar. Revisa tu conexión.";
  } finally {
    isSaving = false;
  }
}

// ELIMINAR PÁGINA
deleteButton.addEventListener("click", async () => {
  if (!currentEntryId) return;

  const confirmed = confirm(
    "¿Seguro que quieres eliminar esta página? Esta acción no se puede deshacer."
  );

  if (!confirmed) return;

  clearTimeout(saveTimer);

  try {
    const id = currentEntryId;

    await deleteDoc(
      doc(db, "users", currentUser.uid, "entries", id)
    );

    entries = entries.filter((entry) => entry.id !== id);
    currentEntryId = null;

    renderEntries();

    if (entries.length > 0) {
      selectEntry(entries[0].id);
    } else {
      clearEditor();
    }
  } catch (error) {
    console.error(error);
    saveStatus.textContent = "No se pudo eliminar la página.";
  }
});
