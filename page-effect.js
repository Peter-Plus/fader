// Self-contained: serialized by chrome.scripting into the isolated world.
export function pageEffect(direct, expectedUrl) {
  if (location.href !== expectedUrl || matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return new Promise(resolve => {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;";
    const root = host.attachShadow({ mode: "closed" });
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none";
    root.append(canvas); document.documentElement.append(host);
    const ctx = canvas.getContext("2d");
    if (!ctx) { host.remove(); resolve(false); return; }
    let w, h, frame, done = false, rows = [], lastBeat = -1;
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
    const start = performance.now();
    const finish = () => {
      if (done) return;
      done = true; cancelAnimationFrame(frame); clearTimeout(timer);
      window.removeEventListener("resize", resize); window.removeEventListener("pagehide", finish);
      host.remove(); resolve(true);
    };
    const timer = setTimeout(finish, 2050);
    window.addEventListener("resize", resize); window.addEventListener("pagehide", finish, { once: true });
    function draw(now) {
      const t = (now - start) / 1000;
      if (t >= 2) return finish();
      ctx.clearRect(0, 0, w, h);
      const fade = Math.min(1, t / .12, (2 - t) / .25);
      ctx.globalAlpha = fade;
      ctx.fillStyle = direct ? "rgba(244,244,241,.88)" : "rgba(5,5,9,.88)";
      ctx.fillRect(0, 0, w, h);
      const ink = direct ? "#121215" : "#e5e5ef";
      ctx.fillStyle = ctx.strokeStyle = ink;
      const beat = Math.floor(t * 12);
      if (beat !== lastBeat) { rows = Array.from({ length: 24 }, () => text(40)); lastBeat = beat; }
      ctx.font = "11px monospace"; ctx.textAlign = "left";
      for (let i = 0; i < 24; i++) {
        ctx.globalAlpha = fade * .2;
        const y = (i * h / 24 + t * 95) % h;
        ctx.fillText(rows[i], 24, y); ctx.fillText(rows[23 - i], Math.max(24, w - 310), h - y);
      }
      for (const p of particles) {
        ctx.globalAlpha = fade * .65;
        const x = (p.x * w + Math.sin(t * 4 + p.y * 10) * 45 + w) % w;
        const y = ((p.y - t * p.speed) % 1 + 1) % 1 * h;
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = fade * .15; ctx.fillRect(x, y, 1, 12 + p.speed * 35);
      }
      const radius = Math.min(w, h) * .2;
      ctx.save(); ctx.translate(w / 2, h / 2);
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = fade * (.25 + i * .12); ctx.lineWidth = i === 1 ? 2 : 1;
        ctx.beginPath(); ctx.arc(0, 0, radius + i * 13, t * (i % 2 ? -3 : 2) + i, t * (i % 2 ? -3 : 2) + i + 4.8); ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = fade; ctx.textAlign = "center";
      ctx.font = `bold ${Math.max(22, Math.min(48, w / 18))}px monospace`;
      ctx.fillText(t < 1.2 ? "Ø / " + rows[0].slice(0, 6) : direct ? "F A D E" : "A L L O W", w / 2 + (t < 1.2 ? Math.sin(beat) * 6 : 0), h / 2);
      ctx.font = "11px monospace";
      ctx.fillText(t < 1 ? "SIGNAL // DEREFERENCE" : "ROUTE MATRIX :: SEALED", w / 2, h / 2 + 30);
      ctx.globalAlpha = fade * .3; ctx.fillRect(0, t * h % h, w, 2);
      ctx.fillRect(w * .2, h - 36, w * .6 * Math.min(1, t / 1.8), 1);
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
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
