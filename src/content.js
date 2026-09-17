
let hoverEnabled = true;
chrome.storage.local.get({ hoverEnabled: true }, (v) => {
  hoverEnabled = v.hoverEnabled;
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.hoverEnabled) hoverEnabled = changes.hoverEnabled.newValue;
});

const cache = new Map();
let timer = null;
let tooltip = null;
let activeArticle = null;
let requestSeq = 0;
let selectionTooltip = null;
let composePanel = null;
let chipTimer = null;

function removeChip() {
  clearTimeout(chipTimer);
  tooltip?.remove();
  selectionTooltip?.remove();
  tooltip = null;
  selectionTooltip = null;
}

function scheduleChipRemoval(chip) {
  clearTimeout(chipTimer);
  chipTimer = setTimeout(() => {
    if (tooltip === chip || selectionTooltip === chip) removeChip();
  }, 6000);
}

function placeTooltip(tip, rect, width = 220) {
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left));
  const top = rect.top >= 56 ? rect.top - 48 : Math.min(window.innerHeight - 48, rect.bottom + 8);
  tip.style.left = `${window.scrollX + left}px`;
  tip.style.top = `${window.scrollY + Math.max(8, top)}px`;
}

function ensureComposePanel() {
  if (composePanel?.isConnected) return composePanel;
  composePanel = document.createElement("section");
  composePanel.className = "jp-off-compose";
  composePanel.innerHTML = `<div class="jp-off-compose-head"><strong>投稿前チェック</strong><button class="jp-off-close" aria-label="閉じる">×</button></div><textarea maxlength="5000" placeholder="チェックする文章を入力"></textarea><div class="jp-off-compose-actions"><span class="jp-off-compose-status">入力中に自動評価</span><button class="jp-off-copy">コピーする</button></div><div class="jp-off-compose-result" hidden></div>`;
  document.documentElement.appendChild(composePanel);
  const input = composePanel.querySelector("textarea");
  const result = composePanel.querySelector(".jp-off-compose-result");
  const status = composePanel.querySelector(".jp-off-compose-status");
  composePanel.querySelector(".jp-off-close").onclick = () => composePanel.remove();
  const header = composePanel.querySelector(".jp-off-compose-head");
  let dragging = false, dx = 0, dy = 0;
  header.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    const rect = composePanel.getBoundingClientRect();
    dragging = true; dx = e.clientX - rect.left; dy = e.clientY - rect.top;
    header.setPointerCapture(e.pointerId); e.preventDefault();
  });
  header.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const x = Math.max(0, Math.min(window.innerWidth - composePanel.offsetWidth, e.clientX - dx));
    const y = Math.max(0, Math.min(window.innerHeight - composePanel.offsetHeight, e.clientY - dy));
    composePanel.style.left = `${x}px`; composePanel.style.top = `${y}px`;
    composePanel.style.right = "auto"; composePanel.style.bottom = "auto";
  });
  header.addEventListener("pointerup", () => { dragging = false; });
  let inputTimer;
  async function evaluateDraft() {
    const text = input.value.trim(); if (!text) { result.hidden=true; status.textContent="入力中に自動評価"; return; }
    status.textContent = "解析中…";
    try { const r = await chrome.runtime.sendMessage({ type: "INFER", text }); if (!r?.ok) throw Error(r?.error || "推論失敗"); const x=r.result; result.hidden=false; result.textContent=`攻撃性 ${(x.p_offensive*100).toFixed(1)}% · ${x.decision}`; status.textContent="自動評価済み"; } catch(e) { status.textContent=`エラー: ${e.message}`; }
  }
  input.addEventListener("input", () => { clearTimeout(inputTimer); inputTimer=setTimeout(evaluateDraft,350); });
  composePanel.querySelector(".jp-off-copy").onclick = async () => {
    const text = input.value.trim(); if (!text) return;
    try { await navigator.clipboard.writeText(text); status.textContent="クリップボードへコピー済み"; } catch { status.textContent="コピーできませんでした"; }
  };
  return composePanel;
}

function openComposePanel(text = "") { const p=ensureComposePanel(); p.querySelector("textarea").value=text; p.querySelector("textarea").focus(); }

chrome.runtime.onMessage.addListener((message) => { if (message?.type === "OPEN_COMPOSE") openComposePanel(message.text || ""); });

