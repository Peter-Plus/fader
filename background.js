import { website, localProxy, withSites } from "./core.js";
import { restoreDisplayMode, setDisplayMode } from "./display-mode.js";

// Register listeners immediately; restore the toolbar mode on every worker start.
const displayReady = chrome.sidePanel ? restoreDisplayMode().catch(error => console.error("Fader display mode", error)) : Promise.resolve();

const call = (object, method, args) => new Promise((resolve, reject) => {
  object[method](args, result => {
    const error = chrome.runtime.lastError;
    error ? reject(new Error(error.message)) : resolve(result);
  });
});
const getProxy = () => call(chrome.proxy.settings, "get", { incognito: false });
const empty = () => ({ sites: [], base: null });
const read = async () => (await chrome.storage.local.get("state")).state || empty();

async function save(next) {
  const previous = await read();
  const before = await getProxy();
  if ((next.globalDirect || next.sites.length) && !["controllable_by_this_extension", "controlled_by_this_extension"].includes(before.levelOfControl)) {
    throw new Error("代理正由其他扩展或浏览器管理策略控制。请先关闭其他代理扩展。");
  }
  const apply = async state => {
    if (state.globalDirect) await call(chrome.proxy.settings, "set", { value: { mode: "direct" }, scope: "regular" });
    else if (state.sites.length) await call(chrome.proxy.settings, "set", { value: withSites(state.base, state.sites), scope: "regular" });
    else await call(chrome.proxy.settings, "clear", { scope: "regular" });
  };
  await apply(next);
  try { await chrome.storage.local.set({ state: next }); }
  catch (error) {
    if (before.levelOfControl === "controlled_by_this_extension") await apply(previous);
    else await call(chrome.proxy.settings, "clear", { scope: "regular" });
    throw error;
  }
}

async function handle(message) {
  if (message.type === "setDisplayMode") {
    await displayReady;
    await setDisplayMode(message.mode);
    return {};
  }
  const state = await read();
  const proxy = await getProxy();
  if (message.type === "status") return { state, control: proxy.levelOfControl };
  if (message.type === "setGlobalDirect") {
    if (typeof message.enabled !== "boolean") throw new Error("无效的开关状态。");
    await save({ ...state, globalDirect: message.enabled });
    return {};
  }
  if (message.type === "setPort") {
    const base = localProxy(message.port);
    await save({ ...state, port: base.rules.singleProxy.port, base: state.sites.length ? base : null });
    return {};
  }
  const cleared = () => ({ ...empty(), globalDirect: !!state.globalDirect, ...(state.port ? { port: state.port } : {}) });
  if (message.type === "reset") { await save(cleared()); return {}; }
  if (message.type === "remove") {
    const sites = state.sites.filter(host => host !== message.host);
    await save(sites.length ? { ...state, sites } : cleared());
    return {};
  }
  if (message.type !== "toggle") throw new Error("未知操作。");
  if (state.globalDirect) throw new Error("请先关闭全局直连。");
  const tab = await chrome.tabs.get(message.tabId);
  if (tab.incognito) throw new Error("请在普通窗口使用 Fader。");
  const host = website(tab.url);
  if (!host) throw new Error("请先打开一个普通网页。");
  if (host !== message.host) throw new Error("当前页面已改变，请重新打开插件。");
  const removing = state.sites.includes(host);
  const sites = removing ? state.sites.filter(item => item !== host) : [...state.sites, host];
  let base = state.base;
  if (sites.length && !base) {
    if (state.port) base = localProxy(state.port);
    else if (proxy.value?.mode === "fixed_servers") base = proxy.value;
    else if (message.port !== undefined) base = localProxy(message.port);
    else base = localProxy(7890);
  }
  await save(sites.length ? { ...state, sites, base } : cleared());
  let reloadFailed = false;
  try { await chrome.tabs.reload(tab.id); } catch { reloadFailed = true; }
  return { reloadFailed };
}

let queue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.tab) return false;
  // A popup can disappear during reload. Its response channel must never
  // become part of the serialized mutation queue.
  const operation = queue.then(() => handle(message));
  queue = operation.then(() => undefined, () => undefined);
  const reply = payload => {
    try { respond(payload); } catch { /* The popup has already closed. */ }
  };
  operation.then(data => reply({ ok: true, ...data }), error => reply({ ok: false, error: error.message }));
  return true;
});
