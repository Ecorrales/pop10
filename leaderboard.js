// Tabla global de Pop10 con Firebase (Auth anónima + Firestore).
// El juego funciona sin esto: si Firebase falla, la tabla muestra el error o "sin conexión".
//
// Estructura en Firestore:  ranks/{modo}/{periodo}/{uid}
//   modo:    'tiempo' | 'reloj'
//   periodo: 'all' (histórico) | 'w<número>' (semana; se reinicia cada lunes 00:00, hora del centro de México)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, setDoc, query, where, orderBy, limit, onSnapshot,
  serverTimestamp, getCountFromServer,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const MODES = ['tiempo', 'reloj'];

// Semanas de lunes 00:00 a domingo 23:59 en UTC-6. Mismo cálculo que en firestore.rules.
const WEEK_MS = 604800000;     // 7 días
const WEEK_ZERO = 367200000;   // lunes 5 de enero de 1970, 00:00 UTC-6
const weekIndex = (ms = Date.now()) => Math.floor((ms - WEEK_ZERO) / WEEK_MS);
const weekPeriod = (ms = Date.now()) => 'w' + weekIndex(ms);
const weekEndsAt = (ms = Date.now()) => WEEK_ZERO + (weekIndex(ms) + 1) * WEEK_MS;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function board(mode, period) {
  if (!MODES.includes(mode)) throw new Error('modo inválido: ' + mode);
  if (period !== 'all' && !/^w\d+$/.test(period)) throw new Error('periodo inválido: ' + period);
  return collection(db, 'ranks', mode, period);
}

// Resuelve con el uid del jugador; crea una cuenta anónima la primera vez y la reutiliza después.
function init() {
  return new Promise((resolve, reject) => {
    const off = onAuthStateChanged(auth, user => {
      if (user) { off(); resolve(user.uid); }
      else signInAnonymously(auth).catch(err => { off(); reject(err); });
    }, err => { off(); reject(err); });
  });
}

// Top 20 en vivo. Regresa la función para dejar de escuchar.
function subscribe(mode, period, onRows, onError) {
  const q = query(board(mode, period), orderBy('score', 'desc'), limit(20));
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

async function getMine(mode, period) {
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) return 0;
  const s = await getDoc(doc(board(mode, period), uid));
  return s.exists() ? Number(s.data().score) || 0 : 0;
}

// Guarda el mejor puntaje del jugador en ese periodo. Las reglas validan que sea plausible.
async function submit(mode, period, { name, score, tens, bonus10, duration }) {
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) throw new Error('sin sesión');
  await setDoc(doc(board(mode, period), uid), {
    name, score, tens, bonus10, duration,
    updatedAt: serverTimestamp(),
  });
}

// Lugar de un puntaje en la tabla completa: cuántos tienen más, +1. No descarga los documentos.
async function rankOf(mode, period, score) {
  const col = board(mode, period);
  const [above, total] = await Promise.all([
    getCountFromServer(query(col, where('score', '>', score))),
    getCountFromServer(col),
  ]);
  return { rank: above.data().count + 1, total: total.data().count };
}

window.PopLB = { init, subscribe, getMine, submit, rankOf, weekPeriod, weekEndsAt };
window.dispatchEvent(new Event('poplb-ready'));
