# Pop10 — PWA con tabla global en Firebase

El juego es estático: `index.html` + `leaderboard.js`. Firebase solo se usa para la tabla.
Si Firebase no está configurado o no hay internet, el juego funciona igual y la tabla avisa "sin conexión".

## 1. Configurar Firebase

1. Crea un proyecto en la consola de Firebase (o usa uno que ya tengas; la tabla vive en
   `leaderboards/{modo}/scores/{uid}` y no choca con otras colecciones).
2. **Authentication → Sign-in method →** habilita **Anónimo**.
3. **Firestore Database →** créala en modo producción. Para México, `us-central1` o `us-east1`.
4. **Configuración del proyecto → Tus apps →** agrega una app web y copia el objeto `firebaseConfig`
   a `firebase-config.js`.
5. Publica las reglas:
   ```
   npm i -g firebase-tools
   firebase login
   firebase use --add        # elige tu proyecto
   firebase deploy --only firestore:rules
   ```
   (O pega `firestore.rules` en Firestore → Reglas, en la consola.)

La consulta del top 20 usa un solo campo (`score`), así que no necesita índices compuestos.

## 2. Probar en local

Los módulos ES y el service worker necesitan servidor HTTP (no abras el archivo directo):
```
npx serve .
```
Abre `http://localhost:3000`. Para probar desde el celular en tu red, usa la IP de tu máquina;
el service worker solo se instala en `localhost` o HTTPS, pero el juego y la tabla funcionan igual.

## 3. Publicar

Cualquiera de estas sirve, todas con HTTPS gratis:

- **Firebase Hosting:** `firebase deploy --only hosting` (ya viene `firebase.json`).
- **GitHub Pages:** sube la carpeta a un repo y activa Pages en la rama principal.
- **Cloudflare Pages:** conecta el repo; sin build command, output directory `/`.

Si usas un dominio que no sea de Firebase, agrégalo en **Authentication → Settings → Authorized domains**.

**Cada vez que publiques cambios, sube `VERSION` en `sw.js`**; si no, los jugadores que ya
instalaron la app pueden seguir viendo la versión anterior.

## 4. Qué tan protegida está la tabla

Las reglas de Firestore hacen que:
- cada jugador escriba solo su propio documento (su uid anónimo);
- el puntaje solo pueda subir y como máximo una escritura cada 5 segundos;
- el puntaje sea coherente con la mecánica: máximo 2 dieces por segundo de partida, y
  `puntos ≤ 50·dieces·(dieces+1) + 50·fusiones10`;
- el nombre tenga de 1 a 16 caracteres y no haya campos extra.

Esto detiene a la mayoría de los tramposos casuales, **pero no es a prueba de balas**: alguien
que lea el código puede fabricar una partida plausible, y puede crear cuentas anónimas nuevas.
Para endurecerlo, en orden de esfuerzo:

1. **Firebase App Check** (reCAPTCHA Enterprise en web; Play Integrity / App Attest si luego
   empaquetas con Capacitor). Bloquea peticiones que no vienen de tu app.
2. **Moderación:** como dueño puedes borrar documentos sospechosos desde la consola.
3. **Validación en servidor** (Cloud Function o Cloudflare Worker) que reciba un registro de la
   partida y recalcule el puntaje. Es lo más sólido, pero es trabajo real; vale la pena solo si
   la tabla empieza a llenarse de trampas.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | El juego completo (física, audio, música, UI). Ajustes de balance en `CFG`. |
| `leaderboard.js` | Auth anónima, top 20 en vivo, guardar puntaje. |
| `firebase-config.js` | Tu configuración de Firebase. |
| `firestore.rules` | Reglas de seguridad y validación de puntajes. |
| `sw.js` | Service worker: el juego abre sin internet. |
| `manifest.webmanifest`, `icons/` | Instalación en pantalla de inicio. |
