// =====================================================================
// Ground Control — phone companion (Mode 1: LAN via PeerJS)
// Joins a host room by code; renders state pushed from the host.
// =====================================================================

const ROOM_PREFIX = "gctl";

const ui = {
  joinCard: document.querySelector("#joinCard"),
  statusCard: document.querySelector("#statusCard"),
  codeInput: document.querySelector("#codeInput"),
  nameInput: document.querySelector("#nameInput"),
  joinHint: document.querySelector("#joinHint"),
  statusDot: document.querySelector("#statusDot"),
  statusText: document.querySelector("#statusText"),
  phoneSeat: document.querySelector("#phoneSeat"),
  seatDot: document.querySelector("#seatDot"),
  phoneName: document.querySelector("#phoneName"),
  phoneHint: document.querySelector("#phoneHint"),
  leaveBtn: document.querySelector("#leaveBtn"),
  playCard: document.querySelector("#playCard"),
  turnBanner: document.querySelector("#turnBanner"),
  pickArea: document.querySelector("#pickArea"),
  targetButtons: document.querySelector("#targetButtons"),
  duelArea: document.querySelector("#duelArea"),
  duelPhoto: document.querySelector("#duelPhoto"),
  duelCat: document.querySelector("#duelCat"),
  duelPrompt: document.querySelector("#duelPrompt"),
  phoneClockMe: document.querySelector("#phoneClockMe"),
  phoneClockOpp: document.querySelector("#phoneClockOpp"),
  phoneClockLabel: document.querySelector("#phoneClockLabel"),
  answerArea: document.querySelector("#answerArea"),
  answerInput: document.querySelector("#answerInput"),
  answerButton: document.querySelector('[data-action="submit-answer"]'),
  answerFeedback: document.querySelector("#answerFeedback")
};

const state = {
  // LAN P2P (PeerJS)
  peer: null,
  conn: null,
  // Online (PartyKit) — only one of {conn, ws} is in use per session
  ws: null,
  transport: "lan", // "lan" | "online"
  // Shared
  code: null,
  name: "",
  myId: null,
  myColor: null,
  spectator: false,
  lastImage: "",
  canAnswer: false,
  cooldownUntil: 0
};

window.GCPhone = state;

// Restore last-used name/code; prefill code from ?code= query.
const params = new URLSearchParams(location.search);
const urlCode = (params.get("code") || "").toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 4);
if (urlCode) ui.codeInput.value = urlCode;
// `?online=1` switches the companion to the WebSocket (PartyKit) transport.
if (params.get("online") === "1") state.transport = "online";
const savedName = localStorage.getItem("gc.phone.name") || "";
if (savedName) ui.nameInput.value = savedName;

function setStatus(text, dotClass = "is-pending") {
  ui.statusText.textContent = text;
  ui.statusDot.className = `phone-dot ${dotClass}`;
}

function showStatusCard() {
  ui.joinCard.hidden = true;
  ui.statusCard.hidden = false;
  ui.leaveBtn.hidden = false;
}

function showJoinCard() {
  document.body.classList.remove("is-connected", "is-spectator");
  ui.statusCard.hidden = true;
  ui.joinCard.hidden = false;
  ui.leaveBtn.hidden = true;
}

async function openPhonePeer() {
  return new Promise((resolve, reject) => {
    const p = new Peer({ debug: 1 });
    const onOpen = () => { p.off("error", onErr); resolve(p); };
    const onErr = (err) => { p.off("open", onOpen); reject(err); };
    p.once("open", onOpen);
    p.once("error", onErr);
  });
}

function bindConnection(conn) {
  state.conn = conn;
  conn.on("open", () => {
    state._peerRetries = 0;       // connected — clear the retry counter
    state.shouldReconnect = true; // a real connection: keep it alive across drops
    requestWakeLock();            // don't let the phone screen sleep mid-game
    setStatus("Connected — joining…", "is-pending");
    conn.send({ type: "join", name: state.name });
  });
  conn.on("data", (msg) => handleHostMessage(msg));
  conn.on("close", () => {
    if (state.shouldReconnect) {
      setStatus("Reconnecting…", "is-pending");
      ui.phoneHint.textContent = "Lost the host briefly — getting you back in.";
      scheduleReconnect();
    } else {
      setStatus("Disconnected", "is-bad");
      ui.phoneHint.textContent = "The host closed the connection. You can re-join.";
    }
  });
  conn.on("error", (err) => {
    if (state.shouldReconnect) { scheduleReconnect(); return; }
    setStatus("Connection error", "is-bad");
    ui.phoneHint.textContent = err?.message || "Unknown error.";
  });
}

