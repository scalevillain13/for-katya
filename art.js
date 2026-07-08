(function () {
  "use strict";

  const COLORS = {
    heart: "#d4847a",
    heartGlow: "#e8a598",
    petal: "#f0d4cc",
    petalDeep: "#e8a598",
    stem: "#8aab7a",
    stemDark: "#6b8f5e",
    center: "#c4956a",
    sparkle: "#dfc4a8",
  };

  function heartPoint(t, scale, cx, cy) {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);
    return { x: cx + x * scale, y: cy - y * scale };
  }

  function buildHeartPath(scale, cx, cy, steps) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      pts.push(heartPoint((i / steps) * Math.PI * 2, scale, cx, cy));
    }
    return pts;
  }

  function drawFlower(ctx, cx, cy, radius, petals, progress, rotation) {
    const p = Math.min(1, Math.max(0, progress));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    if (p > 0.05) {
      const stemP = Math.min(1, (p - 0.05) / 0.25);
      ctx.strokeStyle = COLORS.stem;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, radius * 0.3);
      ctx.lineTo(0, radius * 0.3 + radius * 1.8 * stemP);
      ctx.stroke();
    }

    const petalP = Math.min(1, Math.max(0, (p - 0.2) / 0.55));
    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2;
      const petalProgress = Math.min(1, petalP * petals - i * 0.15);
      if (petalProgress <= 0) continue;

      ctx.save();
      ctx.rotate(angle);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = i % 2 === 0 ? COLORS.petal : COLORS.petalDeep;
      ctx.beginPath();
      ctx.ellipse(
        0,
        -radius * 0.55 * petalProgress,
        radius * 0.38 * petalProgress,
        radius * 0.55 * petalProgress,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    const centerP = Math.min(1, Math.max(0, (p - 0.65) / 0.2));
    if (centerP > 0) {
      ctx.fillStyle = COLORS.center;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.22 * centerP, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawSparkles(ctx, cx, cy, count, progress, seed) {
    const p = Math.min(1, progress);
    for (let i = 0; i < count; i++) {
      const angle = seed * 12.9898 + i * 2.399963;
      const dist = 80 + (i % 5) * 28;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const s = ((Math.sin(seed + i) * 0.5 + 0.5) * p) * 4;
      if (s < 0.3) continue;
      ctx.fillStyle = COLORS.sparkle;
      ctx.globalAlpha = 0.5 + Math.sin(seed * 3 + i) * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  class LoveCanvasArt {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.progress = 0;
      this.animating = false;
      this._rafId = null;
      this._pulseId = null;
      this._playGeneration = 0;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.flowers = [
        { x: 0.18, y: 0.62, r: 28, petals: 6, rot: -0.4 },
        { x: 0.82, y: 0.58, r: 32, petals: 7, rot: 0.5 },
        { x: 0.12, y: 0.38, r: 22, petals: 5, rot: 0.2 },
        { x: 0.88, y: 0.35, r: 24, petals: 6, rot: -0.3 },
        { x: 0.28, y: 0.22, r: 20, petals: 5, rot: 0.6 },
        { x: 0.72, y: 0.2, r: 22, petals: 5, rot: -0.5 },
      ];
      this.heartPoints = [];
      this._onResize = () => this.resize();
      window.addEventListener("resize", this._onResize);
      this.resize();
    }

    resize() {
      const wrap = this.canvas.parentElement;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const w = Math.min(Math.max(rect.width - 48, 280), 520);
      const h = w * 0.85;
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.w = w;
      this.h = h;
      this.heartPoints = buildHeartPath(w * 0.065, w * 0.5, h * 0.48, 200);
      this.draw(this.progress);
    }

    stopAll() {
      this._playGeneration += 1;
      if (this._rafId !== null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      if (this._pulseId !== null) {
        cancelAnimationFrame(this._pulseId);
        this._pulseId = null;
      }
      this.animating = false;
    }

    draw(progress) {
      const ctx = this.ctx;
      const w = this.w;
      const h = this.h;
      if (!w || !h) return;

      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      const glowP = Math.min(1, progress / 0.3);
      if (glowP > 0) {
        const grd = ctx.createRadialGradient(w * 0.5, h * 0.48, 0, w * 0.5, h * 0.48, w * 0.35);
        grd.addColorStop(0, `rgba(232, 165, 152, ${0.25 * glowP})`);
        grd.addColorStop(1, "rgba(232, 165, 152, 0)");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      }

      this.flowers.forEach((f, i) => {
        const fp = Math.min(1, Math.max(0, (progress - 0.15 - i * 0.06) / 0.5));
        drawFlower(ctx, f.x * w, f.y * h, f.r, f.petals, fp, f.rot);
      });

      const heartP = Math.min(1, progress / 0.55);
      const totalPts = Math.floor(this.heartPoints.length * heartP);
      if (totalPts > 1) {
        ctx.save();
        ctx.shadowColor = COLORS.heartGlow;
        ctx.shadowBlur = 12 * heartP;
        ctx.strokeStyle = COLORS.heart;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(this.heartPoints[0].x, this.heartPoints[0].y);
        for (let i = 1; i < totalPts; i++) {
          ctx.lineTo(this.heartPoints[i].x, this.heartPoints[i].y);
        }
        ctx.stroke();

        const fillP = Math.min(1, Math.max(0, (progress - 0.45) / 0.25));
        if (fillP > 0) {
          ctx.globalAlpha = 0.18 * fillP;
          ctx.fillStyle = COLORS.heart;
          ctx.beginPath();
          this.heartPoints.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      const innerP = Math.min(1, Math.max(0, (progress - 0.6) / 0.25));
      if (innerP > 0) {
        const innerPts = buildHeartPath(w * 0.028, w * 0.5, h * 0.48, 120);
        const innerTotal = Math.floor(innerPts.length * innerP);
        ctx.strokeStyle = COLORS.heartGlow;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(innerPts[0].x, innerPts[0].y);
        for (let i = 1; i < innerTotal; i++) {
          ctx.lineTo(innerPts[i].x, innerPts[i].y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      const sparkP = Math.min(1, Math.max(0, (progress - 0.75) / 0.25));
      if (sparkP > 0) {
        drawSparkles(ctx, w * 0.5, h * 0.48, 14, sparkP, progress * 10);
      }

      if (heartP < 1 && totalPts > 0) {
        const tip = this.heartPoints[totalPts - 1];
        ctx.fillStyle = COLORS.heart;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    play() {
      this.stopAll();
      const generation = this._playGeneration;
      this.animating = true;
      this.progress = 0;
      this.draw(0);

      return new Promise((resolve) => {
        const start = performance.now();
        const duration = 4500;

        const tick = (now) => {
          if (generation !== this._playGeneration) {
            resolve();
            return;
          }

          const t = Math.min(1, (now - start) / duration);
          const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          this.progress = eased;
          this.draw(this.progress);

          if (t < 1) {
            this._rafId = requestAnimationFrame(tick);
          } else {
            this._rafId = null;
            this.animating = false;
            this.startIdlePulse(generation);
            resolve();
          }
        };

        this._rafId = requestAnimationFrame(tick);
      });
    }

    startIdlePulse(generation) {
      if (this._pulseId !== null) {
        cancelAnimationFrame(this._pulseId);
        this._pulseId = null;
      }

      const pulse = () => {
        if (generation !== this._playGeneration || this.animating) return;
        this.draw(1);
        const ctx = this.ctx;
        const t = performance.now() / 1000;
        const pulseAlpha = 0.03 + Math.sin(t * 1.5) * 0.02;
        ctx.save();
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.globalAlpha = pulseAlpha;
        ctx.fillStyle = COLORS.heartGlow;
        ctx.beginPath();
        this.heartPoints.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        this._pulseId = requestAnimationFrame(pulse);
      };

      this._pulseId = requestAnimationFrame(pulse);
    }

    reset() {
      this.stopAll();
      this.progress = 0;
      this.draw(0);
    }

    destroy() {
      this.stopAll();
      window.removeEventListener("resize", this._onResize);
    }
  }

  window.LoveCanvasArt = LoveCanvasArt;
})();
