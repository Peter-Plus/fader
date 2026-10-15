export async function applyDisplayMode(mode) {
  const panel = mode !== "popup";
  await chrome.action.setPopup({ popup: panel ? "" : "popup.html" });
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: panel });
  // Keep the panel available so a popup user gesture can open it immediately.
  // The toolbar's selected entry point is controlled above, independently.
  await chrome.sidePanel.setOptions({ path: "popup.html?panel=1", enabled: true });
}

export async function setDisplayMode(mode) {
  if (!["panel", "popup"].includes(mode)) throw new Error("无效的显示模式。");
  const { displayMode = "panel" } = await chrome.storage.local.get("displayMode");
  await chrome.storage.local.set({ displayMode: mode });
  try { await applyDisplayMode(mode); }
  catch (error) {
    await chrome.storage.local.set({ displayMode });
    await applyDisplayMode(displayMode);
    throw error;
  }
}

export async function restoreDisplayMode() {
  const { displayMode = "panel" } = await chrome.storage.local.get("displayMode");
  await applyDisplayMode(displayMode);
}
