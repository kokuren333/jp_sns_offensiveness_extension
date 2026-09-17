let offscreenReady;
async function ensureOffscreen() {
  if (offscreenReady) return offscreenReady;
  offscreenReady = (async () => {
    const url = chrome.runtime.getURL("offscreen.html");
    const found = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [url] });
    if (!found.length) await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["WORKERS"], justification: "Run local ONNX Runtime WASM inference." });
  })().catch((e) => { offscreenReady = null; throw e; });
  return offscreenReady;
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.__fromOffscreen || message?.__fromServiceWorker) return false;
  if (!["GET_STATUS", "PREPARE_MODEL", "INFER", "CLEAR_MODEL_CACHE"].includes(message?.type)) return false;
  ensureOffscreen().then(() => chrome.runtime.sendMessage({ ...message, __fromServiceWorker: true }))
    .then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "OPEN_COMPOSE" || !message.tabId) return false;
  chrome.tabs.sendMessage(message.tabId, { type: "OPEN_COMPOSE", text: message.text || "" }, async () => {
    if (!chrome.runtime.lastError) { sendResponse({ ok: true }); return; }
    try {
      await chrome.scripting.executeScript({ target: { tabId: message.tabId }, files: ["content.js"] });
      await chrome.scripting.insertCSS({ target: { tabId: message.tabId }, files: ["content.css"] });
      await chrome.tabs.sendMessage(message.tabId, { type: "OPEN_COMPOSE", text: message.text || "" });
      sendResponse({ ok: true });
    } catch (e) { sendResponse({ ok: false, error: String(e?.message || e) }); }
  });
  return true;
});