let selectionTimer;
document.addEventListener("mouseup", () => {
  clearTimeout(selectionTimer);
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const text = selection.toString().trim();
  const anchor = selection.anchorNode?.nodeType === Node.ELEMENT_NODE
    ? selection.anchorNode : selection.anchorNode?.parentElement;
  const rect = anchor?.getBoundingClientRect?.();
  if (!rect) return;
  if (!text || text.length < 2 || !rect.width && !rect.height) return;
  selectionTimer = setTimeout(async () => {
    removeChip();
    const tip = document.createElement("div");
    selectionTooltip = tip;
    tip.className = "jp-off-tooltip";
    tip.innerHTML = `<span class="jp-off-dot loading"></span><span>解析中…</span>`;
    placeTooltip(tip, rect);
    document.documentElement.appendChild(tip);
    scheduleChipRemoval(tip);
    try { const r=await chrome.runtime.sendMessage({type:"INFER",text}); if (r?.ok && selectionTooltip === tip) { const cls=r.result.decision === "OFFENSIVE" ? "danger" : r.result.decision === "REVIEW" ? "review" : "safe"; tip.innerHTML=`<span class="jp-off-dot ${cls}"></span><strong>${(r.result.p_offensive*100).toFixed(1)}%</strong><span>${r.result.decision}</span>`; } else tip.remove(); } catch { tip.remove(); }
  }, 350);
}, true);

function isInsideQuotedStatus(el, article) {
  let node = el.parentElement;
  while (node && node !== article) {
    if (node.getAttribute?.("role") === "link") {
      const href = node.getAttribute("href") ||
        node.querySelector?.('a[href*="/status/"]')?.getAttribute("href");
      if (href?.includes("/status/")) return true;
    }
    const a = node.matches?.('a[href*="/status/"]')
      ? node
      : node.querySelector?.(':scope > a[href*="/status/"]');
    if (a && node !== article) return true;
    node = node.parentElement;
  }
  return false;
}

function getPrimaryTweetText(article) {
  const candidates = [...article.querySelectorAll('[data-testid="tweetText"]')];
  for (const el of candidates) {
    if (!isInsideQuotedStatus(el, article)) {
      const text = el.innerText?.trim();
      if (text) return text;
    }
  }
  // Deliberately do not fall back to quoted tweet text.
  return "";
}

function ensureTooltip(article) {
  if (tooltip?.isConnected && activeArticle === article) return tooltip;
  removeChip();
  activeArticle = article;
  tooltip = document.createElement("div");
  tooltip.className = "jp-off-tooltip";
  tooltip.innerHTML = `<span class="jp-off-dot loading"></span><span>解析中…</span>`;
  const rect = article.getBoundingClientRect();
  placeTooltip(tooltip, rect);
  document.documentElement.appendChild(tooltip);
  scheduleChipRemoval(tooltip);
  return tooltip;
}

function renderTooltip(article, data) {
  const tip = ensureTooltip(article);
  const cls = data.decision === "OFFENSIVE" ? "danger"
    : data.decision === "REVIEW" ? "review" : "safe";
  tip.innerHTML = `
    <span class="jp-off-dot ${cls}"></span>
    <strong>${(data.p_offensive * 100).toFixed(1)}%</strong>
    <span>${data.decision}</span>
    <small>raw ${(data.raw_score * 100).toFixed(1)}%</small>
  `;
}

async function analyzeArticle(article) {
  const text = getPrimaryTweetText(article);
  if (!text) return;
  const seq = ++requestSeq;
  const tip = ensureTooltip(article);

  if (cache.has(text)) {
    renderTooltip(article, cache.get(text));
    return;
  }

  tip.innerHTML = `<span class="jp-off-dot loading"></span><span>解析中…</span>`;
  try {
    const res = await chrome.runtime.sendMessage({ type: "INFER", text });
    if (seq !== requestSeq || activeArticle !== article) return;
    if (!res?.ok) throw new Error(res?.error || "推論失敗");
    cache.set(text, res.result);
    renderTooltip(article, res.result);
  } catch (e) {
    if (seq !== requestSeq || activeArticle !== article) return;
    tip.innerHTML = `<span class="jp-off-dot error"></span><span>解析失敗</span>`;
    tip.title = e.message;
  }
}

document.addEventListener("mouseover", (event) => {
  if (!hoverEnabled) return;
  if (!/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//.test(location.href)) return;
  const article = event.target.closest?.('article[data-testid="tweet"]');
  if (!article || article === activeArticle) return;
  clearTimeout(timer);
  activeArticle = article;
  timer = setTimeout(() => analyzeArticle(article), 350);
}, true);

document.addEventListener("mouseout", (event) => {
  const article = event.target.closest?.('article[data-testid="tweet"]');
  if (!article || article !== activeArticle) return;
  if (article.contains(event.relatedTarget)) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    tooltip?.remove();
    tooltip = null;
    activeArticle = null;
    requestSeq++;
  }, 180);
}, true);
