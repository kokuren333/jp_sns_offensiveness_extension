
const openBtn = document.querySelector("#openEvaluator");
const hoverToggle = document.querySelector("#hoverToggle");
const status = document.querySelector("#modelStatus");
const prep = document.querySelector("#prepare");
const clear = document.querySelector("#clear");

chrome.storage.local.get({ hoverEnabled: true }, (v) => {
  hoverToggle.checked = v.hoverEnabled;
});
hoverToggle.addEventListener("change", () => {
  chrome.storage.local.set({ hoverEnabled: hoverToggle.checked });
});

openBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.runtime.sendMessage({ type: "OPEN_COMPOSE", tabId: tab.id }).catch(() => {});
});

async function refresh() {
  const r = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  const s = r?.state;
  status.textContent = s?.error ? `${s.detail}: ${s.error}` : (s?.detail || "未初期化");
}
prep.addEventListener("click", async () => {
  status.textContent = "準備中…";
  chrome.runtime.sendMessage({ type: "PREPARE_MODEL" }).catch(() => {});
  for (let i = 0; i < 240; i++) {
    await new Promise(r => setTimeout(r, 250));
    await refresh();
    const x = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    if (["ready", "error"].includes(x?.state?.phase)) break;
  }
});
clear.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "CLEAR_MODEL_CACHE" });
  refresh();
});
refresh();
