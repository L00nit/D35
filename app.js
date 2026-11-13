
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs,
  doc, updateDoc, deleteDoc, serverTimestamp,
  query, orderBy
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// REEMPLAZA ESTOS DATOS CON LOS DE TU FIREBASE
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const PIN = "2012";

const $ = id => document.getElementById(id);

let user = null;
let entries = [];
let currentId = null;
let saveTimer;

$("pinForm").addEventListener("submit", async event => {
  event.preventDefault();

  if ($("pinInput").value !== PIN) {
    $("pinMessage").textContent = "Código incorrecto.";
    $("pinInput").value = "";
    return;
  }

  $("pinMessage").textContent = "Abriendo...";

  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }

    user = auth.currentUser;

    $("lockScreen").classList.add("hidden");
    $("diaryScreen").classList.remove("hidden");
    $("pinInput").value = "";
    $("pinMessage").textContent = "";

    await loadEntries();
  } catch (error) {
    console.error(error);
    $("pinMessage").textContent = "No se pudo conectar con Firebase.";
  }
});

function entriesRef() {
  return collection(db, "users", user.uid, "entries");
}

async function loadEntries() {
  const q = query(entriesRef(), orderBy("updatedAt", "desc"));
  const snapshot = await getDocs(q);

  entries = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  renderEntries();

  if (entries.length) {
    selectEntry(entries[0].id);
  } else {
    await createEntry();
  }
}

function renderEntries() {
  const list = $("entriesList");
  list.innerHTML = "";

  entries.forEach(entry => {
    const button = document.createElement("button");
    button.className = "entry-item";
    button.textContent = entry.title || "Página sin título";

    if (entry.id === currentId) {
      button.classList.add("active");
    }

    button.addEventListener("click", async () => {
      await saveEntry();
      selectEntry(entry.id);
    });

    list.appendChild(button);
  });
}

function selectEntry(id) {
  const entry = entries.find(item => item.id === id);
  if (!entry) return;

  currentId = id;
  $("entryTitle").value = entry.title || "";
  $("entryContent").value = entry.content || "";
  $("saveStatus").textContent = "Página guardada";

  renderEntries();
}

async function createEntry() {
  const result = await addDoc(entriesRef(), {
    title: "",
    content: "",
    updatedAt: serverTimestamp()
  });

  entries.unshift({
    id: result.id,
    title: "",
    content: ""
  });

  selectEntry(result.id);
  $("entryTitle").focus();
}

function scheduleSave() {
  if (!currentId) return;

  $("saveStatus").textContent = "Guardando...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveEntry, 700);
}

async function saveEntry() {
  clearTimeout(saveTimer);
  if (!currentId || !user) return;

  const id = currentId;
  const title = $("entryTitle").value;
  const content = $("entryContent").value;

  try {
    await updateDoc(doc(db, "users", user.uid, "entries", id), {
      title,
      content,
      updatedAt: serverTimestamp()
    });

    const entry = entries.find(item => item.id === id);
    if (entry) {
      entry.title = title;
      entry.content = content;
    }

    $("saveStatus").textContent = "Guardado";
    renderEntries();
  } catch (error) {
    console.error(error);
    $("saveStatus").textContent = "Error al guardar";
  }
}

$("entryTitle").addEventListener("input", scheduleSave);
$("entryContent").addEventListener("input", scheduleSave);

$("newPage").addEventListener("click", async () => {
  await saveEntry();
  await createEntry();
});

$("deletePage").addEventListener("click", async () => {
  if (!currentId) return;
  if (!confirm("¿Eliminar esta página?")) return;

  clearTimeout(saveTimer);

  try {
    await deleteDoc(doc(db, "users", user.uid, "entries", currentId));

    entries = entries.filter(item => item.id !== currentId);
    currentId = null;

    if (entries.length) {
      selectEntry(entries[0].id);
    } else {
      await createEntry();
    }
  } catch (error) {
    console.error(error);
    alert("No se pudo eliminar la página.");
  }
});

$("closeDiary").addEventListener("click", async () => {
  await saveEntry();
  $("diaryScreen").classList.add("hidden");
  $("lockScreen").classList.remove("hidden");
  $("pinInput").value = "";
});
