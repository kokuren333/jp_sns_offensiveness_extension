const MAX=280;
const AXES=[
  ['insult','侮辱'],['threat','脅迫'],['identity_attack','属性攻撃'],
  ['indirect_hostility','間接敵意'],['obscene','卑俗'],['sexual_explicit','露骨な性的表現']
];
const input=document.querySelector('#tweetText'),count=document.querySelector('#count'),btn=document.querySelector('#evaluate'),status=document.querySelector('#status'),result=document.querySelector('#result'),scoreMain=document.querySelector('#scoreMain'),scoreDetail=document.querySelector('#scoreDetail'),badge=document.querySelector('#decisionBadge'),chart=document.querySelector('#axisChart');
function updateCount(){const n=[...input.value].length;count.textContent=`${n} / ${MAX}`;count.classList.toggle('over',n>MAX)}
input.addEventListener('input',updateCount); updateCount();
const pct=v=>`${(100*Number(v||0)).toFixed(1)}%`;
function className(c){return c==='毒チワワ'?'poison':c==='エロチワワ'?'ero':c==='毒エロチワワ'?'both':'plain'}
function render(r){result.hidden=false; scoreMain.textContent=r.classification; scoreDetail.textContent=`毒 ${pct(r.toxic_score)} · エロ ${pct(r.erotic_score)}`; badge.textContent=r.classification; badge.className=`badge ${className(r.classification)}`; chart.innerHTML=AXES.map(([k,l])=>`<div class="axis-row"><span class="axis-label">${l}</span><div class="axis-track"><i style="width:${Math.max(0,Math.min(100,(r.scores[k]||0)*100))}%"></i></div><strong>${pct(r.scores[k])}</strong></div>`).join('')}
async function waitReady(){for(;;){const s=(await chrome.runtime.sendMessage({type:'GET_STATUS'}))?.state;if(s){status.textContent=s.detail||s.phase;if(['ready','error'].includes(s.phase))return}await new Promise(r=>setTimeout(r,250))}}
btn.addEventListener('click',async()=>{const text=input.value.trim();if(!text)return;btn.disabled=true;result.hidden=true;status.textContent='モデルを準備しています…';try{const res=await chrome.runtime.sendMessage({type:'INFER',text});if(!res?.ok)throw Error(res?.error||'推論失敗');render(res.result);status.textContent='評価完了'}catch(e){status.textContent=`エラー: ${e.message}`}finally{btn.disabled=false}});
