import { website } from "./core.js";
import { createOrb } from "./orb.js";
import { createSoda } from "./soda.js";
import { playTransition } from "./transition.js";
const $ = id => document.getElementById(id);
document.body.classList.toggle("side-panel", new URLSearchParams(location.search).has("panel"));
let tab, host, busy = false, portDirty = false;
let refreshPending = false, refreshTimer;
const panelWindow = chrome.windows.getCurrent().then(window => window.id);
async function refreshTab() {
  [tab] = await chrome.tabs.query({ active: true, windowId: await panelWindow });
  host = website(tab?.url);
}
const soda = createSoda(document.getElementById("soda"));
const orb = createOrb(enabled => run(async () => {
  const result = await send({ type: "setGlobalDirect", enabled, tabId: tab?.id });
  if (!result.overlayPlayed) await transition();
  if (result.reloadFailed) $("message").textContent = "设置已保存，请手动刷新。";
}), () => soda.pulse());
async function send(message) {
  let timer;
  try {
    const result = await Promise.race([
      chrome.runtime.sendMessage(message),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("后台响应超时。请在扩展管理页重新加载 Fader 后重试。")), 8000); })
    ]);
    if (!result?.ok) throw new Error(result?.error || "操作未完成，请重试。");
    return result;
  } finally { clearTimeout(timer); }
}
async function transition() {
  await render();
  await playTransition(document.body.dataset.faded === "true");
}
async function render() {
  const { state, control } = await send({ type: "status" });
  const { displayMode = "panel" } = await chrome.storage.local.get("displayMode");
  $("display-mode").value = displayMode;
  const selected = state.sites.includes(host);
  const globalDirect = !!state.globalDirect;
  const blocked = !["controlled_by_this_extension", "controllable_by_this_extension"].includes(control);
  $("host").textContent = host || "—";
  document.body.dataset.faded = selected || globalDirect;
  soda.setActive(selected || globalDirect);
  orb.update(globalDirect, busy || !!tab?.incognito || (blocked && !globalDirect));
  $("toggle").hidden = globalDirect;
  $("action-label").textContent = selected ? "allow" : "fade";
  $("toggle").setAttribute("aria-label", selected ? "允许当前网站使用代理" : "禁用当前网站的代理");
  $("toggle").disabled = busy || !host || tab?.incognito || blocked;
  if (blocked) $("message").textContent = "代理由其他扩展或管理策略控制。";
  else if (tab?.incognito) $("message").textContent = "请在普通窗口使用。";
  else if (!host && !globalDirect) $("message").textContent = "请先打开一个网页。";
  else if ((selected || globalDirect) && control !== "controlled_by_this_extension") $("message").textContent = "规则暂未生效，请在设置中全部恢复后重试。";
  if (!portDirty) $("port").value = state.port || state.base?.rules?.singleProxy?.port || state.base?.rules?.proxyForHttp?.port || 7890;
  $("count").textContent = String(state.sites.length).padStart(2, "0");
  $("sites").replaceChildren();
  for (const name of state.sites) {
    const li = document.createElement("li"), label = document.createElement("span"), button = document.createElement("button");
    label.textContent = name; button.textContent = "allow ↗"; button.className = "text";
    button.setAttribute("aria-label", `允许 ${name} 使用代理`);
    button.addEventListener("click", () => run(async () => {
      await send({ type: "remove", host: name });
      await transition();
      if (name === host) await chrome.tabs.reload(tab.id);
    }));
    li.append(label, button); $("sites").append(li);
  }
  $("reset").hidden = !state.sites.length;
  $("reset").firstChild.textContent = globalDirect ? "清除网站规则 " : "全部恢复 ";
  $("empty").hidden = !!state.sites.length;
}
async function run(action) {
  if (busy) return;
  busy = true; $("message").textContent = "";
  document.querySelectorAll("button").forEach(button => button.disabled = true);
  $("display-mode").disabled = true;
  try { await refreshTab(); await action(); } catch (error) { $("message").textContent = error.message; }
  finally {
    busy = false;
    document.querySelectorAll("button").forEach(button => button.disabled = false);
    $("display-mode").disabled = false;
    try { await render(); } catch (error) { $("message").textContent = error.message; }
    if (refreshPending) { refreshPending = false; scheduleRefresh(); }
  }
}
$("toggle").addEventListener("click", () => run(async () => {
  $("action-label").textContent = "…";
  const result = await send({ type: "toggle", tabId: tab.id, host });
  if (!result.overlayPlayed) await transition();
  if (result.reloadFailed) $("message").textContent = "规则已保存，请手动刷新。";
}));
$("settings-toggle").addEventListener("click", () => {
  const open = $("settings").hidden;
  $("settings").hidden = !open; $("home").hidden = open;
  $("settings-toggle").setAttribute("aria-expanded", String(open));
  $("settings-toggle").setAttribute("aria-label", open ? "返回" : "设置");
  $("message").textContent = "";
  if (!open) orb.layout();
});
$("port").addEventListener("input", () => { portDirty = true; });
$("display-mode").addEventListener("change", () => {
  if (busy) return;
  const mode = $("display-mode").value;
  // Start both operations in the change gesture, before any await/refreshTab.
  const saving = send({ type: "setDisplayMode", mode });
  const opening = mode === "panel" && !document.body.classList.contains("side-panel")
    ? chrome.sidePanel.open({ windowId: tab.windowId }) : Promise.resolve();
  const switching = Promise.allSettled([saving, opening]);
  run(async () => {
    const results = await switching;
    for (const result of results) if (result.status === "rejected") throw result.reason;
    if (mode === "panel" && !document.body.classList.contains("side-panel")) window.close();
    else $("message").textContent = "已保存，扩展图标将使用所选模式。";
  });
});
$("port-form").addEventListener("submit", event => {
  event.preventDefault();
  run(async () => { await send({ type: "setPort", port: $("port").value }); portDirty = false; $("message").textContent = "已保存。"; });
});
$("reset").addEventListener("click", () => run(async () => {
  await send({ type: "reset" }); $("message").textContent = "已恢复。";
  await transition();
  if (host) await chrome.tabs.reload(tab.id);
}));
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  for (let i = 0; i < 18; i++) {
    const particle = document.createElement("i");
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.setProperty("--duration", `${6 + Math.random() * 8}s`);
    particle.style.setProperty("--delay", `${-Math.random() * 14}s`);
    document.querySelector(".particles").append(particle);
  }
  let frame = 0;
  const timer = setInterval(() => {
    $("boot-code").textContent = `0x${Math.floor(Math.random() * 65536).toString(16).padStart(4, "0")} :: ${["BIND", "SHIFT", "NULL", "SYNC"][frame % 4]}\n${["χ / ROUTE_MATRIX", "∅ / PACKET_VOID", "λ / SIGNAL_MASK"][frame % 3]}\n${"▓".repeat(frame + 4)}${"░".repeat(12 - frame)}`;
    if (++frame >= 7) clearInterval(timer);
  }, 90);
}
setTimeout(() => document.body.classList.add("ready"), 900);
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (busy) { refreshPending = true; return; }
    run(async () => {});
  }, 100);
}
chrome.tabs.onActivated.addListener(scheduleRefresh);
chrome.tabs.onUpdated.addListener((id, change) => {
  if (id === tab?.id && (change.url || change.status === "complete")) scheduleRefresh();
});
chrome.storage.onChanged.addListener(scheduleRefresh);
chrome.proxy.settings.onChange.addListener(scheduleRefresh);
run(async () => {});