// ---- Resilience: keep the phone connected the way the Feud buzzer does ----
// The phone is the fragile end (screen sleep, app backgrounding, walking out of
// Wi-Fi range). Auto-retry the SAME room code with light backoff instead of
// dumping the player on a dead screen.
function scheduleReconnect() {
  if (!state.shouldReconnect || state.code == null) return;
  if (state._reconnectTimer) return; // one in flight
  const delay = Math.min(1200 + (state._reconnectAttempt || 0) * 800, 5000);
  state._reconnectAttempt = (state._reconnectAttempt || 0) + 1;
  state._reconnectTimer = setTimeout(() => {
    state._reconnectTimer = null;
    reconnectNow();
  }, delay);
}

async function reconnectNow() {
  if (!state.shouldReconnect || state.code == null) return;
  try { state.conn?.close(); } catch (e) { /* ignore */ }
  try {
    if (!state.peer || state.peer.destroyed) state.peer = await openPhonePeer();
    const conn = state.peer.connect(`${ROOM_PREFIX}-${state.code.toLowerCase()}`, { reliable: true });
    bindConnection(conn);
  } catch (e) {
    scheduleReconnect();
  }
}

function reconnectIfNeeded() {
  if (state.shouldReconnect && (!state.conn || !state.conn.open) && !state._reconnectTimer) {
    state._reconnectAttempt = 0;
    reconnectNow();
  }
}

// Screen Wake Lock — released by the OS when the tab hides; re-acquired on show.
async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator && !state._wakeLock) {
      state._wakeLock = await navigator.wakeLock.request("screen");
      state._wakeLock.addEventListener("release", () => { state._wakeLock = null; });
    }
  } catch (e) { /* wake lock optional */ }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { requestWakeLock(); reconnectIfNeeded(); }
});
window.addEventListener("online", reconnectIfNeeded);
window.addEventListener("pageshow", reconnectIfNeeded);

function fmtClock(s) {
  if (s == null) return "--";
  return "0:" + String(Math.max(0, s)).padStart(2, "0");
}

function handleHostMessage(msg) {
  if (!msg || typeof msg !== "object") return;
  switch (msg.type) {
    case "welcome":
      break;
    case "joined":
      state._reconnectAttempt = 0; // clean (re)join
      state.spectator = !!msg.spectator;
      state.myId = msg.spectator ? null : msg.playerId;
      state.myColor = msg.color || "#f5bd36";
      document.body.classList.add("is-connected");
      document.body.classList.toggle("is-spectator", state.spectator);
      setStatus(state.spectator ? "Watching" : `In as ${msg.name}`, "is-good");
      ui.phoneSeat.hidden = false;
      ui.seatDot.style.background = state.myColor;
      ui.phoneName.textContent = state.spectator ? "Spectator" : msg.name;
      ui.phoneHint.textContent = state.spectator
        ? "This game has no open phone seat, so you're watching. To let phones play, the host starts a Local Party Night with phone players."
        : "You're in — answer here when it's your turn.";
      ui.playCard.hidden = false;
      break;
    case "state":
      renderPhone(msg.snapshot);
      break;
    case "answer-result":
      if (msg.correct) {
        ui.answerFeedback.textContent = "✓ Correct!";
        ui.answerFeedback.className = "phone-answer-feedback is-good";
        ui.answerInput.value = "";
      } else {
        ui.answerFeedback.textContent = "✗ Not quite — try again";
        ui.answerFeedback.className = "phone-answer-feedback is-bad";
        // brief cooldown to stop spam
        state.cooldownUntil = Date.now() + 1400;
        ui.answerInput.disabled = true;
        ui.answerButton.disabled = true;
        ui.answerInput.value = "";
        setTimeout(() => {
          ui.answerInput.disabled = !state.canAnswer;
          ui.answerButton.disabled = !state.canAnswer;
          if (state.canAnswer) ui.answerInput.focus();
        }, 1400);
      }
      break;
    default:
      break;
  }
}

