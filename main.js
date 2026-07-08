(function () {
  "use strict";

  const content = SITE_CONTENT;
  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let heartTapCount = 0;
  let canvasArt = null;
  let artScrollTrigger = null;
  let artHasPlayed = false;
  let artReplayBusy = false;

  gsap.registerPlugin(ScrollTrigger);

  // ---- Viewport & Safari helpers ----
  function setViewportHeight() {
    document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
  }

  function initViewportFix() {
    setViewportHeight();
    window.addEventListener("resize", setViewportHeight);
    window.addEventListener("orientationchange", () => {
      setTimeout(setViewportHeight, 100);
    });

    if (isMobile) {
      const lockHorizontalScroll = () => {
        if (window.scrollX !== 0) {
          window.scrollTo(0, window.scrollY);
        }
      };
      window.addEventListener("scroll", lockHorizontalScroll, { passive: true });
      document.addEventListener("scroll", lockHorizontalScroll, { passive: true, capture: true });

      let startX = 0;
      let startY = 0;
      document.addEventListener(
        "touchstart",
        (e) => {
          if (e.touches.length === 1) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
          }
        },
        { passive: true }
      );

      document.addEventListener(
        "touchmove",
        (e) => {
          if (document.body.classList.contains("lightbox-open")) return;
          if (e.touches.length !== 1) return;
          const dx = Math.abs(e.touches[0].clientX - startX);
          const dy = Math.abs(e.touches[0].clientY - startY);
          if (dx > dy && dx > 8) {
            e.preventDefault();
          }
        },
        { passive: false }
      );
    }
  }

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        const id = link.getAttribute("href");
        if (!id || id === "#") return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // ---- Populate content ----
  function populateContent() {
    document.getElementById("intro-text").textContent = content.intro.text;
    document.getElementById("intro-hint").textContent = content.intro.hint;
    document.getElementById("hero-headline").textContent = content.hero.headline;
    document.getElementById("hero-subline").textContent = content.hero.subline;
    document.querySelector("#hero-cta span").textContent = content.hero.cta;
    document.getElementById("reasons-title").textContent = content.reasonsTitle;
    document.getElementById("notes-title").textContent = content.loveNotesTitle;
    document.getElementById("counter-title").textContent = content.counter.title;
    document.getElementById("counter-suffix").textContent = content.counter.suffix;
    document.getElementById("counter-label").textContent = content.counter.label;
    document.getElementById("closing-message").textContent = content.closing.message;
    document.getElementById("closing-btn").textContent = content.closing.buttonText;
    document.getElementById("closing-hidden").textContent = content.closing.hiddenMessage;

    document.getElementById("rituals-title").textContent = content.ritualsTitle;
    document.getElementById("art-title").textContent = content.artSection.title;
    document.getElementById("art-subtitle").textContent = content.artSection.subtitle;
    document.getElementById("art-label").textContent = content.artSection.label;
    document.getElementById("wishes-title").textContent = content.wishesTitle;

    document.getElementById("quiz-title").textContent = content.quizTitle;
    document.getElementById("quiz-intro").textContent = content.quizIntro;
    document.getElementById("jar-title").textContent = content.jarTitle;
    document.getElementById("jar-hint").textContent = content.jarHint;
    document.getElementById("jar-btn").textContent = content.jarButton;
    document.getElementById("hug-title").textContent = content.hugTitle;
    document.getElementById("hug-hint").textContent = content.hugHint;
    document.getElementById("hug-btn-text").textContent = content.hugHint;
    document.getElementById("hug-release").textContent = content.hugReleaseText;

    renderGallery();
    renderReasons();
    renderRituals();
    renderLoveNotes();
    renderWishes();
    initQuiz();
    initMap();
    updateDaysCounter();
  }

  function getDaysTogether() {
    const start = new Date(content.relationshipStart + "T00:00:00");
    const now = new Date();
    return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
  }

  function haversineKm(from, to) {
    const R = 6371;
    const dLat = ((to.lat - from.lat) * Math.PI) / 180;
    const dLon = ((to.lng - from.lng) * Math.PI) / 180;
    const lat1 = (from.lat * Math.PI) / 180;
    const lat2 = (to.lat * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.asin(Math.sqrt(a)));
  }

  function initMap() {
    if (!content.mapFrom || !content.mapTo) return;

    document.getElementById("map-title").textContent = content.mapTitle;
    document.getElementById("map-from-label").textContent = content.mapFrom.label;
    document.getElementById("map-to-label").textContent = content.mapTo.label;

    const km = haversineKm(content.mapFrom, content.mapTo);
    const days = getDaysTogether();

    document.getElementById("map-distance").textContent = `${km} ${content.mapDistanceSuffix}`;
    document.getElementById("map-days").textContent = `${content.mapDaysPrefix} ${days} ${content.mapDaysSuffix}`;

    const svg = document.getElementById("map-svg");
    const x1 = 310;
    const y1 = 52;
    const x2 = 90;
    const y2 = 168;
    const cx = 200;
    const cy = 90;

    svg.innerHTML = `
      <defs>
        <linearGradient id="mapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#d4847a"/>
          <stop offset="100%" stop-color="#c4956a"/>
        </linearGradient>
      </defs>
      <path class="map-path-bg" d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}" fill="none" stroke="#f0d4cc" stroke-width="3" stroke-dasharray="8 8" opacity="0.6"/>
      <path class="map-path-line" id="map-path-line" d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}" fill="none" stroke="url(#mapGrad)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="600" stroke-dashoffset="600"/>
      <circle cx="${x1}" cy="${y1}" r="10" fill="#faf6f2" stroke="#d4847a" stroke-width="2.5"/>
      <circle cx="${x1}" cy="${y1}" r="4" fill="#d4847a"/>
      <circle cx="${x2}" cy="${y2}" r="10" fill="#faf6f2" stroke="#c4956a" stroke-width="2.5"/>
      <circle cx="${x2}" cy="${y2}" r="4" fill="#c4956a"/>
      <text x="${x1}" y="${y1 - 16}" text-anchor="middle" class="map-svg-label">${content.mapFrom.short}</text>
      <text x="${x2}" y="${y2 + 24}" text-anchor="middle" class="map-svg-label">${content.mapTo.short}</text>
      <text x="200" y="115" text-anchor="middle" class="map-svg-heart">♥</text>
    `;

    ScrollTrigger.create({
      trigger: "#map",
      start: "top 75%",
      once: true,
      onEnter: () => {
        const line = document.getElementById("map-path-line");
        if (line) line.style.strokeDashoffset = "0";
      },
    });
  }

  function renderGallery() {
    const grid = document.getElementById("gallery-grid");
    grid.innerHTML = content.photos
      .map(
        (photo, i) => `
      <article class="photo-card" data-index="${i}">
        <div class="photo-frame">
          <button type="button" class="photo-open-btn" data-index="${i}" aria-label="Открыть фото: ${photo.caption}">
          <div class="photo-img-wrap">
            <img src="./images/${photo.file}" alt="${photo.caption}" loading="lazy" decoding="async"
              onload="this.classList.add('is-loaded'); this.nextElementSibling?.remove()"
              onerror="this.style.display='none'">
            <span class="photo-placeholder-icon" aria-hidden="true">♥</span>
          </div>
          </button>
          <div class="photo-caption">
            <p class="photo-caption-text">${photo.caption}</p>
            ${photo.date ? `<p class="photo-caption-date">${photo.date}</p>` : ""}
          </div>
        </div>
      </article>`
      )
      .join("");
  }

  function renderReasons() {
    document.getElementById("reasons-grid").innerHTML = content.reasons
      .map(
        (r) => `
      <article class="reason-card">
        <h3 class="reason-card-title">${r.title}</h3>
        <p class="reason-card-text">${r.text}</p>
      </article>`
      )
      .join("");
  }

  function renderRituals() {
    document.getElementById("rituals-grid").innerHTML = content.rituals
      .map(
        (r) => `
      <article class="ritual-card">
        <span class="ritual-icon" aria-hidden="true">${window.RITUAL_ICONS?.[r.icon] || ""}</span>
        <h3 class="ritual-title">${r.title}</h3>
        <p class="ritual-text">${r.text}</p>
      </article>`
      )
      .join("");
  }

  function renderWishes() {
    document.getElementById("wishes-list").innerHTML = content.wishes
      .map((w) => `<li class="wish-item"><span class="wish-bullet">✦</span>${w}</li>`)
      .join("");
  }

  function renderLoveNotes() {
    document.getElementById("notes-list").innerHTML = content.loveNotes
      .map(
        (note) => `
      <p class="love-note" data-animation="${note.animation}">${note.text}</p>`
      )
      .join("");
  }

  function updateDaysCounter() {
    document.getElementById("counter-number").textContent = getDaysTogether();
  }

  // ---- Lightbox ----
  let lightboxIndex = 0;

  function initLightbox() {
    const lb = document.getElementById("lightbox");
    const img = document.getElementById("lightbox-img");
    const caption = document.getElementById("lightbox-caption");
    const dateEl = document.getElementById("lightbox-date");
    const counter = document.getElementById("lightbox-counter");
    let touchStartX = 0;
    let touchDeltaX = 0;

    function show(index) {
      const photos = content.photos;
      lightboxIndex = ((index % photos.length) + photos.length) % photos.length;
      const p = photos[lightboxIndex];
      img.src = `./images/${p.file}`;
      img.alt = p.caption;
      caption.textContent = p.caption;
      dateEl.textContent = p.date || "";
      dateEl.hidden = !p.date;
      counter.textContent = `${lightboxIndex + 1} / ${photos.length}`;
      lb.classList.add("is-open");
      lb.setAttribute("aria-hidden", "false");
      document.body.classList.add("lightbox-open");
    }

    function close() {
      lb.classList.remove("is-open");
      lb.setAttribute("aria-hidden", "true");
      document.body.classList.remove("lightbox-open");
      img.src = "";
    }

    function next() {
      show(lightboxIndex + 1);
    }

    function prev() {
      show(lightboxIndex - 1);
    }

    document.getElementById("gallery-grid").addEventListener("click", (e) => {
      const btn = e.target.closest(".photo-open-btn");
      if (!btn) return;
      show(Number(btn.dataset.index));
    });

    document.getElementById("lightbox-close").addEventListener("click", close);
    document.getElementById("lightbox-next").addEventListener("click", next);
    document.getElementById("lightbox-prev").addEventListener("click", prev);

    lb.addEventListener("click", (e) => {
      if (e.target === lb) close();
    });

    document.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    });

    const stage = document.getElementById("lightbox-stage");
    stage.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.changedTouches[0].clientX;
        touchDeltaX = 0;
      },
      { passive: true }
    );
    stage.addEventListener(
      "touchmove",
      (e) => {
        touchDeltaX = e.changedTouches[0].clientX - touchStartX;
      },
      { passive: true }
    );
    stage.addEventListener("touchend", () => {
      if (Math.abs(touchDeltaX) > 50) {
        if (touchDeltaX < 0) next();
        else prev();
      }
      touchDeltaX = 0;
    });
  }

  function initScrollProgress() {
    const bar = document.getElementById("scroll-progress-bar");
    const update = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(100, (scrollTop / max) * 100) : 0;
      bar.style.width = `${pct}%`;
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  function initReadAgain() {
    const btn = document.getElementById("read-again-btn");
    btn.textContent = content.backToTopText || "Прочитать ещё раз ↑";
    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function initPWA() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
      });
    }
  }

  // ---- Ambient decorations ----
  const SHAPE_ICONS = {
    heart: "♥",
    star: "✦",
    candy: "🍬",
    tv: "📺",
    coffee: "☕",
    flower: "✿",
    bean: "●",
  };

  function createAmbientShapes(container, config) {
    if (!container) return;
    const types = config.types || ["heart", "star", "dot", "circle"];
    const count = config.count || 12;
    const opacity = config.opacity ?? 0.22 + Math.random() * 0.15;

    for (let i = 0; i < count; i++) {
      const type = types[i % types.length];
      const el = document.createElement("div");
      el.className = `float-shape float-shape--${type}`;
      el.style.left = `${5 + Math.random() * 90}%`;
      el.style.top = `${5 + Math.random() * 90}%`;
      el.style.opacity = String(opacity + (Math.random() * 0.12 - 0.06));
      const dur = 10 + Math.random() * 14;
      const anim = i % 3 === 0 ? "floatMedium" : "floatSlow";
      el.style.animation = `${anim} ${dur}s ease-in-out infinite`;
      el.style.animationDelay = `${Math.random() * 8}s`;

      if (SHAPE_ICONS[type]) el.textContent = SHAPE_ICONS[type];
      else if (type === "bean") {
        el.textContent = "●";
        el.style.color = "var(--caramel)";
        el.style.fontSize = "0.5rem";
      } else if (type === "circle") {
        const size = 50 + Math.random() * 120;
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
      } else if (type === "dot") {
        el.style.width = `${3 + Math.random() * 5}px`;
        el.style.height = el.style.width;
      }

      container.appendChild(el);
    }
  }

  function createSparkles(container, count) {
    if (!container) return;
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "sparkle-mote";
      el.style.left = `${Math.random() * 100}%`;
      el.style.top = `${Math.random() * 100}%`;
      el.style.animationDelay = `${Math.random() * 5}s`;
      el.style.animationDuration = `${3 + Math.random() * 4}s`;
      container.appendChild(el);
    }
  }

  function initAmbient() {
    createAmbientShapes(document.getElementById("ambient-global"), {
      types: ["circle", "dot", "heart", "flower", "star"],
      count: 18,
      opacity: 0.18,
    });

    createAmbientShapes(document.querySelector(".ambient-hero"), {
      types: ["heart", "star", "candy", "tv", "coffee", "flower", "dot"],
      count: 28,
      opacity: 0.28,
    });
    createSparkles(document.querySelector(".ambient-hero"), 25);

    createAmbientShapes(document.querySelector(".ambient-gallery"), {
      types: ["star", "dot", "heart", "flower", "coffee"],
      count: 22,
    });
    createSparkles(document.querySelector(".ambient-gallery"), 35);

    createAmbientShapes(document.querySelector(".ambient-reasons"), {
      types: ["heart", "dot", "candy", "coffee"],
      count: 18,
    });

    createAmbientShapes(document.querySelector(".ambient-rituals"), {
      types: ["candy", "tv", "heart", "coffee", "star"],
      count: 20,
    });

    createAmbientShapes(document.querySelector(".ambient-art"), {
      types: ["heart", "star", "circle", "flower"],
      count: 24,
    });
    createSparkles(document.querySelector(".ambient-art"), 20);

    createAmbientShapes(document.querySelector(".ambient-notes"), {
      types: ["heart", "star", "circle", "flower"],
      count: 22,
    });

    createAmbientShapes(document.querySelector(".ambient-counter"), {
      types: ["heart", "star", "dot"],
      count: 14,
    });

    createAmbientShapes(document.querySelector(".ambient-map"), {
      types: ["heart", "star", "flower", "dot"],
      count: 16,
    });
    createSparkles(document.querySelector(".ambient-map"), 12);

    createAmbientShapes(document.querySelector(".ambient-wishes"), {
      types: ["star", "heart", "dot", "flower"],
      count: 16,
    });

    createAmbientShapes(document.querySelector(".ambient-quiz"), {
      types: ["heart", "candy", "star"],
      count: 14,
    });

    createAmbientShapes(document.querySelector(".ambient-jar"), {
      types: ["heart", "flower", "dot", "star"],
      count: 16,
    });
    createSparkles(document.querySelector(".ambient-jar"), 15);

    createAmbientShapes(document.querySelector(".ambient-hug"), {
      types: ["heart", "circle", "flower"],
      count: 20,
    });

    createAmbientShapes(document.querySelector(".ambient-closing"), {
      types: ["heart", "star", "candy", "flower", "coffee"],
      count: 22,
    });
    createSparkles(document.querySelector(".ambient-closing"), 18);
  }

  // ---- Intro ----
  function initIntro() {
    const overlay = document.getElementById("intro-overlay");
    const main = document.getElementById("main-content");
    document.body.classList.add("intro-active");

    function enter() {
      overlay.classList.add("is-hidden");
      document.body.classList.remove("intro-active");
      main.hidden = false;

      gsap.from(".hero-headline", { opacity: 0, y: 30, duration: 1, ease: "power2.out", delay: 0.2 });
      gsap.from(".hero-subline", { opacity: 0, y: 20, duration: 0.9, ease: "power2.out", delay: 0.4 });
      gsap.from(".hero-cta", { opacity: 0, y: 15, duration: 0.8, ease: "power2.out", delay: 0.6 });
      gsap.from(".hero-heart-btn", { scale: 0, duration: 0.6, ease: "back.out(1.7)", delay: 0.3 });

      initScrollAnimations();
      setupArtScrollTrigger();
      ScrollTrigger.refresh();
    }

    overlay.addEventListener("click", enter, { once: true });
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        enter();
      }
    });
  }

  // ---- Scroll animations ----
  function initScrollAnimations() {
    const use3D = !isMobile && !isIOS;

    if (use3D) {
      gsap.utils.toArray(".section").forEach((section) => {
        const inner = section.querySelector(".section-inner");
        if (!inner) return;

        gsap.fromTo(
          inner,
          { rotateX: 6, z: -60, opacity: 0.7 },
          {
            rotateX: 0,
            z: 0,
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top 85%",
              end: "top 35%",
              scrub: 1.2,
            },
          }
        );

        const ambient = section.querySelector(".ambient");
        if (ambient) {
          gsap.to(ambient, {
            y: -50,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          });
        }
      });
    } else {
      gsap.utils.toArray(".section-inner").forEach((inner) => {
        gsap.from(inner, {
          opacity: 0,
          y: 36,
          scale: 0.98,
          duration: 0.85,
          ease: "power2.out",
          scrollTrigger: {
            trigger: inner,
            start: "top 88%",
            toggleActions: "play none none reverse",
          },
        });
      });
    }

    gsap.utils.toArray(".photo-card").forEach((card, i) => {
      const frame = card.querySelector(".photo-frame");
      const rot = i % 2 === 0 ? -3 : 3;

      if (!use3D) {
        gsap.from(card, {
          opacity: 0,
          y: 40,
          rotate: rot * 0.4,
          duration: 0.75,
          ease: "power2.out",
          scrollTrigger: { trigger: card, start: "top 92%", toggleActions: "play none none reverse" },
        });
      } else {
        gsap.fromTo(
          frame,
          { rotateY: rot, rotateX: 8, z: -80, opacity: 0 },
          {
            rotateY: 0,
            rotateX: 0,
            z: 0,
            opacity: 1,
            ease: "power2.out",
            scrollTrigger: { trigger: card, start: "top 88%", end: "top 45%", scrub: 1 },
          }
        );

        card.addEventListener("mousemove", (e) => {
          const rect = card.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width - 0.5;
          const y = (e.clientY - rect.top) / rect.height - 0.5;
          gsap.to(frame, { rotateY: x * 10, rotateX: -y * 10, duration: 0.4, ease: "power2.out" });
        });
        card.addEventListener("mouseleave", () => {
          gsap.to(frame, { rotateY: 0, rotateX: 0, duration: 0.6, ease: "power2.out" });
        });
      }
    });

    [
      { sel: ".reason-card", trigger: "#reasons-grid" },
      { sel: ".ritual-card", trigger: "#rituals-grid" },
      { sel: ".wish-item", trigger: "#wishes-list" },
      { sel: ".map-card", trigger: "#map" },
      { sel: ".quiz-card", trigger: "#quiz-card" },
      { sel: ".jar-inner", trigger: "#jar" },
      { sel: ".hug-inner", trigger: "#hug" },
    ].forEach(({ sel, trigger }) => {
      gsap.from(sel, {
        opacity: 0,
        y: 40,
        stagger: 0.1,
        duration: 0.75,
        ease: "power2.out",
        scrollTrigger: { trigger, start: "top 82%", toggleActions: "play none none reverse" },
      });
    });

    document.querySelectorAll(".love-note").forEach((note) => {
      const type = note.dataset.animation;
      const trigger = { trigger: note, start: "top 85%", toggleActions: "play none none reverse" };

      const anims = {
        flip: { opacity: 0, rotateX: use3D ? 60 : 0, y: 30, duration: 0.9 },
        rise: { opacity: 0, y: 60, scale: 0.9, duration: 1 },
        unfurl: { opacity: 0, scaleX: 0.3, transformOrigin: "center center", duration: 1 },
        "fade-scale": { opacity: 0, scale: 0.5, duration: 0.9, ease: "back.out(1.4)" },
        "slide-left": { opacity: 0, x: isMobile ? 0 : 80, duration: 0.9 },
        "rotate-in": { opacity: 0, rotation: use3D ? -10 : 0, scale: 0.85, duration: 1 },
      };

      gsap.from(note, { ...(anims[type] || { opacity: 0, y: 40, duration: 0.8 }), ease: "power2.out", scrollTrigger: trigger });
    });

    gsap.from(".counter-number", {
      opacity: 0,
      scale: 0.5,
      duration: 1.2,
      ease: "back.out(1.5)",
      scrollTrigger: { trigger: "#counter", start: "top 75%", toggleActions: "play none none reverse" },
    });

    gsap.from(".closing-message", {
      opacity: 0,
      y: 30,
      duration: 1,
      scrollTrigger: { trigger: "#closing", start: "top 80%", toggleActions: "play none none reverse" },
    });
  }

  // ---- Canvas art (reliable replay) ----
  function initCanvasArt() {
    const canvas = document.getElementById("love-canvas");
    const replayBtn = document.getElementById("art-replay-btn");
    if (!canvas || !window.LoveCanvasArt || !replayBtn) return;

    canvasArt = new LoveCanvasArt(canvas);

    replayBtn.addEventListener("click", async () => {
      if (artReplayBusy) return;
      artReplayBusy = true;
      replayBtn.disabled = true;
      replayBtn.classList.add("is-busy");

      canvasArt.reset();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await canvasArt.play();

      replayBtn.disabled = false;
      replayBtn.classList.remove("is-busy");
      artReplayBusy = false;
    });
  }

  function setupArtScrollTrigger() {
    if (!canvasArt || artHasPlayed) return;

    if (artScrollTrigger) artScrollTrigger.kill();

    artScrollTrigger = ScrollTrigger.create({
      trigger: "#art",
      start: "top 75%",
      once: true,
      onEnter: async () => {
        if (artHasPlayed || artReplayBusy) return;
        artHasPlayed = true;
        artReplayBusy = true;
        await canvasArt.play();
        artReplayBusy = false;
      },
    });
  }

  // ---- Quiz ----
  function initQuiz() {
    const card = document.getElementById("quiz-card");
    let step = 0;
    let score = 0;

    function render() {
      if (step >= content.quizQuestions.length) {
        card.innerHTML = `
          <div class="quiz-result">
            <p class="quiz-result-text">${content.quizResult}</p>
            <button class="quiz-restart" type="button">Пройти ещё раз</button>
          </div>`;
        card.querySelector(".quiz-restart").addEventListener("click", () => {
          step = 0;
          score = 0;
          render();
        });
        return;
      }

      const q = content.quizQuestions[step];
      card.innerHTML = `
        <p class="quiz-progress">Вопрос ${step + 1} из ${content.quizQuestions.length}</p>
        <h3 class="quiz-question">${q.question}</h3>
        <div class="quiz-options">
          ${q.options
            .map(
              (opt, i) =>
                `<button class="quiz-option" type="button" data-index="${i}">${opt}</button>`
            )
            .join("")}
        </div>`;

      card.querySelectorAll(".quiz-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (card.classList.contains("is-answered")) return;
          card.classList.add("is-answered");
          const idx = Number(btn.dataset.index);
          if (idx === q.correct) {
            btn.classList.add("is-correct");
            score++;
          } else {
            btn.classList.add("is-wrong");
            card.querySelectorAll(".quiz-option")[q.correct].classList.add("is-correct");
          }
          setTimeout(() => {
            step++;
            card.classList.remove("is-answered");
            render();
          }, 700);
        });
      });
    }

    render();
  }

  // ---- Message jar ----
  function initJar() {
    const btn = document.getElementById("jar-btn");
    const msgEl = document.getElementById("jar-message");
    const display = document.getElementById("jar-display");
    const JAR_KEY = "for-katya-jar-last-index";
    let lastIndex = parseInt(localStorage.getItem(JAR_KEY) || "-1", 10);
    if (Number.isNaN(lastIndex)) lastIndex = -1;

    btn.addEventListener("click", () => {
      const pool = content.jarMessages;
      let idx;
      let attempts = 0;
      do {
        idx = Math.floor(Math.random() * pool.length);
        attempts++;
      } while (pool.length > 1 && idx === lastIndex && attempts < 20);
      lastIndex = idx;
      localStorage.setItem(JAR_KEY, String(idx));

      display.classList.remove("is-revealing");
      void display.offsetWidth;
      display.classList.add("is-revealing");
      msgEl.textContent = pool[idx];
    });
  }

  // ---- Virtual hug ----
  function initHug() {
    const btn = document.getElementById("hug-btn");
    const glow = document.getElementById("hug-glow");
    const heartsLayer = document.getElementById("hug-hearts");
    const btnText = document.getElementById("hug-btn-text");
    let holdInterval = null;
    let heartInterval = null;

    function spawnHeart() {
      const h = document.createElement("span");
      h.className = "hug-float-heart";
      h.textContent = "♥";
      h.style.left = `${20 + Math.random() * 60}%`;
      h.style.animationDuration = `${1.5 + Math.random() * 1.5}s`;
      heartsLayer.appendChild(h);
      setTimeout(() => h.remove(), 3000);
    }

    function startHug() {
      btn.classList.add("is-holding");
      glow.classList.add("is-active");
      btnText.textContent = content.hugActiveText;
      heartInterval = setInterval(spawnHeart, 280);
    }

    function stopHug() {
      btn.classList.remove("is-holding");
      glow.classList.remove("is-active");
      btnText.textContent = content.hugHint;
      clearInterval(heartInterval);
      heartInterval = null;
    }

    btn.addEventListener("mousedown", startHug);
    btn.addEventListener("mouseup", stopHug);
    btn.addEventListener("mouseleave", stopHug);
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      startHug();
    }, { passive: false });
    btn.addEventListener("touchend", stopHug);
    btn.addEventListener("touchcancel", stopHug);
  }

  // ---- Easter eggs ----
  function showToast(message) {
    const toast = document.getElementById("easter-toast");
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add("is-visible");
    setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => { toast.hidden = true; }, 500);
    }, 3500);
  }

  function burstConfetti() {
    const layer = document.getElementById("confetti-layer");
    const colors = ["#e8a598", "#d4847a", "#c4956a", "#f0d4cc", "#3d2314"];
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.top = "-10px";
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = `${1.5 + Math.random() * 2}s`;
      piece.style.animationDelay = `${Math.random() * 0.5}s`;
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), 4000);
    }
  }

  function initEasterEggs() {
    document.getElementById("hero-heart-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      heartTapCount++;
      gsap.to(e.currentTarget, { scale: 1.3, duration: 0.15, yoyo: true, repeat: 1 });
      if (heartTapCount >= 5) {
        showToast(content.easterEggs.heartMessage);
        heartTapCount = 0;
      }
    });

    const konami = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
    let konamiIndex = 0;
    document.addEventListener("keydown", (e) => {
      if (e.key === konami[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konami.length) {
          burstConfetti();
          showToast(content.easterEggs.konamiMessage);
          konamiIndex = 0;
        }
      } else {
        konamiIndex = 0;
      }
    });

    document.getElementById("candy-easter").addEventListener("click", () => {
      showToast(content.easterEggs.candyMessage);
      gsap.from("#candy-easter", { rotation: 360, scale: 1.4, duration: 0.6, ease: "back.out(1.7)" });
    });

    document.getElementById("closing-btn").addEventListener("click", () => {
      const hidden = document.getElementById("closing-hidden");
      hidden.hidden = false;
      gsap.from(hidden, { opacity: 0, y: 20, scale: 0.95, duration: 0.8, ease: "power2.out" });
      document.getElementById("closing-btn").style.display = "none";
    });
  }

  // ---- Init ----
  initViewportFix();
  initSmoothScroll();
  populateContent();

  const candyBtn = document.getElementById("candy-easter");
  if (candyBtn && window.CANDY_ICON) candyBtn.innerHTML = window.CANDY_ICON;

  initAmbient();
  initIntro();
  initCanvasArt();
  initLightbox();
  initScrollProgress();
  initReadAgain();
  initPWA();
  initJar();
  initHug();
  initEasterEggs();
})();
