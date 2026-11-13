
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
  getDoc,
  setDoc,
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

// ESTADO
let currentUser = null;
let currentDiaryCode = null;
let entries = [];
let currentEntryId = null;
let saveTimer = null;

// ELEMENTOS
const lockScreen = document.getElementById("lockScreen");
const diaryScreen = document.getElementById("diaryScreen");

const accessOptions = document.getElementById("accessOptions");
const createDiaryButton = document.getElementById("createDiary");
const showJoinButton = document.getElementById("showJoin");
const joinForm = document.getElementById("joinForm");
const codeInput = document.getElementById("codeInput");
const backButton = document.getElementById("backButton");

const createdCode = document.getElementById("createdCode");
const codeDisplay = document.getElementById("codeDisplay");
const copyCodeButton = document.getElementById("copyCode");
const continueButton = document.getElementById("continueButton");

const pinMessage = document.getElementById("pinMessage");

const newPageButton = document.getElementById("newPage");
const entriesList = document.getElementById("entriesList");
const entryTitle = document.getElementById("entryTitle");
const entryContent = document.getElementById("entryContent");
const saveStatus = document.getElementById("saveStatus");
const deleteButton = document.getElementById("deletePage");
const lockButton = document.getElementById("lockButton");

// CONECTAR FIREBASE
async function initializeDiary() {
  try {
    const result = await signInAnonymously(auth);
    currentUser = result.user;
  } catch (error) {
    console.error(error);
    pinMessage.textContent = "No se pudo conectar con Firebase.";
    createDiaryButton.disabled = true;
    showJoinButton.disabled = true;
  }
}

await initializeDiary();

// GENERAR CÓDIGO ALEATORIO
function generateCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const random = new Uint8Array(12);

  crypto.getRandomValues(random);

  return Array.from(random)
    .map(number => characters[number % characters.length])
    .join("");
}

// RUTA DEL DIARIO
function diaryDocument() {
  return doc(db, "diaries", currentDiaryCode);
}

function entriesCollection() {
  return collection(db, "diaries", currentDiaryCode, "entries");
}

// MOSTRAR OPCIONES
showJoinButton.addEventListener("click", () => {
  accessOptions.classList.add("hidden");
  joinForm.classList.remove("hidden");
  codeInput.focus();
});

backButton.addEventListener("click", () => {
  joinForm.classList.add("hidden");
  accessOptions.classList.remove("hidden");
  pinMessage.textContent = "";
});

// CREAR DIARIO
createDiaryButton.addEventListener("click", async () => {
  if (!currentUser) return;

  createDiaryButton.disabled = true;
  pinMessage.textContent = "Creando tu diario...";

  try {
    let code;
    let diaryRef;
    let exists = true;

    // Evitar códigos repetidos
    while (exists) {
      code = generateCode();
      diaryRef = doc(db, "diaries", code);

      const existing = await getDoc(diaryRef);
      exists = existing.exists();
    }

    await setDoc(diaryRef, {
      ownerUid: currentUser.uid,
      createdAt: serverTimestamp()
    });

    currentDiaryCode = code;

    // MIGRAR PÁGINAS ANTIGUAS DEL USUARIO
    const oldCollection = collection(
      db,
      "users",
      currentUser.uid,
      "entries"
    );

    const oldPages = await getDocs(oldCollection);

    for (const oldPage of oldPages.docs) {
      const data = oldPage.data();

      await addDoc(entriesCollection(), {
        title: data.title || "",
        content: data.content || "",
        createdAt: data.createdAt || serverTimestamp(),
        updatedAt: data.updatedAt || serverTimestamp()
      });
    }

    accessOptions.classList.add("hidden");

    codeDisplay.textContent = code;
    createdCode.classList.remove("hidden");
    pinMessage.textContent = "";

  } catch (error) {
    console.error(error);
    pinMessage.textContent = "No se pudo crear el diario. Revisa Firebase.";
  } finally {
    createDiaryButton.disabled = false;
  }
});

// COPIAR CÓDIGO
copyCodeButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(codeDisplay.textContent);
    copyCodeButton.textContent = "¡Copiado!";
  } catch (error) {
    pinMessage.textContent = "No se pudo copiar. Selecciona el código.";
  }
});

// CONTINUAR DESPUÉS DE CREAR
continueButton.addEventListener("click", async () => {
  await openDiary();
});

// ENTRAR CON CÓDIGO
joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    pinMessage.textContent = "Espera a que Firebase se conecte.";
    return;
  }

  const code = codeInput.value.trim().toUpperCase();

  if (!/^[A-HJ-NP-Z2-9]{12}$/.test(code)) {
    pinMessage.textContent = "El código no es válido.";
    return;
  }

  pinMessage.textContent = "Buscando diario...";

  try {
    const diaryRef = doc(db, "diaries", code);
    const diarySnapshot = await getDoc(diaryRef);

    if (!diarySnapshot.exists()) {
      pinMessage.textContent = "No encontramos un diario con ese código.";
      return;
    }

    currentDiaryCode = code;
    codeInput.value = "";

    await openDiary();

  } catch (error) {
    console.error(error);
    pinMessage.textContent = "No se pudo acceder al diario.";
  }
});

// ABRIR DIARIO
async function openDiary() {
  try {
    await loadEntries();

    lockScreen.classList.add("hidden");
    diaryScreen.classList.remove("hidden");

  } catch (error) {
    console.error(error);
    pinMessage.textContent = "No se pudieron cargar las páginas.";
  }
}

// CERRAR DIARIO
lockButton.addEventListener("click", async () => {
  await saveCurrentEntry();

  diaryScreen.classList.add("hidden");
  lockScreen.classList.remove("hidden");

  createdCode.classList.add("hidden");
  joinForm.classList.add("hidden");
  accessOptions.classList.remove("hidden");

  currentDiaryCode = null;
  currentEntryId = null;
  entries = [];
});

// CARGAR PÁGINAS
async function loadEntries() {
  const entriesQuery = query(
    entriesCollection(),
    orderBy("updatedAt", "desc")
  );

  const snapshot = await getDocs(entriesQuery);

  entries = snapshot.docs.map(document => ({
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

  entries.forEach(entry => {
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

// FECHAS
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
  const entry = entries.find(item => item.id === id);
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

// GUARDAR PÁGINA
async function saveCurrentEntry() {
  clearTimeout(saveTimer);

  if (!currentEntryId || !currentDiaryCode) return;

  const id = currentEntryId;
  const title = entryTitle.value;
  const content = entryContent.value;

  try {
    await updateDoc(
      doc(db, "diaries", currentDiaryCode, "entries", id),
      {
        title,
        content,
        updatedAt: serverTimestamp()
      }
    );

    const entry = entries.find(item => item.id === id);

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
      doc(db, "diaries", currentDiaryCode, "entries", id)
    );

    entries = entries.filter(entry => entry.id !== id);
    currentEntryId = null;

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
