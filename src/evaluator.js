
import { TWEET_LIMIT } from "./constants.js";

const textarea = document.querySelector("#tweetText");
const count = document.querySelector("#count");
const button = document.querySelector("#evaluate");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const meter = document.querySelector("#meterFill");
const scoreMain = document.querySelector("#scoreMain");
const scoreDetail = document.querySelector("#scoreDetail");
const decisionBadge = document.querySelector("#decisionBadge");

function updateCount() {
  const n = [...textarea.value].length;
  count.textContent = `${n} / ${TWEET_LIMIT}`;
  count.classList.toggle("over", n > TWEET_LIMIT);
}
textarea.addEventListener("input", updateCount);
updateCount();

function pct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

function decisionClass(d) {
  return d === "OFFENSIVE" ? "danger" : d === "REVIEW" ? "review" : "safe";
}

async function pollStatusUntilDone() {
  for (;;) {
    const r = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    const s = r?.state;
    if (s) {
      status.textContent = s.detail || s.phase;
      if (s.phase === "ready" || s.phase === "error") return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

button.addEventListener("click", async () => {
  const text = textarea.value.trim();
  if (!text) return;
  button.disabled = true;
  result.hidden = true;
  status.textContent = "モデルを準備しています。初回はHFから約28MBをダウンロードします…";

  const polling = pollStatusUntilDone();
  try {
    const res = await chrome.runtime.sendMessage({ type: "INFER", text });
    await polling;
    if (!res?.ok) throw new Error(res?.error || "推論に失敗しました");

    const x = res.result;
    scoreMain.textContent = `攻撃性 ${pct(x.p_offensive)}`;
    scoreDetail.textContent =
      `raw ${pct(x.raw_score)} / calibrated ${pct(x.p_offensive)} / ` +
      `balanced threshold ${pct(x.balanced_threshold)}`;
    decisionBadge.textContent = x.decision;
    decisionBadge.className = `badge ${decisionClass(x.decision)}`;
    meter.style.width = `${Math.min(100, Math.max(0, x.p_offensive * 100))}%`;
    meter.className = `meter-fill ${decisionClass(x.decision)}`;
    result.hidden = false;
    status.textContent = "ローカル推論完了";
  } catch (e) {
    status.textContent = `エラー: ${e.message}`;
  } finally {
    button.disabled = false;
  }
});
