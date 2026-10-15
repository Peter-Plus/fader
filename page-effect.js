// Self-contained: serialized by chrome.scripting into the isolated world.
export function pageEffect(direct, expectedUrl) {
  if (location.href !== expectedUrl || matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return new Promise(resolve => {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;";
    const paper = direct ? "#efefea" : "#07080a";
    host.style.setProperty("background", paper, "important");
    const root = host.attachShadow({ mode: "closed" });
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none";
    root.append(canvas); document.documentElement.append(host);
    const ctx = canvas.getContext("2d");
    if (!ctx) { host.remove(); resolve(false); return; }
    let w, h, frame, done = false, rows = [], lastBeat = -1, lastDraw = -Infinity, frameCount = 0;
    const resize = () => {
      w = innerWidth; h = innerHeight;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = w * ratio; canvas.height = h * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random(), y: Math.random(), speed: .15 + Math.random() * .4, r: 1 + Math.random() * 2
    }));
    const chars = "01ABCDEF[]/<>λ∅χ";
    const text = n => Array.from({ length: n }, () => chars[Math.random() * chars.length | 0]).join("");
    rows = Array.from({ length: 24 }, () => text(40));
    const fragments = Array.from({ length: 38 }, (_, i) => ({
      x: Math.random(), y: Math.random(), size: 8 + Math.random() * 8,
      length: 7 + Math.floor(Math.random() * 28), phase: Math.random() * 7,
      speed: (Math.random() - .5) * 45, type: i % 5
    }));
    const syntax = ["ptr::", "[null] -> ", "xor ", "ERR/", "0x", "void* ", "jmp @", "unlink(", "SIG//", "[ LOST ] "];
    const shards = Array.from({ length: 32 }, () => ({
      angle: Math.random() * Math.PI * 2, offset: Math.random(), width: 2 + Math.random() * 7
    }));
    const start = performance.now();
    const finish = () => {
      if (done) return;
      done = true; cancelAnimationFrame(frame); clearTimeout(timer); clearInterval(watchdog);
      window.removeEventListener("resize", resize); window.removeEventListener("pagehide", finish);
      host.remove(); resolve(frameCount > 1);
    };
    const timer = setTimeout(finish, 2050);
    // Some pages throttle rAF while focus is in the extension's side panel.
    // Use one clock and a timer fallback, without starting multiple rAF chains.
    const watchdog = setInterval(() => {
      if (!done && performance.now() - lastDraw > 45) draw();
    }, 33);
    window.addEventListener("resize", resize); window.addEventListener("pagehide", finish, { once: true });
    function draw() {
      if (done) return;
      const now = performance.now();
      lastDraw = now;
      const t = Math.max(0, (now - start) / 1000);
      if (t >= 2) return finish();
      ctx.globalAlpha = 1;
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, w, h);
      const ink = direct ? "#121215" : "#e5e5ef";
      ctx.fillStyle = ctx.strokeStyle = ink;
      const beat = Math.floor(t * 16);
      if (beat !== lastBeat) { rows = Array.from({ length: 24 }, () => text(40)); lastBeat = beat; }
      const cx = w * .51, cy = h * .48;
      const radius = Math.min(w * .22, h * .27);
      const lock = Math.min(1, Math.max(0, (t - 1.35) / .4));
      const assemble = Math.min(1, t / .45);
      const rotation = 4 * t - 2 * Math.max(0, t - 1.35);
      // Asymmetric architectural traces, broken at different lengths.
      ctx.lineWidth = .7;
      for (let i = 0; i < 12; i++) {
        ctx.globalAlpha = .06;
        const y = h * (i / 12) + Math.sin(i * 14) * 20;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w * .3, y);
        ctx.lineTo(w * .4, y + 45); ctx.lineTo(w * .83, y + 45); ctx.stroke();
      }
      // Independent bursts: variable fonts, lifetimes, positions and syntax.
      ctx.textAlign = "left";
      fragments.forEach((f, i) => {
        const life = (t * (2 + i % 3) + f.phase) % 1;
        if (life > .8) return;
        const x = 18 + f.x * Math.max(1, w - 170) + (life > .65 ? 15 : 0);
        const y = 40 + f.y * (h - 80) + t * f.speed;
        if (Math.abs(x - cx) < radius * .8 && Math.abs(y - cy) < radius * .65) return;
        ctx.font = `${f.type === 0 ? "bold " : ""}${f.size}px monospace`;
        ctx.globalAlpha = .18 + Math.sin(life * Math.PI) * .45;
        const code = syntax[(i + beat) % syntax.length] + rows[i % 24].slice(0, f.length);
        ctx.fillText(code, x, y);
        if (f.type === 1) {
          ctx.globalAlpha = .18; ctx.fillRect(x - 7, y - f.size, 2, f.size * 3);
          ctx.fillText("  ↳ " + rows[(i + 7) % 24].slice(0, f.length / 2), x, y + f.size + 4);
        }
        if (f.type === 2) ctx.fillRect(x + f.length * f.size * .6, y - f.size, 7, f.size);
        if (f.type === 3) { ctx.globalAlpha = .1; ctx.fillRect(x, y + 5, 45 + f.length * 2, 10); }
      });
      // Radial packets: accelerate out from the mechanism, leaving long tails.
      for (const p of particles) {
        const angle = p.x * Math.PI * 2 + t * .13;
        const travel = (p.y + t * p.speed * 1.6) % 1;
        const rr = radius * .65 + travel * travel * Math.max(w, h) * .65;
        const x = cx + Math.cos(angle) * rr, y = cy + Math.sin(angle) * rr;
        ctx.globalAlpha = (1 - travel) * .6;
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha *= .3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(angle) * travel * 60, y - Math.sin(angle) * travel * 60); ctx.stroke();
      }
      ctx.save(); ctx.translate(cx, cy);
      // Segmented rotor, counter-rotating ruler and broken radial teeth.
      for (let layer = 0; layer < 4; layer++) {
        const direction = layer % 2 ? -1 : 1;
        const rr = radius * (.65 + layer * .16) * (.72 + assemble * .28);
        const segments = 9 + layer * 7;
        ctx.lineWidth = layer === 1 ? 8 : layer === 3 ? 1 : 3;
        for (let i = 0; i < segments; i++) {
          if ((i + layer * 3) % 7 === 0) continue;
          const angle = i / segments * Math.PI * 2 + rotation * direction * (.4 + layer * .2);
          ctx.globalAlpha = .2 + ((i + layer) % 4) * .18;
          ctx.beginPath(); ctx.arc(0, 0, rr, angle, angle + Math.PI * 2 / segments * .62); ctx.stroke();
        }
      }
      for (let i = 0; i < 96; i++) {
        const a = i / 96 * Math.PI * 2 - rotation * .3;
        const r = radius * 1.24;
        ctx.globalAlpha = i % 4 ? .25 : .8; ctx.lineWidth = i % 4 ? 1 : 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a) * (r + (i % 4 ? 4 : 13)), Math.sin(a) * (r + (i % 4 ? 4 : 13))); ctx.stroke();
      }
      // Three-dimensional wireframe core, with an oscillating tilted axis.
      const points = Array.from({ length: 8 }, (_, i) => {
        const x = (i & 1 ? 1 : -1), y = (i & 2 ? 1 : -1), z = (i & 4 ? 1 : -1);
        const a = rotation * .7, b = .6 + Math.sin(t * 2) * .3;
        const xx = x * Math.cos(a) - z * Math.sin(a), zz = x * Math.sin(a) + z * Math.cos(a);
        return [xx * radius * .31, (y * Math.cos(b) - zz * Math.sin(b)) * radius * .31];
      });
      ctx.globalAlpha = .32; ctx.lineWidth = 1;
      points.forEach((p, i) => points.forEach((q, j) => {
        if (j > i && [1, 2, 4].includes(i ^ j)) { ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); }
      }));
      // Detached shards converge, then snap into a locked square frame.
      shards.forEach((s, i) => {
        const a = s.angle + rotation * .2 * (1 - lock);
        const r = radius * (1.3 + s.offset * .6 - lock * .2);
        ctx.save(); ctx.rotate(a); ctx.globalAlpha = .15 + s.offset * .5;
        ctx.fillRect(r, 0, 8 + s.offset * 20, s.width); ctx.restore();
      });
      ctx.globalAlpha = .85; ctx.lineWidth = 2;
      const bound = radius * (1.5 - lock * .25);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(sx * bound, sy * (bound - 24));
        ctx.lineTo(sx * bound, sy * bound); ctx.lineTo(sx * (bound - 24), sy * bound); ctx.stroke();
      }
      ctx.restore();
      // Tear the composite into offset strips, without flashing the whole screen.
      if (t > .22 && t < 1.4 && beat % 4 === 1) {
        const ratio = canvas.width / w;
        for (let i = 0; i < 4; i++) {
          const y = (beat * 71 + i * 139) % h, hh = 3 + i * 4;
          ctx.globalAlpha = .7;
          ctx.drawImage(canvas, 0, y * ratio, canvas.width, hh * ratio, (i % 2 ? -1 : 1) * (15 + i * 9), y, w, hh);
        }
      }
      // Central type resolves from clipped fragments into a decisive final lock.
      const label = t < 1.35 ? rows[beat % 24].slice(0, 5) : direct ? "F A D E" : "A L L O W";
      ctx.textAlign = "center"; ctx.font = `bold ${Math.max(25, Math.min(58, w / 15))}px monospace`;
      ctx.globalAlpha = .95; ctx.fillStyle = paper;
      ctx.fillRect(cx - radius * .95, cy - 29, radius * 1.9, 57);
      ctx.fillStyle = ink; ctx.fillText(label, cx + (t < 1.35 ? Math.sin(beat * 15) * 8 : 0), cy + 14);
      ctx.font = "10px monospace"; ctx.globalAlpha = .75;
      ctx.fillText(t < .65 ? "01 / FRACTURE" : t < 1.35 ? "02 / RECONSTRUCT" : "03 / LOCKED", cx, cy + radius * 1.6 + 25);
      ctx.textAlign = "left"; ctx.font = "bold 15px monospace";
      ctx.fillText("F / D", 30, 37);
      ctx.font = "10px monospace"; ctx.globalAlpha = .45;
      ctx.fillText("ROUTE ENGINE   //   " + (direct ? "DEREFERENCE" : "REASSEMBLE"), 30, 55);
      ctx.textAlign = "right"; ctx.fillText(rows[beat % 24].slice(0, 17), w - 30, h - 30);
      ctx.globalAlpha = .35; ctx.fillRect(30, h - 17, (w - 60) * Math.min(1, t / 1.85), 2);
      frameCount++;
    }
    function animate() {
      if (done) return;
      draw();
      if (!done) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
  });
}

export async function effectAndReload(tab, direct) {
  let overlayPlayed = false, reloadFailed = false;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: pageEffect, args: [direct, tab.url]
    });
    overlayPlayed = results.some(result => result.result === true);
  } catch { /* Protected pages can reject injection; routing still succeeded. */ }
  try {
    const current = await chrome.tabs.get(tab.id);
    if (current.url === tab.url) await chrome.tabs.reload(tab.id);
  } catch { reloadFailed = true; }
  return { overlayPlayed, reloadFailed };
}
