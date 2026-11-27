import { useEffect, useRef } from "react";

// Lightweight 60fps canvas: ambient constellation particles + cursor trail + click ripples
function InteractiveCanvas() {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: -1000, y: -1000, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return; // jsdom / test env

    let animId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    const particles = [];
    const trail = [];
    const pathPoints = [];
    const ripples = [];

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    }
    resize();
    window.addEventListener("resize", resize);

    function spawnCursorTrail(x, y) {
      mouse.current.x = x;
      mouse.current.y = y;
      mouse.current.active = true;

      const last = pathPoints[pathPoints.length - 1];
      if (!last || (x - last.x) ** 2 + (y - last.y) ** 2 >= 9) {
        pathPoints.push({ x, y, life: 1.0 });
        if (pathPoints.length > 22) pathPoints.shift();
      }

      if (trail.length < 70) {
        for (let i = 0; i < 2; i++) {
          trail.push({
            x: x + (Math.random() - 0.5) * 8,
            y: y + (Math.random() - 0.5) * 8,
            size: Math.random() * 2.5 + 1.2,
            life: 1.0,
            decay: Math.random() * 0.03 + 0.025,
            vx: (Math.random() - 0.5) * 1.3,
            vy: (Math.random() - 0.5) * 1.3,
            hue: Math.random() * 70 + 230,
          });
        }
      }
    }

    function onMouseMove(e) {
      spawnCursorTrail(e.clientX, e.clientY);
    }
    function onTouchMove(e) {
      if (e.touches && e.touches[0]) {
        spawnCursorTrail(e.touches[0].clientX, e.touches[0].clientY);
      }
    }
    function onMouseDown(e) {
      if (ripples.length < 6) {
        ripples.push({ x: e.clientX, y: e.clientY, radius: 6, maxRadius: 95, life: 1.0 });
      }
    }
    function onMouseLeave() {
      mouse.current.active = false;
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown, { passive: true });
    window.addEventListener("mouseleave", onMouseLeave);

    // Fewer, cleaner ambient particles for fast rendering
    const count = Math.min(45, Math.floor((width * height) / 22000));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.1 + 1.0,
        speedX: (Math.random() - 0.5) * 0.45,
        speedY: (Math.random() - 0.5) * 0.45,
        opacity: Math.random() * 0.45 + 0.25,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.03 + 0.01,
        hue: Math.random() * 80 + 220,
      });
    }

    const LINK_DIST = 140;
    const LINK_DIST_SQ = LINK_DIST * LINK_DIST;
    const MOUSE_LINK_DIST = 185;
    const MOUSE_LINK_SQ = MOUSE_LINK_DIST * MOUSE_LINK_DIST;

    function draw() {
      if (document.hidden) {
        animId = 0;
        return;
      }

      ctx.clearRect(0, 0, width, height);
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      const mx = mouse.current.x;
      const my = mouse.current.y;
      const mouseActive = mouse.current.active;

      // ---- Cursor path trail ----
      for (let i = pathPoints.length - 1; i >= 0; i--) {
        pathPoints[i].life -= 0.04;
        if (pathPoints[i].life <= 0) pathPoints.splice(i, 1);
      }
      if (pathPoints.length > 1) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 1; i < pathPoints.length; i++) {
          const p0 = pathPoints[i - 1];
          const p1 = pathPoints[i];
          const progress = i / pathPoints.length;
          const alpha = Math.min(p0.life, p1.life) * progress * (isDark ? 0.72 : 0.48);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = `hsla(${235 + progress * 60}, 86%, ${isDark ? "72%" : "58%"}, ${alpha})`;
          ctx.lineWidth = progress * 4.5 + 0.5;
          ctx.stroke();
        }
        ctx.restore();
      }

      // ---- Click ripples ----
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += (r.maxRadius - r.radius) * 0.09 + 1;
        r.life -= 0.035;
        if (r.life <= 0) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(250, 85%, ${isDark ? "75%" : "58%"}, ${r.life * (isDark ? 0.4 : 0.25)})`;
        ctx.lineWidth = 1.6 * r.life;
        ctx.stroke();
      }

      // ---- Spark trail dots ----
      for (let i = trail.length - 1; i >= 0; i--) {
        const t = trail[i];
        t.x += t.vx;
        t.y += t.vy;
        t.vx *= 0.95;
        t.vy *= 0.95;
        t.life -= t.decay;
        t.size *= 0.98;

        if (t.life <= 0 || t.size < 0.25) {
          trail.splice(i, 1);
          continue;
        }

        const alpha = t.life * (isDark ? 0.78 : 0.48);
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${t.hue}, 85%, ${isDark ? "75%" : "58%"}, ${alpha})`;
        ctx.fill();
      }

      // ---- Ambient particles (single draw pass each) ----
      const pLight = isDark ? "76%" : "55%";
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.pulse += p.pulseSpeed;

        if (mouseActive) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const dSq = dx * dx + dy * dy;
          if (dSq < 25600 && dSq > 0) {
            const dist = Math.sqrt(dSq);
            const force = (160 - dist) / 160;
            p.x += (dx / dist) * force * 1.6;
            p.y += (dy / dist) * force * 1.6;
          }
        }

        if (p.x < -15) p.x = width + 15;
        if (p.x > width + 15) p.x = -15;
        if (p.y < -15) p.y = height + 15;
        if (p.y > height + 15) p.y = -15;

        const alpha = p.opacity * (Math.sin(p.pulse) * 0.3 + 0.7);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 78%, ${pLight}, ${alpha})`;
        ctx.fill();
      }

      // ---- Connection lines using squared distance pre-check ----
      ctx.lineWidth = 0.8;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dSq = dx * dx + dy * dy;
          if (dSq < LINK_DIST_SQ) {
            const lineAlpha = (1 - Math.sqrt(dSq) / LINK_DIST) * (isDark ? 0.16 : 0.09);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `hsla(248, 68%, ${pLight}, ${lineAlpha})`;
            ctx.stroke();
          }
        }

        if (mouseActive) {
          const dx = a.x - mx;
          const dy = a.y - my;
          const dSq = dx * dx + dy * dy;
          if (dSq < MOUSE_LINK_SQ) {
            const lineAlpha = (1 - Math.sqrt(dSq) / MOUSE_LINK_DIST) * (isDark ? 0.28 : 0.16);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mx, my);
            ctx.strokeStyle = `hsla(265, 85%, ${pLight}, ${lineAlpha})`;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    }

    function onVisibilityChange() {
      if (!document.hidden && !animId) {
        animId = requestAnimationFrame(draw);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    animId = requestAnimationFrame(draw);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-canvas" />;
}

export default function AnimatedBackground() {
  return (
    <div className="animated-bg" aria-hidden="true">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="orb orb-4" />
      <div className="mesh-grid" />
      <InteractiveCanvas />
    </div>
  );
}
