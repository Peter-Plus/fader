// Decorative local graphics only; no network inspection or terminal execution.
export function playTransition(direct) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  return new Promise(resolve => {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "fixed", inset: "0", width: "100%", height: "100%",
      zIndex: "20", pointerEvents: "auto"
    });
    document.body.append(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) { canvas.remove(); resolve(); return; }
    const width = innerWidth, height = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = width * dpr; canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    const ink = direct ? "#121214" : "#e9e9ec";
    const paper = direct ? "#f0f0ed" : "#09090b";
    const glyphs = "01ABCDEF/:[]<>#░▒λ∅χ";
    const randomText = n => Array.from({ length: n }, () => glyphs[Math.floor(Math.random() * glyphs.length)]).join("");
    let rows = Array.from({ length: 24 }, () => randomText(44)), beat = -1, frame, finished = false;
    const start = performance.now();
    const end = () => {
      if (finished) return;
      finished = true; cancelAnimationFrame(frame); clearTimeout(timer);
      window.removeEventListener("pagehide", end);
      canvas.remove(); resolve();
    };
    const timer = setTimeout(end, 2000);
    window.addEventListener("pagehide", end, { once: true });
    function draw() {
      const t = Math.max(0, (performance.now() - start) / 1000);
      if (t >= 2) { end(); return; }
      const phase = Math.floor(t * 13);
      if (phase !== beat) { beat = phase; rows = Array.from({ length: 24 }, () => randomText(44)); }
      ctx.globalAlpha = 1; ctx.fillStyle = paper; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = ink; ctx.strokeStyle = ink;
      // Fast narrow data bands rather than full-screen strobing.
      ctx.font = "9px Consolas, monospace";
      for (let i = 0; i < rows.length; i++) {
        ctx.globalAlpha = .08 + (i % 4) * .025;
        const y = (i * 19 - t * (i % 2 ? 115 : -75) + height * 8) % height;
        ctx.fillText(rows[i], -25 + Math.sin(t * 8 + i) * 22, y);
      }
      const cx = width / 2, cy = height * .48;
      ctx.save(); ctx.translate(cx, cy);
      for (let ring = 0; ring < 4; ring++) {
        ctx.globalAlpha = .15 + ring * .14;
        ctx.lineWidth = ring === 2 ? 2 : .65;
        const radius = 29 + ring * 22 + Math.sin(t * 6 + ring) * 5;
        const turn = t * (ring % 2 ? -3 : 2) + ring;
        for (let segment = 0; segment < 3; segment++) {
          ctx.beginPath(); ctx.arc(0, 0, radius, turn + segment * 2.1, turn + segment * 2.1 + 1.45); ctx.stroke();
        }
      }
      ctx.rotate(t * 1.8); ctx.globalAlpha = .45;
      ctx.strokeRect(-54, -54, 108, 108);
      ctx.restore();
      ctx.globalAlpha = .9; ctx.textAlign = "center";
      ctx.font = "bold 29px Consolas, monospace";
      const label = t < .55 ? "0x" + randomText(4) : t < 1.35 ? "N / U / L" : direct ? "Ø : FREE" : "λ : LINK";
      const jitter = t < 1.4 ? Math.sin(phase * 19) * 5 : 0;
      // Opaque central strip gives the typography a sharp cut through the rings.
      ctx.fillStyle = paper; ctx.fillRect(32, cy - 22, width - 64, 39);
      ctx.fillStyle = ink; ctx.fillText(label, cx + jitter, cy + 8);
      ctx.font = "9px Consolas, monospace"; ctx.globalAlpha = .65;
      ctx.fillText(["ENTROPY / HANDSHAKE", "VOID MATRIX :: 0xFF", "SIGNAL RECONSTRUCT", "SEQUENCE / SEALED"][Math.min(3, Math.floor(t * 2))], cx, cy + 120);
      ctx.textAlign = "left"; ctx.fillText("FADER // " + (direct ? "DEREFERENCE" : "REASSEMBLE"), 22, 30);
      ctx.fillText(randomText(12), 22, height - 25);
      ctx.textAlign = "right"; ctx.fillText(String(Math.min(99, Math.floor(t * 50))).padStart(2, "0") + " / FF", width - 22, height - 25);
      ctx.textAlign = "left";
      ctx.globalAlpha = .22;
      const scan = (t * 240) % height;
      ctx.fillRect(0, scan, width, 2);
      for (let i = 0; i < 3; i++) {
        const y = (phase * 37 + i * 89) % height;
        ctx.fillRect((phase * 61 + i * 30) % width, y, 35 + i * 18, 1 + i);
      }
      ctx.globalAlpha = .5; ctx.fillRect(22, height - 13, (width - 44) * Math.min(1, t / 1.8), 1);
      canvas.style.opacity = t > 1.75 ? String((2 - t) / .25) : "1";
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
  });
}
