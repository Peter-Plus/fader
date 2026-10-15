import { releaseState } from "./gesture.js";

export function createOrb(onChange, onPress = () => {}) {
  const ball = document.getElementById("orb");
  const dock = document.getElementById("dock");
  const home = document.getElementById("home");
  const signal = home.querySelector(".signal");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let active = false, disabled = true, drag = null, distance = 120, lastBurst = 0, lastClick = 0;
  let vibration;
  function pressFeedback() {
    onPress();
    if (reduced.matches) return;
    vibration?.cancel();
    // Animate translation separately from the drag's scale and position.
    vibration = ball.querySelector("i").animate([
      { translate: "0 0" }, { translate: "-3px 1px" },
      { translate: "3px -1px" }, { translate: "-2px 0" },
      { translate: "2px 1px" }, { translate: "-1px 0" },
      { translate: "0 0" }
    ], { duration: 240, easing: "ease-out" });
  }

  function burst(x, y, count = 14) {
    if (reduced.matches) return;
    const layer = document.createElement("div");
    layer.className = "orb-burst";
    layer.style.left = `${x}px`; layer.style.top = `${y}px`;
    layer.setAttribute("aria-hidden", "true");
    for (let i = 0; i < count; i++) {
      const spark = document.createElement("i");
      const angle = Math.random() * Math.PI * 2, radius = 18 + Math.random() * 55;
      spark.style.setProperty("--x", `${Math.cos(angle) * radius}px`);
      spark.style.setProperty("--y", `${Math.sin(angle) * radius}px`);
      layer.append(spark);
    }
    document.body.append(layer);
    setTimeout(() => layer.remove(), 750);
  }
  function centerBurst(count) {
    const rect = ball.getBoundingClientRect();
    burst(rect.left + rect.width / 2, rect.top + rect.height / 2, count);
  }
  function paint(progress) {
    ball.style.setProperty("--orb-y", `${distance * progress}px`);
    ball.style.setProperty("--orb-scale", String(1 + progress * 2.6));
    home.style.setProperty("--pull", String(progress));
  }
  function layout() {
    if (home.hidden) return;
    const s = signal.getBoundingClientRect(), d = dock.getBoundingClientRect();
    distance = d.top + d.height / 2 - (s.top + s.height / 2);
    if (!drag) paint(active ? 1 : 0);
  }
  function settle() {
    home.classList.remove("dragging", "over-dock");
    paint(active ? 1 : 0);
  }
  ball.addEventListener("pointerdown", event => {
    if (disabled || event.button !== 0 || drag) return;
    event.preventDefault();
    layout();
    drag = { id: event.pointerId, y: event.clientY, progress: active ? 1 : 0, moved: false, inside: true };
    ball.setPointerCapture(event.pointerId);
    home.classList.add("dragging");
    pressFeedback();
    centerBurst(10);
  });
  ball.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;
    const delta = event.clientY - drag.y;
    drag.moved ||= Math.abs(delta) > 5;
    drag.progress = Math.max(0, Math.min(1, (active ? 1 : 0) + delta / distance));
    const rect = dock.getBoundingClientRect();
    drag.inside = event.clientX >= rect.left && event.clientX <= rect.right;
    const over = drag.inside && drag.progress >= 0.78;
    home.classList.toggle("over-dock", over);
    paint(drag.progress);
    if (over && performance.now() - lastBurst > 100) { centerBurst(5); lastBurst = performance.now(); }
  });
  function cancel() { if (!drag) return; drag = null; lastClick = 0; settle(); }
  ball.addEventListener("pointercancel", cancel);
  ball.addEventListener("lostpointercapture", cancel);
  ball.addEventListener("pointerup", event => {
    if (!drag || event.pointerId !== drag.id) return;
    const gesture = drag;
    drag = null;
    ball.releasePointerCapture(event.pointerId);
    let next = releaseState(active, gesture.progress, gesture.inside, gesture.moved);
    const now = performance.now();
    if (!gesture.moved && active) {
      if (lastClick && now - lastClick < 450) { next = false; lastClick = 0; }
      else lastClick = now;
    } else lastClick = 0;
    settle();
    if (next !== active) { centerBurst(26); onChange(next); }
  });
  // Keyboard / assistive activation bypasses the pointer double-click gesture.
  ball.addEventListener("click", event => {
    if (event.detail === 0 && !disabled) { pressFeedback(); centerBurst(20); onChange(!active); }
  });
  dock.addEventListener("click", event => burst(event.clientX, event.clientY, 20));
  ball.addEventListener("pointerenter", () => { if (active) centerBurst(10); });
  window.addEventListener("blur", cancel);
  new ResizeObserver(layout).observe(home);
  return {
    layout,
    update(enabled, unavailable) {
      active = enabled; disabled = unavailable;
      ball.disabled = disabled;
      ball.setAttribute("aria-checked", String(active));
      home.classList.toggle("global-active", active);
      layout();
    }
  };
}
