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
  const CHAT_PIN_THRESHOLD = 48;
  let chatPinnedToBottom = true;
  let chatScrollRaf = null;

  function getChatBox() {
    return document.getElementById("chat-messages");
  }

  function isChatAtBottom() {
    const box = getChatBox();
    return box.scrollTop <= CHAT_PIN_THRESHOLD;
  }

  function pinChatToBottom() {
    const box = getChatBox();
    box.scrollTop = 0;
    chatPinnedToBottom = true;
    updateScrollBottomButton();
  }

  function updateScrollBottomButton() {
    const btn = document.getElementById("chat-scroll-bottom");
    if (!btn) return;
    const show = !isChatAtBottom();
    btn.hidden = !show;
    btn.classList.toggle("is-visible", show);
    chatPinnedToBottom = !show;
  }

  function scheduleScrollBottomCheck() {
    if (chatScrollRaf) return;
    chatScrollRaf = requestAnimationFrame(() => {
      chatScrollRaf = null;
      updateScrollBottomButton();
    });
  }

  function renderReactions(el, reactions) {
    let wrap = el.querySelector(".chat-msg-reactions");
    const hearts = reactions ? Object.keys(reactions).filter((uid) => reactions[uid]) : [];

    if (!hearts.length) {
      if (wrap) wrap.remove();
      return;
    }

    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "chat-msg-reactions";
      el.appendChild(wrap);
    }

    wrap.innerHTML = "";
    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = `chat-reaction${hearts.includes(myId) ? " is-mine" : ""}`;
    badge.dataset.action = "toggle-heart";
    badge.setAttribute("aria-label", "Сердечко");
    badge.innerHTML = `❤️ <span>${hearts.length}</span>`;
    wrap.appendChild(badge);
  }

  function showReactionPop(el) {
    const pop = document.createElement("span");
    pop.className = "chat-reaction-pop";
    pop.textContent = "❤️";
    el.appendChild(pop);
    pop.addEventListener("animationend", () => pop.remove());
  }

  function toggleHeart(msgKey, el) {
    if (!chatRef || !msgKey) return;
    const ref = chatRef.child(msgKey).child("reactions").child(myId);
    ref.transaction((current) => (current ? null : true));
    if (el) showReactionPop(el);
  }

  function bindMessageInteractions(el, key) {
    if (el.dataset.bound === "1") return;
    el.dataset.bound = "1";

    let lastTap = 0;

    el.addEventListener("click", (e) => {
      const reactionBtn = e.target.closest("[data-action='toggle-heart']");
      if (reactionBtn) {
        e.preventDefault();
        toggleHeart(key, el);
        return;
      }

      const now = Date.now();
      if (now - lastTap < 320) {
        e.preventDefault();
        toggleHeart(key, el);
        lastTap = 0;
        return;
      }
      lastTap = now;
    });
  }

  function buildChatMessageEl(data, key) {
    const el = document.createElement("div");
    el.dataset.key = key;

    if (data.system) {
      el.className = "chat-msg chat-msg-system";
      el.textContent = data.text;
      return el;
    }

    const isMe = data.name === myName;
    el.className = `chat-msg${isMe ? " is-me" : ""}`;
    el.innerHTML = `<div class="chat-msg-name">${escapeHtml(data.name)}</div><div class="chat-msg-body">${escapeHtml(data.text)}</div>`;
    renderReactions(el, data.reactions);
    bindMessageInteractions(el, key);
    return el;
  }

  function appendChatMessage(data, key, options = {}) {
    const box = getChatBox();
    const existing = box.querySelector(`[data-key="${key}"]`);
    if (existing) {
      renderReactions(existing, data.reactions);
      return;
    }

    const wasPinned = options.forcePin || chatPinnedToBottom || isChatAtBottom();
    const el = buildChatMessageEl(data, key);
    box.insertBefore(el, box.firstChild);

    if (wasPinned) {
      pinChatToBottom();
    } else {
      scheduleScrollBottomCheck();
    }
  }

  function updateChatMessage(key, data) {
    const box = getChatBox();
    const el = box.querySelector(`[data-key="${key}"]`);
    if (!el || data.system) return;
    renderReactions(el, data.reactions);
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
    pinChatToBottom();
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

    chatRef.on("child_changed", (snap) => {
      updateChatMessage(snap.key, snap.val());
    });

    const chatBox = getChatBox();
    chatBox.addEventListener("scroll", scheduleScrollBottomCheck, { passive: true });

    document.getElementById("chat-scroll-bottom").addEventListener("click", () => {
      pinChatToBottom();
    });

    pinChatToBottom();

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
      input.blur();
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
