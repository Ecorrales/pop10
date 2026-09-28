// Tabla global de Pop10 con Firebase (Auth anónima + Firestore).
// El juego funciona sin esto: si Firebase falla, la tabla se oculta o avisa "sin conexión".
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, setDoc, query, orderBy, limit, onSnapshot, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const MODES = ['tiempo', 'escape'];
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const scoresCol = mode => collection(db, 'leaderboards', mode, 'scores');

// Resuelve con el uid del jugador; crea una cuenta anónima la primera vez y la reutiliza después.
function init() {
  return new Promise((resolve, reject) => {
    const off = onAuthStateChanged(auth, user => {
      if (user) { off(); resolve(user.uid); }
      else signInAnonymously(auth).catch(err => { off(); reject(err); });
    }, err => { off(); reject(err); });
  });
}

// Top 20 en vivo. Los nombres vienen de otros jugadores: el juego los pinta con textContent.
function subscribe(mode, onRows, onError) {
  if (!MODES.includes(mode)) throw new Error('modo inválido');
  const q = query(scoresCol(mode), orderBy('score', 'desc'), limit(20));
  return onSnapshot(q, snap => {
    onRows(snap.docs.map(d => {
      const x = d.data();
      return {
        id: d.id,
        name: String(x.name || '').slice(0, 16),
        score: Math.max(0, Math.floor(Number(x.score) || 0)),
      };
    }));
  }, err => { console.warn('leaderboard', err); onError && onError(err); });
}

async function getMine(mode) {
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) return 0;
  const s = await getDoc(doc(scoresCol(mode), uid));
  return s.exists() ? Number(s.data().score) || 0 : 0;
}

// Guarda el mejor puntaje del jugador. Las reglas de Firestore validan que sea plausible.
async function submit(mode, { name, score, tens, bonus10, duration }) {
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) throw new Error('sin sesión');
  await setDoc(doc(scoresCol(mode), uid), {
    name, score, tens, bonus10, duration,
    updatedAt: serverTimestamp(),
  });
}

window.PopLB = { init, subscribe, getMine, submit };
window.dispatchEvent(new Event('poplb-ready'));