function renderPhone(snap) {
  if (!snap) return;
  const mine = state.myId;

  // Duel view takes priority
  if (snap.stage === "duel" && snap.duel) {
    ui.pickArea.hidden = true;
    ui.duelArea.hidden = false;
    const d = snap.duel;
    const iAmActive = mine != null && d.activePlayerId === mine;
    const iAmInDuel = mine != null && (d.challengerId === mine || d.defenderId === mine);
    state.canAnswer = iAmActive;

    // Photo (cached: host omits image when unchanged)
    if (d.image) state.lastImage = d.image;
    else if (!d.imageUnchanged) state.lastImage = "";
    const img = d.image || state.lastImage;
    ui.duelPhoto.hidden = !img;
    ui.duelPhoto.innerHTML = img ? `<img src="${img}" alt="Question image">` : "";
    ui.duelCat.textContent = d.category;
    ui.duelPrompt.textContent = d.prompt || d.category || "Question";

    // Clocks — show mine vs opponent if I'm in the duel, else challenger vs defender
    if (iAmInDuel) {
      const meClock = d.challengerId === mine ? d.challengerClock : d.defenderClock;
      const oppClock = d.challengerId === mine ? d.defenderClock : d.challengerClock;
      ui.phoneClockMe.textContent = fmtClock(meClock);
      ui.phoneClockOpp.textContent = fmtClock(oppClock);
    } else {
      ui.phoneClockMe.textContent = fmtClock(d.challengerClock);
      ui.phoneClockOpp.textContent = fmtClock(d.defenderClock);
    }

    if (iAmInDuel) {
      ui.answerArea.hidden = false;
      ui.answerInput.disabled = !iAmActive;
      ui.answerButton.disabled = !iAmActive;
      ui.answerInput.placeholder = iAmActive ? "Type your answer" : "Waiting for your turn";
    } else {
      ui.answerArea.hidden = true;
    }

    if (iAmActive) {
      ui.turnBanner.textContent = "YOUR TURN — answer!";
      ui.turnBanner.className = "phone-turn-banner is-you";
    } else if (iAmInDuel) {
      ui.turnBanner.textContent = `${activeName(snap)} is answering…`;
      ui.turnBanner.className = "phone-turn-banner";
    } else {
      ui.turnBanner.textContent = state.spectator
        ? "Spectator — no answer controls"
        : `${d.challengerName} vs ${d.defenderName}`;
      ui.turnBanner.className = "phone-turn-banner";
    }
    return;
  }

  // Floor view
  state.canAnswer = false;
  ui.duelArea.hidden = true;
  const isMyTurnToPick = snap.stage === "floor" && mine != null && snap.activePlayerId === mine && Array.isArray(snap.targets);
  if (isMyTurnToPick) {
    ui.pickArea.hidden = false;
    ui.turnBanner.textContent = "YOUR TURN — pick a tile";
    ui.turnBanner.className = "phone-turn-banner is-you";
    ui.targetButtons.innerHTML = snap.targets.map(t =>
      `<button class="phone-target" type="button" data-target="${t.index}">${t.category}</button>`
    ).join("") || `<p class="phone-hint">No tiles to attack.</p>`;
  } else {
    ui.pickArea.hidden = true;
    if (snap.stage === "result" && snap.result) {
      ui.turnBanner.textContent = snap.result.title;
      ui.turnBanner.className = "phone-turn-banner";
    } else if (snap.stage === "victory" && snap.victory) {
      ui.turnBanner.textContent = "🏆 " + snap.victory.title;
      ui.turnBanner.className = "phone-turn-banner is-you";
    } else if (snap.isSpinning) {
      ui.turnBanner.textContent = "Spinning…";
      ui.turnBanner.className = "phone-turn-banner";
    } else {
      const spot = snap.players?.find(p => p.id === snap.activePlayerId);
      ui.turnBanner.textContent = spot ? `${spot.name}'s turn` : "Waiting for host…";
      ui.turnBanner.className = "phone-turn-banner";
    }
  }
}

function activeName(snap) {
  const p = snap.players?.find(pp => pp.id === snap.duel.activePlayerId);
  return p ? p.name : "Opponent";
}

function sendAction(action) {
  if (state.transport === "online") {
    if (state.ws?.readyState === 1) {
      try { state.ws.send(JSON.stringify({ kind: "to-host", payload: action })); } catch (e) {}
    }
    return;
  }
  if (state.conn?.open) { try { state.conn.send(action); } catch (e) {} }
}

// Online host base — read from query (?host=) or window.GC_PARTYKIT_HOST (config.js),
// fallback to localhost for `npx partykit dev`.
function gcOnlineHost() {
  const fromQuery = params.get("host");
  const raw = (fromQuery || window.GC_PARTYKIT_HOST || "127.0.0.1:1999").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const secure = !/^(127\.|localhost|192\.168\.|10\.)/.test(raw);
  return `${secure ? "wss" : "ws"}://${raw}/parties/main/`;
}

