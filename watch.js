(function () {
  "use strict";

  const SYNC_THRESHOLD = 2;
  const SEEK_DEBOUNCE_MS = 400;
  const SUPPRESS_SYNC_MS = 700;
  const HEART_SVG =
    '<svg class="heart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.7-4.35-9.2-8.3C.9 9.5 2.2 5.8 5.6 4.6c2-.7 4.1.2 5.4 1.9 1.3-1.7 3.4-2.6 5.4-1.9 3.4 1.2 4.7 4.9 2.8 8.1C18.7 16.65 12 21 12 21z"/></svg>';

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
  let suppressSyncTimer = null;
  let seekDebounceTimer = null;
  let lastBroadcastTime = 0;
  let ytApiReady = false;
  let pendingVideoId = null;
  let playbackRef = null;
  let chatRef = null;
  let pendingRemotePlayback = null;
  let replyTo = null;
  let pipActive = false;
  let miniPlayerActive = false;

  const isMobile = () => window.matchMedia("(max-width: 900px)").matches;

  function getFirebaseConfig() {
    return window.FIREBASE_CONFIG || (typeof FIREBASE_CONFIG !== "undefined" ? FIREBASE_CONFIG : null);
  }

  function getRoomDefaults() {
    return window.WATCH_ROOM_DEFAULT || (typeof WATCH_ROOM_DEFAULT !== "undefined" ? WATCH_ROOM_DEFAULT : null);
  }

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

  function setSuppressSync(ms = SUPPRESS_SYNC_MS) {
    suppressSync = true;
    clearTimeout(suppressSyncTimer);
    suppressSyncTimer = setTimeout(() => {
      suppressSync = false;
    }, ms);
  }

  function clearSeekTimer() {
    clearTimeout(seekDebounceTimer);
    seekDebounceTimer = null;
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
          initMediaSession();
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
      broadcastPlaybackState(true);
    }
  }

  function onPlayerStateChange(event) {
    if (suppressSync || !playbackRef) return;

    const state = event.data;
    if (state === YT.PlayerState.PLAYING) {
      broadcastPlaybackState(true);
    } else if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED) {
      clearSeekTimer();
      broadcastPlaybackState(false);
    }
    updateMediaSessionState(state);
  }

  function broadcastPlaybackState(playing) {
    if (!player || !player.getCurrentTime || suppressSync || !playbackRef) return;

    const now = Date.now();
    if (now - lastBroadcastTime < 120) return;
    lastBroadcastTime = now;

    playbackRef.set({
      videoId: currentVideoId,
      playing: !!playing,
      time: player.getCurrentTime() || 0,
      updatedAt: now,
      by: myId,
      intent: "state",
    });
  }

  function broadcastTimeSync() {
    if (!player || !player.getCurrentTime || suppressSync || !playbackRef) return;
    if (player.getPlayerState() !== YT.PlayerState.PLAYING) return;

    const now = Date.now();
    if (now - lastBroadcastTime < 120) return;
    lastBroadcastTime = now;

    playbackRef.update({
      time: player.getCurrentTime() || 0,
      updatedAt: now,
      by: myId,
      intent: "seek",
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

    const isSeekOnly = data.intent === "seek";
    setSuppressSync();

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

    if (!isSeekOnly) {
      if (data.playing) {
        if (player.getPlayerState() !== YT.PlayerState.PLAYING) {
          player.playVideo();
        }
      } else if (player.getPlayerState() === YT.PlayerState.PLAYING) {
        player.pauseVideo();
      }
    }

    setTimeout(() => {
      document.getElementById("sync-dot").classList.remove("is-syncing");
    }, 400);
  }

  function startSeekPolling() {
    setInterval(() => {
      if (suppressSync || !player || !player.getCurrentTime) return;
      if (player.getPlayerState() !== YT.PlayerState.PLAYING) return;
      clearSeekTimer();
      seekDebounceTimer = setTimeout(() => {
        if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
          broadcastTimeSync();
        }
      }, SEEK_DEBOUNCE_MS);
    }, 800);
  }

  // ---- Media Session & mini player ----
  function initMediaSession() {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => player?.playVideo());
    navigator.mediaSession.setActionHandler("pause", () => player?.pauseVideo());
    updateMediaSessionState(player?.getPlayerState?.());
  }

  function updateMediaSessionState(state) {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState =
      state === YT.PlayerState.PLAYING ? "playing" : "paused";
  }

  function setMiniPlayer(active) {
    const wrap = document.querySelector(".player-wrap");
    if (!wrap) return;

    if (active && !miniPlayerActive) {
      let ph = document.getElementById("player-mini-placeholder");
      if (!ph) {
        ph = document.createElement("div");
        ph.id = "player-mini-placeholder";
        ph.className = "player-pip-placeholder";
        wrap.parentNode.insertBefore(ph, wrap);
      }
    } else if (!active) {
      document.getElementById("player-mini-placeholder")?.remove();
    }

    miniPlayerActive = active;
    wrap.classList.toggle("is-mini", active);
    document.body.classList.toggle("has-mini-player", active);
  }

  async function tryDocumentPiP() {
    if (!window.documentPictureInPicture || pipActive || !player) return false;
    try {
      const pipWindow = await documentPictureInPicture.requestWindow({
        width: 360,
        height: 202,
      });
      pipActive = true;
      const wrap = document.querySelector(".player-wrap");
      const placeholder = document.createElement("div");
      placeholder.className = "player-pip-placeholder";
      placeholder.id = "player-pip-placeholder";
      wrap.parentNode.insertBefore(placeholder, wrap);

      const style = pipWindow.document.createElement("style");
      style.textContent = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #1a1008; overflow: hidden; }
        .player-wrap { width: 100vw; height: 100vh; }
        iframe { width: 100%; height: 100%; border: 0; }
      `;
      pipWindow.document.head.appendChild(style);
      pipWindow.document.body.appendChild(wrap);

      pipWindow.addEventListener("pagehide", () => {
        pipActive = false;
        const ph = document.getElementById("player-pip-placeholder");
        if (ph && ph.parentNode) {
          ph.parentNode.replaceChild(wrap, ph);
        }
      });
      return true;
    } catch {
      pipActive = false;
      return false;
    }
  }

  function initMiniPlayer() {
    const btn = document.getElementById("mini-player-btn");
    if (btn) {
      btn.addEventListener("click", async () => {
        if (miniPlayerActive) {
          setMiniPlayer(false);
          return;
        }
        const pipOk = await tryDocumentPiP();
        if (!pipOk) setMiniPlayer(true);
      });
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && player?.getPlayerState?.() === YT.PlayerState.PLAYING) {
        tryDocumentPiP().then((ok) => {
          if (!ok && isMobile()) setMiniPlayer(true);
        });
      }
    });

    if (isMobile()) {
      const chatInput = document.getElementById("chat-input");
      chatInput?.addEventListener("focus", () => setMiniPlayer(true), { passive: true });
    }

    initMiniPlayerDrag();
  }

  function initMiniPlayerDrag() {
    const wrap = document.querySelector(".player-wrap");
    if (!wrap) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onStart = (e) => {
      if (!miniPlayerActive) return;
      const point = e.touches ? e.touches[0] : e;
      dragging = true;
      startX = point.clientX;
      startY = point.clientY;
      const rect = wrap.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      wrap.style.left = `${startLeft}px`;
      wrap.style.top = `${startTop}px`;
      wrap.style.right = "auto";
      wrap.style.bottom = "auto";
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!dragging) return;
      const point = e.touches ? e.touches[0] : e;
      const dx = point.clientX - startX;
      const dy = point.clientY - startY;
      wrap.style.left = `${startLeft + dx}px`;
      wrap.style.top = `${startTop + dy}px`;
    };

    const onEnd = () => {
      dragging = false;
    };

    wrap.addEventListener("mousedown", onStart);
    wrap.addEventListener("touchstart", onStart, { passive: false });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchend", onEnd);
  }

  // ---- Chat ----
  const CHAT_PIN_THRESHOLD = 48;
  let chatPinnedToBottom = true;
  let chatScrollRaf = null;

  function getChatBox() {
    return document.getElementById("chat-messages");
  }

  function getChatInput() {
    return document.getElementById("chat-input");
  }

  function focusChatInput() {
    const input = getChatInput();
    if (input) input.focus({ preventScroll: true });
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

  function truncateText(str, max = 80) {
    const s = (str || "").trim();
    return s.length > max ? `${s.slice(0, max)}…` : s;
  }

  function renderReplyQuote(reply) {
    if (!reply) return "";
    return `<div class="chat-msg-reply"><span class="chat-msg-reply-name">${escapeHtml(reply.name)}</span>${escapeHtml(truncateText(reply.text, 100))}</div>`;
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

    const mine = hearts.includes(myId);
    wrap.innerHTML = `<button type="button" class="chat-reaction${mine ? " is-mine" : ""}" data-action="toggle-heart" aria-label="Сердечко">${HEART_SVG}<span class="chat-reaction-count">${hearts.length}</span></button>`;
  }

  function showReactionPop(el) {
    const pop = document.createElement("span");
    pop.className = "chat-reaction-pop";
    pop.innerHTML = HEART_SVG;
    el.appendChild(pop);
    pop.addEventListener("animationend", () => pop.remove());
  }

  function toggleHeart(msgKey, el) {
    if (!chatRef || !msgKey) return;
    const ref = chatRef.child(msgKey).child("reactions").child(myId);
    ref.transaction((current) => (current ? null : true));
    if (el) showReactionPop(el);
  }

  function setReplyTarget(key, name, text) {
    replyTo = { key, name, text: truncateText(text, 120) };
    const bar = document.getElementById("chat-reply-bar");
    const label = document.getElementById("chat-reply-label");
    if (bar && label) {
      label.textContent = `${name}: ${replyTo.text}`;
      bar.hidden = false;
    }
    focusChatInput();
  }

  function clearReply() {
    replyTo = null;
    const bar = document.getElementById("chat-reply-bar");
    if (bar) bar.hidden = true;
  }

  function bindMessageInteractions(el, key, data) {
    if (el.dataset.bound === "1") return;
    el.dataset.bound = "1";

    let lastTap = 0;
    let longPressTimer = null;
    let longPressTriggered = false;

    const startLongPress = () => {
      longPressTriggered = false;
      longPressTimer = setTimeout(() => {
        longPressTriggered = true;
        el.classList.add("is-reply-highlight");
        setReplyTarget(key, data.name, data.text);
        setTimeout(() => el.classList.remove("is-reply-highlight"), 400);
      }, 480);
    };

    const cancelLongPress = () => {
      clearTimeout(longPressTimer);
    };

    el.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.target.closest("[data-action]")) return;
      startLongPress();
    });
    el.addEventListener("mouseup", cancelLongPress);
    el.addEventListener("mouseleave", cancelLongPress);

    el.addEventListener("touchstart", (e) => {
      if (e.target.closest("[data-action]")) return;
      startLongPress();
    }, { passive: true });
    el.addEventListener("touchend", cancelLongPress);
    el.addEventListener("touchcancel", cancelLongPress);

    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      setReplyTarget(key, data.name, data.text);
    });

    el.addEventListener("click", (e) => {
      if (longPressTriggered) {
        e.preventDefault();
        return;
      }

      const reactionBtn = e.target.closest("[data-action='toggle-heart']");
      if (reactionBtn) {
        e.preventDefault();
        toggleHeart(key, el);
        return;
      }

      const replyBtn = e.target.closest("[data-action='reply']");
      if (replyBtn) {
        e.preventDefault();
        setReplyTarget(key, data.name, data.text);
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
    el.innerHTML = `
      <button type="button" class="chat-msg-reply-btn" data-action="reply" aria-label="Ответить">↩</button>
      <div class="chat-msg-name">${escapeHtml(data.name)}</div>
      ${renderReplyQuote(data.replyTo)}
      <div class="chat-msg-body">${escapeHtml(data.text)}</div>
    `;
    renderReactions(el, data.reactions);
    bindMessageInteractions(el, key, data);
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
    el.classList.add("chat-msg-enter");
    box.insertBefore(el, box.firstChild);
    requestAnimationFrame(() => el.classList.add("is-visible"));

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
    const payload = {
      name: myName,
      text: text.trim(),
      ts: Date.now(),
    };
    if (replyTo) {
      payload.replyTo = { ...replyTo };
    }
    chatRef.push(payload);
    clearReply();
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

  function initChatFocus() {
    const section = document.querySelector(".room-chat-section");
    const form = document.getElementById("chat-form");

    section?.addEventListener("mousedown", (e) => {
      if (e.target.closest(".chat-msg") || e.target.closest("button")) return;
      if (e.target.closest("#chat-input")) return;
      focusChatInput();
    });

    form?.addEventListener("click", (e) => {
      if (!e.target.closest("#chat-input") && !e.target.closest(".btn-chat-send")) {
        focusChatInput();
      }
    });

    document.getElementById("chat-reply-cancel")?.addEventListener("click", clearReply);
  }

  function initVisualViewport() {
    if (!window.visualViewport) return;
    const chatSection = document.querySelector(".room-chat-section");
    if (!chatSection) return;

    const update = () => {
      if (!isMobile()) {
        chatSection.style.transform = "";
        return;
      }
      const vv = window.visualViewport;
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      chatSection.style.transform = offset > 0 ? `translateY(-${offset}px)` : "";
    };

    window.visualViewport.addEventListener("resize", update);
    window.visualViewport.addEventListener("scroll", update);
    update();
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
    initChatFocus();
    initVisualViewport();
    initMiniPlayer();

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
      const input = getChatInput();
      sendChat(input.value);
      input.value = "";
      focusChatInput();
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
