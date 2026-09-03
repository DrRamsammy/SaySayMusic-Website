const API_BASE = 'https://saysay-learning-games.saysaydeducator.workers.dev';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, service: 'saysay-learning-games-player' }), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    return new Response(PAGE, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  },
};

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SaySayMusic Learning Games</title>
<style>
:root{--bg:#f4f7fb;--card:#fff;--ink:#172033;--muted:#667085;--line:#dbe3ee;--accent:#2457e6;--accent2:#173da8;--good:#167a55;--bad:#bd3434;--shadow:0 18px 48px rgba(31,50,90,.10)}*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:linear-gradient(180deg,#eef3ff 0,#f8fafc 36%,#f4f7fb 100%);color:var(--ink)}button,select{font:inherit}.shell{max-width:1280px;margin:auto;padding:24px}.topbar{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:18px}.brand{display:flex;align-items:center;gap:13px}.mark{width:52px;height:52px;border-radius:15px;background:linear-gradient(135deg,#173da8,#4f7cff);display:grid;place-items:center;color:#fff;font-weight:900;box-shadow:0 10px 30px rgba(36,87,230,.25)}.brand strong{display:block;font-size:20px}.brand small{color:var(--muted)}select{background:#fff;border:1px solid var(--line);border-radius:11px;padding:10px 13px}.hero{background:linear-gradient(135deg,#10275f,#2457e6);color:#fff;border-radius:24px;padding:26px 30px;box-shadow:var(--shadow);margin-bottom:18px}.crumbs{font-size:13px;opacity:.85;margin-bottom:8px}.hero h1{margin:0;font-size:34px}.hero p{margin:8px 0 0;opacity:.9}.layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:18px}.card{background:var(--card);border:1px solid rgba(219,227,238,.9);border-radius:22px;box-shadow:var(--shadow)}.reading{padding:30px}.eyebrow{font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:13px}.passage{font-size:21px;line-height:1.9}.blank{min-width:118px;min-height:42px;display:inline-flex;vertical-align:middle;align-items:center;justify-content:center;border:2px dashed #aab6c8;background:#f8faff;border-radius:9px;padding:4px 10px;margin:0 3px;transition:.15s}.blank.active{border-color:var(--accent);background:#edf3ff}.blank.correct{border-style:solid;border-color:var(--good);background:#edf8f3}.blank.incorrect{border-style:solid;border-color:var(--bad);background:#fff0f0}.bank{padding:24px;height:max-content;position:sticky;top:16px}.bank h2{margin:0 0 6px}.bank p{margin:0 0 16px;color:var(--muted);font-size:14px}.words{display:flex;flex-wrap:wrap;gap:10px}.word{border:1px solid #ccd6e5;background:#fff;border-radius:12px;padding:10px 13px;font-weight:800;cursor:grab;box-shadow:0 4px 12px rgba(25,42,75,.06)}.word.selected{outline:3px solid rgba(36,87,230,.18);border-color:var(--accent)}.word.used{display:none}.footer{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px 22px;margin-top:18px}.progress{font-size:14px;color:var(--muted)}.result{font-weight:900;margin-top:3px}.result.good{color:var(--good)}.result.bad{color:var(--bad)}.actions{display:flex;gap:10px}.btn{border:0;border-radius:11px;padding:11px 17px;font-weight:900;cursor:pointer}.secondary{background:#edf1f7;color:#24314b}.primary{background:var(--accent);color:#fff}.primary:hover{background:var(--accent2)}.notice{padding:18px 22px;margin-bottom:18px;color:var(--bad);display:none}.explanation{display:none;padding:20px 24px;margin-top:18px}.explanation h3{margin:0 0 7px}.explanation p{margin:0;line-height:1.6;color:#3c485c}@media(max-width:850px){.layout{grid-template-columns:1fr}.bank{position:static}.topbar{align-items:flex-start;flex-direction:column}.passage{font-size:18px}.hero h1{font-size:28px}}@media(max-width:560px){.shell{padding:12px}.reading{padding:20px}.footer{align-items:stretch;flex-direction:column}.actions{display:grid;grid-template-columns:1fr 1fr}.btn{width:100%}}
</style>
</head>
<body>
<div class="shell">
  <div class="topbar"><div class="brand"><div class="mark">SS</div><div><strong>SaySayMusic Learning Games</strong><small>Education Through Melody</small></div></div><select id="language" aria-label="Language"><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option></select></div>
  <div id="notice" class="card notice"></div>
  <section class="hero"><div id="crumbs" class="crumbs">Learning Games</div><h1 id="title">Loading...</h1><p id="instructions"></p></section>
  <div class="layout"><main class="card reading"><div class="eyebrow" id="eyebrow">Read and complete</div><div id="passage" class="passage"></div></main><aside class="card bank"><h2 id="bankTitle">Word Bank</h2><p id="bankHelp">Drag a word, or tap a word and then tap a blank.</p><div id="words" class="words"></div></aside></div>
  <div class="card footer"><div><div id="progress" class="progress"></div><div id="result" class="result"></div></div><div class="actions"><button id="reset" class="btn secondary">Reset</button><button id="submit" class="btn primary">Submit</button></div></div>
  <div id="explanation" class="card explanation"><h3 id="explanationTitle">Why it matters</h3><p id="explanationText"></p></div>
</div>
<script>
const API_BASE=${JSON.stringify(API_BASE)};
const SLUG=new URLSearchParams(location.search).get('game')||'cell-membrane-001';
const labels={en:{eyebrow:'Read and complete',bank:'Word Bank',help:'Drag a word, or tap a word and then tap a blank.',reset:'Reset',submit:'Submit',progress:(n,t)=>n+' of '+t+' blanks completed',score:(s,t,p)=>'Score: '+s+'/'+t+' ('+p+'%)',why:'Why it matters'},es:{eyebrow:'Lee y completa',bank:'Banco de palabras',help:'Arrastra una palabra, o toca una palabra y luego un espacio.',reset:'Reiniciar',submit:'Enviar',progress:(n,t)=>n+' de '+t+' espacios completados',score:(s,t,p)=>'Puntuación: '+s+'/'+t+' ('+p+'%)',why:'Por qué es importante'},fr:{eyebrow:'Lisez et complétez',bank:'Banque de mots',help:'Faites glisser un mot, ou touchez un mot puis un espace.',reset:'Réinitialiser',submit:'Soumettre',progress:(n,t)=>n+' sur '+t+' espaces complétés',score:(s,t,p)=>'Score : '+s+'/'+t+' ('+p+'%)',why:'Pourquoi c’est important'}};
let lang='en',game=null,selected=null,placements={};const $=id=>document.getElementById(id);
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
async function load(){try{$('notice').style.display='none';const r=await fetch(API_BASE+'/api/games/'+encodeURIComponent(SLUG)+'?lang='+lang);if(!r.ok)throw new Error('Unable to load game ('+r.status+')');const data=await r.json();game=data.game;render()}catch(e){$('title').textContent='Learning Game';$('notice').textContent=e.message;$('notice').style.display='block'}}
function render(){selected=null;placements={};const L=labels[lang];$('title').textContent=game.title;$('instructions').textContent=game.instructions||'';$('crumbs').textContent='Learning Games › '+(game.path||[]).map(x=>x.name).join(' › ');$('eyebrow').textContent=L.eyebrow;$('bankTitle').textContent=L.bank;$('bankHelp').textContent=L.help;$('reset').textContent=L.reset;$('submit').textContent=L.submit;$('explanationTitle').textContent=L.why;$('explanationText').textContent=game.explanation||'';$('explanation').style.display='none';const answers=game.answers||[];const amap=Object.fromEntries(answers.map(a=>[a.blank_key,a.answer_text]));$('passage').innerHTML=String(game.passage||'').replace(/\{\{(b\d+)\}\}/g,(_,key)=>'<span class="blank" tabindex="0" data-key="'+esc(key)+'" data-answer="'+esc(amap[key]||'')+'"></span>');$('words').innerHTML=shuffle(answers).map((a,i)=>'<button class="word" draggable="true" data-word="'+esc(a.answer_text)+'" data-id="w'+i+'">'+esc(a.answer_text)+'</button>').join('');$('result').textContent='';wire();updateProgress()}
function wire(){document.querySelectorAll('.word').forEach(w=>{w.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',w.dataset.word));w.addEventListener('click',()=>{document.querySelectorAll('.word').forEach(x=>x.classList.remove('selected'));selected=w.dataset.word;w.classList.add('selected')})});document.querySelectorAll('.blank').forEach(b=>{b.addEventListener('dragover',e=>{e.preventDefault();b.classList.add('active')});b.addEventListener('dragleave',()=>b.classList.remove('active'));b.addEventListener('drop',e=>{e.preventDefault();place(b,e.dataTransfer.getData('text/plain'));b.classList.remove('active')});b.addEventListener('click',()=>{if(selected)place(b,selected)});b.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&selected){e.preventDefault();place(b,selected)}})})}
function place(blank,word){const key=blank.dataset.key,old=placements[key];if(old)showWord(old);placements[key]=word;blank.textContent=word;blank.classList.remove('correct','incorrect');hideWord(word);selected=null;document.querySelectorAll('.word').forEach(x=>x.classList.remove('selected'));updateProgress()}
function hideWord(word){const w=[...document.querySelectorAll('.word')].find(x=>x.dataset.word===word&&!x.classList.contains('used'));if(w)w.classList.add('used')}
function showWord(word){const w=[...document.querySelectorAll('.word')].find(x=>x.dataset.word===word);if(w)w.classList.remove('used')}
function updateProgress(){const t=document.querySelectorAll('.blank').length,n=Object.keys(placements).length;$('progress').textContent=labels[lang].progress(n,t)}
$('language').onchange=e=>{lang=e.target.value;load()};$('reset').onclick=()=>render();$('submit').onclick=async()=>{const blanks=[...document.querySelectorAll('.blank')];let score=0;blanks.forEach(b=>{const ok=(placements[b.dataset.key]||'')===b.dataset.answer;b.classList.toggle('correct',ok);b.classList.toggle('incorrect',!ok);if(ok)score++});const pct=blanks.length?Math.round(score/blanks.length*100):0;$('result').textContent=labels[lang].score(score,blanks.length,pct);$('result').className='result '+(score===blanks.length?'good':'bad');$('explanation').style.display='block';try{await fetch(API_BASE+'/api/attempts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({game_id:game.id,language:lang,score,max_score:blanks.length})})}catch{}};load();
</script>
</body></html>`;