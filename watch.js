(function () {
  "use strict";

  const SYNC_THRESHOLD = 2;
  const SEEK_DEBOUNCE_MS = 400;

  let db = null;
  let myId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `u-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let roomId = "";
  let myName = "";
  let player = null;
  let currentVideoId = "";
  let suppressSync = false;
  let seekDebounceTimer = null;
  let lastBroadcastTime = 0;
  let ytApiReady = false;
  let pendingVideoId = null;
  let playbackRef = null;
  let chatRef = null;
  let pendingRemotePlayback = null;

  function getFirebaseConfig() {
    return window.FIREBASE_CONFIG || (typeof FIREBASE_CONFIG !== "undefined" ? FIREBASE_CONFIG : null);
  }

  function getRoomDefaults() {
    return window.WATCH_ROOM_DEFAULT || (typeof WATCH_ROOM_DEFAULT !== "undefined" ? WATCH_ROOM_DEFAULT : null);
  }

  // ---- Firebase check ----
  function isFirebaseConfigured() {
    const config = getFirebaseConfig();
    if (!config) return false;
    const key = config.apiKey || "";
    return key.length > 10 && !key.includes("ВСТАВЬ");
  }

  function initFirebase() {
    if (!isFirebaseConfigured()) return false;
    const config = getFirebaseConfig();
    if (!window.firebase) return false;
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    db = firebase.database();
    return true;
  }

  // ---- YouTube ----
  window.onYouTubeIframeAPIReady = function () {
    ytApiReady = true;
    if (pendingVideoId) loadVideo(pendingVideoId);
  };

  function parseYouTubeId(urlOrId) {
    if (!urlOrId) return null;
    const s = urlOrId.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    ];
    for (const re of patterns) {
      const m = s.match(re);
      if (m) return m[1];
    }
    return null;
  }

  function attachPlaybackListener() {
    playbackRef.on("value", (snap) => {
      const data = snap.val();
      if (!data || data.by === myId) return;
      applyRemotePlayback(data);
    });
  }

  function createPlayer(videoId) {
    if (player) {
      player.loadVideoById(videoId);
      document.getElementById("player-placeholder").classList.add("is-hidden");
      return;
    }

    player = new YT.Player("yt-player", {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: {
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
      },
      events: {
        onReady: () => {
          document.getElementById("player-placeholder").classList.add("is-hidden");
          if (pendingRemotePlayback) {
            applyRemotePlayback(pendingRemotePlayback);
            pendingRemotePlayback = null;
          }
        },
        onStateChange: onPlayerStateChange,
      },
    });
  }

  function loadVideo(videoId, shouldBroadcast = true) {
    currentVideoId = videoId;
    document.getElementById("now-watching").textContent = `Смотрим: ${videoId}`;

    if (!ytApiReady) {
      pendingVideoId = videoId;
      return;
    }

    createPlayer(videoId);

    if (shouldBroadcast && playbackRef) {
      broadcastPlayback(true);
    }
  }

  function onPlayerStateChange(event) {
    if (suppressSync || !playbackRef) return;

    const state = event.data;
    if (
      state === YT.PlayerState.PLAYING ||
      state === YT.PlayerState.PAUSED ||
      state === YT.PlayerState.ENDED
    ) {
      broadcastPlayback(state === YT.PlayerState.PLAYING);
    }
  }

  function broadcastPlayback(playing) {
    if (!player || !player.getCurrentTime || suppressSync) return;

    const now = Date.now();
    if (now - lastBroadcastTime < 150) return;
    lastBroadcastTime = now;

    const time = player.getCurrentTime() || 0;
    playbackRef.set({
      videoId: currentVideoId,
      playing: !!playing,
      time,
      updatedAt: now,
      by: myId,
    });
  }

  function applyRemotePlayback(data) {
    if (!player || !player.getCurrentTime) {
      pendingRemotePlayback = data;
      if (data.videoId && data.videoId !== currentVideoId) {
        loadVideo(data.videoId, false);
      }
      return;
    }

    suppressSync = true;
    document.getElementById("sync-dot").classList.add("is-syncing");

    if (data.videoId && data.videoId !== currentVideoId) {
      currentVideoId = data.videoId;
      player.loadVideoById(data.videoId);
      document.getElementById("player-placeholder").classList.add("is-hidden");
      document.getElementById("now-watching").textContent = `Смотрим: ${data.videoId}`;
    }

    const localTime = player.getCurrentTime() || 0;
    const drift = Math.abs(localTime - (data.time || 0));

    if (drift > SYNC_THRESHOLD) {
      player.seekTo(data.time, true);
    }

    if (data.playing) {
      if (player.getPlayerState() !== YT.PlayerState.PLAYING) {
        player.playVideo();
      }
    } else {
      if (player.getPlayerState() === YT.PlayerState.PLAYING) {
        player.pauseVideo();
      }
    }

    setTimeout(() => {
      suppressSync = false;
      document.getElementById("sync-dot").classList.remove("is-syncing");
    }, 500);
  }

  // Poll seek while playing (YouTube doesn't fire seek events reliably)
  function startSeekPolling() {
    setInterval(() => {
      if (suppressSync || !player || !player.getCurrentTime) return;
      if (player.getPlayerState() !== YT.PlayerState.PLAYING) return;
      clearTimeout(seekDebounceTimer);
      seekDebounceTimer = setTimeout(() => broadcastPlayback(true), SEEK_DEBOUNCE_MS);
    }, 800);
  }

  // ---- Chat ----
  function appendChatMessage(data, key) {
    const box = document.getElementById("chat-messages");
    const existing = box.querySelector(`[data-key="${key}"]`);
    if (existing) return;

    const el = document.createElement("div");
    el.dataset.key = key;

    if (data.system) {
      el.className = "chat-msg chat-msg-system";
      el.textContent = data.text;
    } else {
      const isMe = data.name === myName;
      el.className = `chat-msg${isMe ? " is-me" : ""}`;
      el.innerHTML = `<div class="chat-msg-name">${escapeHtml(data.name)}</div>${escapeHtml(data.text)}`;
    }

    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function sendChat(text) {
    if (!text.trim() || !chatRef) return;
    chatRef.push({
      name: myName,
      text: text.trim(),
      ts: Date.now(),
    });
  }

  function postSystemMessage(text) {
    chatRef.push({
      name: "—",
      text,
      ts: Date.now(),
      system: true,
    });
  }

  // ---- Screens ----
  function showJoinScreen() {
    document.getElementById("setup-screen").hidden = true;
    document.getElementById("join-screen").hidden = false;
    document.getElementById("room-screen").hidden = true;
  }

  function showSetupScreen(reason) {
    document.getElementById("setup-screen").hidden = false;
    document.getElementById("join-screen").hidden = true;
    document.getElementById("room-screen").hidden = true;
    const hint = document.getElementById("setup-reason");
    if (hint && reason) hint.textContent = reason;
  }

  function enterRoom(name, room) {
    myName = name.trim();
    roomId = room.trim().replace(/[^a-zA-Z0-9_-]/g, "-");

    sessionStorage.setItem("watch-name", myName);
    sessionStorage.setItem("watch-room", roomId);

    playbackRef = db.ref(`rooms/${roomId}/playback`);
    chatRef = db.ref(`rooms/${roomId}/chat`);

    attachPlaybackListener();

    document.getElementById("join-screen").hidden = true;
    document.getElementById("room-screen").hidden = false;
    document.getElementById("room-code-display").textContent = `Комната: ${roomId}`;

    const seenChatKeys = new Set();

    chatRef.limitToLast(80).on("child_added", (snap) => {
      if (seenChatKeys.has(snap.key)) return;
      seenChatKeys.add(snap.key);
      appendChatMessage(snap.val(), snap.key);
    });

    postSystemMessage(`${myName} вошёл в комнату`);

    playbackRef.once("value", (snap) => {
      const data = snap.val();
      if (data?.videoId) {
        applyRemotePlayback({ ...data, by: "remote" });
      }
    });

    startSeekPolling();
  }

  function initJoinForm() {
    const params = new URLSearchParams(window.location.search);
    const nameInput = document.getElementById("join-name");
    const roomInput = document.getElementById("join-room");

    const defaults = getRoomDefaults();

    nameInput.value =
      params.get("name") ||
      sessionStorage.getItem("watch-name") ||
      (defaults ? defaults.yourDefaultName : "") ||
      "";

    roomInput.value =
      params.get("room") ||
      sessionStorage.getItem("watch-room") ||
      (defaults ? defaults.roomId : "bulka-katya-room");

    document.getElementById("join-form").addEventListener("submit", (e) => {
      e.preventDefault();
      enterRoom(nameInput.value, roomInput.value);
    });

    if (params.get("autojoin") === "1" && nameInput.value.trim()) {
      enterRoom(nameInput.value, roomInput.value);
    }
  }

  function initRoomControls() {
    document.getElementById("load-video-btn").addEventListener("click", () => {
      const url = document.getElementById("video-url").value;
      const id = parseYouTubeId(url);
      if (!id) {
        alert("Не получилось распознать ссылку YouTube. Вставь ссылку вида youtube.com/watch?v=...");
        return;
      }
      loadVideo(id);
      postSystemMessage(`${myName} включил новое видео`);
    });

    document.getElementById("video-url").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("load-video-btn").click();
      }
    });

    document.getElementById("chat-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("chat-input");
      sendChat(input.value);
      input.value = "";
    });
  }

  // ---- Boot ----
  if (!isFirebaseConfigured()) {
    showSetupScreen(
      "Не загрузился файл firebase-config.js. Обнови страницу (Ctrl+F5) или открой через сайт, а не локальный файл."
    );
  } else if (!window.firebase) {
    showSetupScreen("Не загрузилась библиотека Firebase. Проверь интернет и отключи блокировщик рекламы на этой странице.");
  } else if (!initFirebase()) {
    showSetupScreen("Firebase не подключился. Проверь ключи в firebase-config.js и правила базы (Rules → Publish).");
  } else {
    showJoinScreen();
    initJoinForm();
    initRoomControls();
  }
})();