async function join() {
  const code = (ui.codeInput.value || "").trim().toUpperCase();
  state.name = (ui.nameInput.value || "").trim().slice(0, 24) || "Player";
  if (!/^[A-Z2-9]{4}$/.test(code)) {
    ui.joinHint.textContent = "Code is 4 letters/digits (no I, O, 0, or 1).";
    return;
  }
  localStorage.setItem("gc.phone.name", state.name);
  state.code = code;
  showStatusCard();
  setStatus(`Connecting to room ${code}…`, "is-pending");

  if (state.transport === "online") {
    try {
      const url = gcOnlineHost() + code.toLowerCase();
      const ws = new WebSocket(url);
      state.ws = ws;
      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({ kind: "hello", role: "phone" }));
        ws.send(JSON.stringify({ kind: "to-host", payload: { type: "join", name: state.name } }));
        setStatus("Connected — joining…", "is-pending");
      });
      ws.addEventListener("message", (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg?.type === "host-gone") {
          setStatus("Host left the room", "is-bad");
          ui.phoneHint.textContent = "Wait for the host to come back, then refresh.";
          return;
        }
        handleHostMessage(msg);
      });
      ws.addEventListener("close", () => {
        setStatus("Disconnected", "is-bad");
        ui.phoneHint.textContent = "Lost connection to the relay. Refresh to re-join.";
      });
      ws.addEventListener("error", () => {
        setStatus("Connection error", "is-bad");
        ui.phoneHint.textContent = "Could not reach the online relay. Check internet, or have the host re-open the room.";
      });
    } catch (err) {
      setStatus("Could not connect", "is-bad");
      ui.phoneHint.textContent = err?.message || "Unknown error.";
    }
    return;
  }

  // LAN P2P (PeerJS) path
  try {
    state.peer = await openPhonePeer();
    // PeerJS drops idle peers from its broker socket — reconnect so the phone
    // can rejoin the same room without the user re-scanning.
    state.peer.on("disconnected", () => {
      try { if (state.shouldReconnect && !state.peer.destroyed) state.peer.reconnect(); }
      catch (e) { scheduleReconnect(); }
    });
    state.peer.on("error", (err) => {
      if (err?.type === "peer-unavailable") {
        // The host peer may not be registered with the broker yet (host just
        // opened the room) or this is a transient broker hiccup. Retry a few
        // times before giving up, instead of flashing "Room not found".
        if ((state._peerRetries = (state._peerRetries || 0) + 1) <= 4) {
          setStatus(`Finding room ${code}… (${state._peerRetries})`, "is-pending");
          setTimeout(() => {
            if (!state.peer || state.peer.destroyed) return;
            try {
              const retry = state.peer.connect(`${ROOM_PREFIX}-${code.toLowerCase()}`, { reliable: true });
              bindConnection(retry);
            } catch (e) { /* will surface on next error */ }
          }, 1500);
        } else {
          setStatus("Room not found", "is-bad");
          ui.phoneHint.textContent = "Make sure the host opened the Phone Room and the phone is on the same Wi-Fi, then tap Join again.";
        }
      } else {
        console.warn("peer error:", err);
      }
    });
    const conn = state.peer.connect(`${ROOM_PREFIX}-${code.toLowerCase()}`, { reliable: true });
    bindConnection(conn);
  } catch (err) {
    setStatus("Could not connect", "is-bad");
    ui.phoneHint.textContent = err?.message || "Unknown error.";
  }
}

function leave() {
  state.shouldReconnect = false; // deliberate exit — stop the auto-reconnect loop
  if (state._reconnectTimer) { clearTimeout(state._reconnectTimer); state._reconnectTimer = null; }
  try { state._wakeLock?.release(); } catch (e) { /* ignore */ }
  state._wakeLock = null;
  try { state.conn?.close(); } catch (e) { /* ignore */ }
  try { state.peer?.destroy(); } catch (e) { /* ignore */ }
  try { state.ws?.close(); } catch (e) { /* ignore */ }
  state.conn = null;
  state.peer = null;
  state.ws = null;
  showJoinCard();
  ui.joinHint.textContent = "Ask the host for the 4-letter code shown on the TV.";
}

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (action) {
    if (action.dataset.action === "join") join();
    if (action.dataset.action === "leave") leave();
    if (action.dataset.action === "submit-answer") submitAnswer();
  }
  const targetBtn = event.target.closest("[data-target]");
  if (targetBtn) {
    sendAction({ type: "pick-target", index: Number(targetBtn.dataset.target) });
    ui.pickArea.hidden = true;
    ui.turnBanner.textContent = "Starting duel…";
  }
});

function submitAnswer() {
  if (!state.canAnswer) return;
  if (Date.now() < state.cooldownUntil) return;
  const text = (ui.answerInput.value || "").trim();
  if (!text) return;
  sendAction({ type: "answer", text });
}

ui.answerInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitAnswer();
});

ui.codeInput.addEventListener("input", () => {
  ui.codeInput.value = ui.codeInput.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 4);
});

// ---- Auto-join on scan ----
// A buzzer should connect the instant the QR is scanned — no typing, no extra
// tap (matches the Feud buzzer). When the QR provides ?code=, fill in a name
// (saved, else a friendly default the player can change later) and join now.
if (urlCode && /^[A-Z2-9]{4}$/.test(urlCode)) {
  if (!ui.nameInput.value) {
    ui.nameInput.value = savedName || ("Player " + Math.floor(10 + Math.random() * 90));
  }
  // Defer one tick so every handler/definition above is wired first.
  setTimeout(() => { try { join(); } catch (e) { console.warn("auto-join failed", e); } }, 50);
}
