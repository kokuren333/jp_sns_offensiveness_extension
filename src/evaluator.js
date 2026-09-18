
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
    scoreMain.textContent = x.decision;
    scoreDetail.textContent = `毒性スコア ${pct(x.toxicity_score)} / コンテンツリスク ${pct(x.content_risk_score)}`;
    decisionBadge.textContent = x.decision;
    decisionBadge.className = `badge ${x.toxic&&x.erotic?"danger":x.toxic||x.erotic?"review":"safe"}`;
    meter.style.width = `${Math.max(x.toxicity_score, x.content_risk_score) * 100}%`;
    meter.className = `meter-fill ${x.toxic&&x.erotic?"danger":x.toxic||x.erotic?"review":"safe"}`;
    result.querySelector(".axis-bars")?.remove();
    const labels={insult:"侮辱",threat:"脅迫",obscene:"下品",identity_attack:"属性攻撃",sexual_explicit:"性的露出",indirect_hostility:"間接的敵意"};
    const bars=Object.entries(labels).map(([k,v])=>`<div class="axis-row"><span>${v}</span><i><b style="width:${x.scores[k]*100}%"></b></i><em>${pct(x.scores[k])}</em></div>`).join("");
    result.insertAdjacentHTML("beforeend",`<div class="axis-bars">${bars}</div>`);
    result.hidden = false;
    status.textContent = "ローカル推論完了";
  } catch (e) {
    status.textContent = `エラー: ${e.message}`;
  } finally {
    button.disabled = false;
  }
});
