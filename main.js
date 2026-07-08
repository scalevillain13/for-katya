(function () {
  "use strict";

  const content = SITE_CONTENT;
  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  let heartTapCount = 0;

  gsap.registerPlugin(ScrollTrigger);

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

    renderGallery();
    renderReasons();
    renderLoveNotes();
    updateDaysCounter();
  }

  function renderGallery() {
    const grid = document.getElementById("gallery-grid");
    grid.innerHTML = content.photos
      .map(
        (photo, i) => `
      <article class="photo-card" data-index="${i}">
        <div class="photo-frame">
          <div class="photo-img-wrap">
            <img src="./images/${photo.file}" alt="${photo.caption}" loading="lazy"
              onload="this.classList.add('is-loaded'); this.nextElementSibling?.remove()"
              onerror="this.style.display='none'">
            <span class="photo-placeholder-icon" aria-hidden="true">♥</span>
          </div>
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
    const grid = document.getElementById("reasons-grid");
    grid.innerHTML = content.reasons
      .map(
        (r) => `
      <article class="reason-card">
        <h3 class="reason-card-title">${r.title}</h3>
        <p class="reason-card-text">${r.text}</p>
      </article>`
      )
      .join("");
  }

  function renderLoveNotes() {
    const list = document.getElementById("notes-list");
    list.innerHTML = content.loveNotes
      .map(
        (note) => `
      <p class="love-note" data-animation="${note.animation}">${note.text}</p>`
      )
      .join("");
  }

  function updateDaysCounter() {
    const start = new Date(content.relationshipStart + "T00:00:00");
    const now = new Date();
    const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    document.getElementById("counter-number").textContent = Math.max(0, diff);
  }

  // ---- Ambient decorations ----
  function createAmbientShapes(container, config) {
    const types = config.types || ["heart", "star", "dot", "circle"];
    const count = config.count || 12;

    for (let i = 0; i < count; i++) {
      const type = types[i % types.length];
      const el = document.createElement("div");
      el.className = `float-shape float-shape--${type}`;
      el.style.left = `${Math.random() * 100}%`;
      el.style.top = `${Math.random() * 100}%`;
      el.style.animation = `floatSlow ${8 + Math.random() * 8}s ease-in-out infinite`;
      el.style.animationDelay = `${Math.random() * 5}s`;

      if (type === "heart") el.textContent = "♥";
      else if (type === "star") el.textContent = "✦";
      else if (type === "candy") el.textContent = "🍬";
      else if (type === "tv") el.textContent = "📺";
      else if (type === "circle") {
        const size = 40 + Math.random() * 80;
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
      }

      container.appendChild(el);
    }
  }

  function createSparkles(container, count) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "sparkle-mote";
      el.style.left = `${Math.random() * 100}%`;
      el.style.top = `${Math.random() * 100}%`;
      el.style.animationDelay = `${Math.random() * 4}s`;
      container.appendChild(el);
    }
  }

  function initAmbient() {
    createAmbientShapes(document.getElementById("ambient-global"), {
      types: ["circle", "dot", "heart"],
      count: 8,
    });

    createAmbientShapes(document.querySelector(".ambient-hero"), {
      types: ["heart", "star", "candy", "tv", "dot"],
      count: 16,
    });

    createAmbientShapes(document.querySelector(".ambient-gallery"), {
      types: ["star", "dot", "heart"],
      count: 10,
    });
    createSparkles(document.querySelector(".ambient-gallery"), 20);

    createAmbientShapes(document.querySelector(".ambient-reasons"), {
      types: ["heart", "dot", "candy"],
      count: 8,
    });

    createAmbientShapes(document.querySelector(".ambient-notes"), {
      types: ["heart", "star", "circle"],
      count: 12,
    });

    createAmbientShapes(document.querySelector(".ambient-counter"), {
      types: ["heart", "star"],
      count: 6,
    });

    createAmbientShapes(document.querySelector(".ambient-closing"), {
      types: ["heart", "star", "candy"],
      count: 10,
    });
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

      gsap.from(".hero-headline", {
        opacity: 0,
        y: 30,
        duration: 1,
        ease: "power2.out",
        delay: 0.2,
      });
      gsap.from(".hero-subline", {
        opacity: 0,
        y: 20,
        duration: 0.9,
        ease: "power2.out",
        delay: 0.4,
      });
      gsap.from(".hero-cta", {
        opacity: 0,
        y: 15,
        duration: 0.8,
        ease: "power2.out",
        delay: 0.6,
      });
      gsap.from(".hero-heart-btn", {
        scale: 0,
        duration: 0.6,
        ease: "back.out(1.7)",
        delay: 0.3,
      });

      initScrollAnimations();
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
    // Section 3D parallax (desktop)
    if (!isMobile) {
      gsap.utils.toArray(".section").forEach((section) => {
        const inner = section.querySelector(".section-inner");
        if (!inner) return;

        gsap.fromTo(
          inner,
          { rotateX: 8, z: -80, opacity: 0.6 },
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
            y: -60,
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
          y: 40,
          scale: 0.97,
          duration: 0.9,
          ease: "power2.out",
          scrollTrigger: {
            trigger: inner,
            start: "top 88%",
            toggleActions: "play none none reverse",
          },
        });
      });
    }

    // Gallery cards
    gsap.utils.toArray(".photo-card").forEach((card, i) => {
      const frame = card.querySelector(".photo-frame");
      const rot = i % 2 === 0 ? -4 : 4;

      if (isMobile) {
        gsap.from(card, {
          opacity: 0,
          y: 50,
          rotate: rot * 0.5,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: card,
            start: "top 90%",
            toggleActions: "play none none reverse",
          },
        });
      } else {
        gsap.fromTo(
          frame,
          { rotateY: rot, rotateX: 12, z: -100, opacity: 0 },
          {
            rotateY: 0,
            rotateX: 0,
            z: 0,
            opacity: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: card,
              start: "top 88%",
              end: "top 45%",
              scrub: 1,
            },
          }
        );

        // Cursor tilt
        card.addEventListener("mousemove", (e) => {
          const rect = card.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width - 0.5;
          const y = (e.clientY - rect.top) / rect.height - 0.5;
          gsap.to(frame, {
            rotateY: x * 12,
            rotateX: -y * 12,
            duration: 0.4,
            ease: "power2.out",
          });
        });

        card.addEventListener("mouseleave", () => {
          gsap.to(frame, {
            rotateY: 0,
            rotateX: 0,
            duration: 0.6,
            ease: "power2.out",
          });
        });
      }
    });

    // Reason cards stagger
    gsap.from(".reason-card", {
      opacity: 0,
      y: 40,
      rotateX: isMobile ? 0 : 15,
      stagger: 0.1,
      duration: 0.7,
      ease: "power2.out",
      scrollTrigger: {
        trigger: "#reasons-grid",
        start: "top 80%",
        toggleActions: "play none none reverse",
      },
    });

    // Love notes — varied entrances
    document.querySelectorAll(".love-note").forEach((note) => {
      const type = note.dataset.animation;
      const trigger = {
        trigger: note,
        start: "top 85%",
        toggleActions: "play none none reverse",
      };

      switch (type) {
        case "flip":
          gsap.from(note, {
            opacity: 0,
            rotateX: isMobile ? 0 : 90,
            y: 30,
            duration: 0.9,
            ease: "power2.out",
            scrollTrigger: trigger,
          });
          break;
        case "rise":
          gsap.from(note, {
            opacity: 0,
            y: 80,
            scale: 0.85,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: trigger,
          });
          break;
        case "unfurl":
          gsap.from(note, {
            opacity: 0,
            scaleX: 0.3,
            transformOrigin: "center center",
            duration: 1,
            ease: "power2.out",
            scrollTrigger: trigger,
          });
          break;
        case "fade-scale":
          gsap.from(note, {
            opacity: 0,
            scale: 0.5,
            duration: 0.9,
            ease: "back.out(1.4)",
            scrollTrigger: trigger,
          });
          break;
        case "slide-left":
          gsap.from(note, {
            opacity: 0,
            x: isMobile ? 40 : 120,
            rotate: isMobile ? 0 : -5,
            duration: 0.9,
            ease: "power2.out",
            scrollTrigger: trigger,
          });
          break;
        case "rotate-in":
          gsap.from(note, {
            opacity: 0,
            rotation: isMobile ? 0 : -15,
            scale: 0.8,
            duration: 1,
            ease: "power2.out",
            scrollTrigger: trigger,
          });
          break;
        default:
          gsap.from(note, {
            opacity: 0,
            y: 40,
            duration: 0.8,
            scrollTrigger: trigger,
          });
      }
    });

    // Counter
    gsap.from(".counter-number", {
      opacity: 0,
      scale: 0.5,
      duration: 1.2,
      ease: "back.out(1.5)",
      scrollTrigger: {
        trigger: "#counter",
        start: "top 75%",
        toggleActions: "play none none reverse",
      },
    });

    // Closing
    gsap.from(".closing-message", {
      opacity: 0,
      y: 30,
      duration: 1,
      scrollTrigger: {
        trigger: "#closing",
        start: "top 80%",
        toggleActions: "play none none reverse",
      },
    });
  }

  // ---- Easter eggs ----
  function showToast(message) {
    const toast = document.getElementById("easter-toast");
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add("is-visible");
    setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => {
        toast.hidden = true;
      }, 500);
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
    // 5 taps on hero heart
    document.getElementById("hero-heart-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      heartTapCount++;
      gsap.to(e.currentTarget, {
        scale: 1.3,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
      });
      if (heartTapCount >= 5) {
        showToast(content.easterEggs.heartMessage);
        heartTapCount = 0;
      }
    });

    // Konami code
    const konami = [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "b",
      "a",
    ];
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

    // Candy click
    document.getElementById("candy-easter").addEventListener("click", () => {
      showToast(content.easterEggs.candyMessage);
      gsap.from("#candy-easter", {
        rotation: 360,
        scale: 1.4,
        duration: 0.6,
        ease: "back.out(1.7)",
      });
    });

    // Closing hidden message
    document.getElementById("closing-btn").addEventListener("click", () => {
      const hidden = document.getElementById("closing-hidden");
      hidden.hidden = false;
      gsap.from(hidden, {
        opacity: 0,
        y: 20,
        scale: 0.95,
        duration: 0.8,
        ease: "power2.out",
      });
      document.getElementById("closing-btn").style.display = "none";
    });
  }

  // ---- Init ----
  populateContent();
  initAmbient();
  initIntro();
  initEasterEggs();
})();
