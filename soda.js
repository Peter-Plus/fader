// Small elastic bubbles with upward buoyancy. Canvas never intercepts input.
export function createSoda(canvas) {
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let active = false, frame = 0, last = 0, width = 360, height = 330;
  let boostUntil = 0;
  const balls = Array.from({ length: 88 }, () => ({
    x: Math.random() * width, y: Math.random() * height,
    r: 1.5 + Math.random() * 2.8,
    vx: (Math.random() - .5) * 160, vy: -45 - Math.random() * 115
  }));
  function resize() {
    const rect = canvas.getBoundingClientRect();
    // Hidden side panels can report 0x0. Never scale coordinates through zero.
    if (!(rect.width > 0 && rect.height > 0)) return;
    const oldWidth = width, oldHeight = height;
    width = rect.width; height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const b of balls) {
      b.x = Number.isFinite(b.x) ? b.x * width / oldWidth : Math.random() * width;
      b.y = Number.isFinite(b.y) ? b.y * height / oldHeight : Math.random() * height;
    }
    draw();
  }
  function step(dt) {
    for (const b of balls) {
      b.vy = Math.max(-190, b.vy - 55 * dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j], dx = b.x - a.x, dy = b.y - a.y;
        const radius = a.r + b.r, squared = dx * dx + dy * dy;
        if (squared >= radius * radius) continue;
        const distance = Math.sqrt(squared), nx = distance ? dx / distance : 1, ny = distance ? dy / distance : 0;
        const overlap = (radius - distance) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        const speed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (speed < 0) {
          a.vx += speed * nx; a.vy += speed * ny;
          b.vx -= speed * nx; b.vy -= speed * ny;
        }
      }
    }
    for (const b of balls) {
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
      if (b.x > width - b.r) { b.x = width - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * .85; }
      if (b.y > height - b.r) { b.y = height - b.r; b.vy = -Math.abs(b.vy); }
      // Recycle some surface bubbles to keep a continuous rising fizz.
      if (b.y < 18 && Math.random() < dt * 2) {
        b.y = height - b.r; b.x = b.r + Math.random() * (width - 2 * b.r);
        b.vy = -80 - Math.random() * 100;
      }
      b.vx = Math.max(-210, Math.min(210, b.vx));
      b.vy = Math.max(-220, Math.min(220, b.vy));
    }
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    if (!active) return;
    // Leave the center quieter so the hostname stays legible.
    for (const b of balls) {
      const edge = Math.abs(b.x - width / 2) / (width / 2);
      ctx.fillStyle = `rgba(12,12,14,${.12 + edge * .57})`;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, .035) : 1 / 60;
    last = now;
    const remaining = Math.max(0, Math.min(1, (boostUntil - now) / 900));
    const boostedDt = dt * (1 + 2.2 * remaining * remaining);
    const steps = Math.ceil(boostedDt / (1 / 120));
    for (let i = 0; i < steps; i++) step(boostedDt / steps);
    draw(); frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    resize();
    draw();
    if (active && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
  }
  new ResizeObserver(resize).observe(document.body);
  window.addEventListener("resize", resize);
  window.addEventListener("pageshow", sync);
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", sync);
  window.addEventListener("pagehide", () => cancelAnimationFrame(frame));
  resize();
  return {
    setActive(value) {
      if (active !== value) { active = value; boostUntil = 0; sync(); }
      else if (active && !frame && !document.hidden) sync();
    },
    pulse() {
      // Repeated presses refresh the burst; they never accumulate runaway speed.
      if (active && !reduced.matches && !document.hidden) boostUntil = performance.now() + 900;
    }
  };
}
