/**
 * SaySayMusic AI Music Builder
 * Separate Cloudflare Worker for musicbuilder.saysaymusic.com
 * Required binding: Workers AI as AI
 */

const APP_API = "https://stream.saysaymusic.com";
const TEXT_MODEL = "@cf/openai/gpt-oss-20b";
const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

function json(value, status) {
  return new Response(JSON.stringify(value), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

async function requireCreator(request) {
  const cookie = request.headers.get("Cookie") || "";
  if (!cookie) return null;
  const response = await fetch(APP_API + "/api/me", { headers: { Cookie: cookie } });
  if (!response.ok) return null;
  const data = await response.json();
  const user = data && data.user;
  const role = String((user && user.role) || "").toLowerCase();
  return user && (role === "admin" || role === "creator" || role === "artist") ? user : null;
}

function extractJson(text) {
  text = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The AI response could not be read.");
  return JSON.parse(text.slice(start, end + 1));
}

async function runText(env, prompt, maxTokens) {
  if (!env.AI) throw new Error("Workers AI binding AI is not configured.");
  const result = await env.AI.run(TEXT_MODEL, {
    messages: [
      { role: "system", content: "You are the SaySayMusic college-level educational music editor. Follow the requested JSON format exactly." },
      { role: "user", content: prompt }
    ],
    max_tokens: maxTokens || 3000,
    temperature: 0.35
  });
  return result && (
    result.response ||
    result.output_text ||
    (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) ||
    result.result
  );
}

async function makePlan(request, env) {
  const body = await request.json();
  const topic = String(body.topic || "").trim();
  if (!topic) return json({ error: "Enter a topic first." }, 400);
  const prompt = [
    "Create a complete SaySayMusic educational album plan.",
    "MAIN TOPIC: " + topic,
    "LEVEL: " + String(body.level || "College / Medical School"),
    "",
    "Use the number of albums genuinely needed for complete coverage. Each album should normally contain 8-10 songs.",
    "Use a logical teaching order. Song titles must be exact scientific subtopics, never creative song names.",
    "At college level preserve biochemical integrity. Include structure, function, mechanisms, regulation, pathways, clinical importance, diseases, deficiencies, genetics and drugs when relevant.",
    "Do not omit essential material and do not duplicate topics.",
    'Return ONLY JSON: {"albums":[{"title":"' + topic + ' Album 1: Descriptive Title","songs":[{"title":"Scientific Subtopic"}]}]}'
  ].join("\n");
  const data = extractJson(await runText(env, prompt, 3000));
  if (!Array.isArray(data.albums) || !data.albums.length) throw new Error("No album plan was returned.");
  return json(data);
}

async function makeSong(request, env) {
  const body = await request.json();
  const prompt = [
    "Write one SaySayMusic educational song package.",
    "MAIN TOPIC: " + body.topic,
    "ALBUM: " + body.albumTitle,
    "EXACT SONG TITLE: " + body.songTitle,
    "LEVEL: " + String(body.level || "College / Medical School"),
    "OTHER SONGS IN THIS ALBUM: " + (body.albumSongs || []).join("; "),
    "",
    "Never rename, add, skip or replace the approved topic.",
    "Maintain rigorous college-level scientific integrity. Never sacrifice accuracy for rhyme.",
    "Teach the essential structure, function, biochemical mechanism, regulation, relationships and clinical importance for this exact topic.",
    "Include diseases, deficiencies, genetics, diagnosis or medications only when relevant.",
    "Do not take over material assigned to other songs.",
    "Put clear phonetic respellings inside the lyrics for difficult scientific terms. Never put phonetics in the title.",
    "Choose a high-performance genre with detailed vocal, tempo, instrument and production direction. English vocals. Maintain musical variety.",
    "Use [Intro], [Chorus], [Verse 1], [Chorus], [Verse 2], [Chorus], more verses when scientifically necessary, [Final Chorus], [SaySayMusic Tag].",
    "The final tag includes SaySayMusic and Education Through Melody.",
    'Return ONLY JSON: {"genre":"Complete musical direction","lyrics":"Complete lyrics with section labels"}'
  ].join("\n");
  const data = extractJson(await runText(env, prompt, 4000));
  if (!data.genre || !data.lyrics) throw new Error("The AI did not return a complete song.");
  return json(data);
}

async function makeCover(request, env) {
  const body = await request.json();
  if (!env.AI) throw new Error("Workers AI binding AI is not configured.");
  const prompt = [
    "Premium square album cover for SaySayMusic.",
    "Exact album title: " + body.albumTitle + ".",
    "Scientific subject: " + body.topic + ".",
    "Cinematic scientifically accurate imagery, college-level educational tone, luminous molecular forms, subtle music energy, navy blue, gold and vibrant scientific colors.",
    'Include only the exact album title and "SaySayMusic". No track list, extra words, logos or watermark.'
  ].join(" ");
  const image = await env.AI.run(IMAGE_MODEL, { prompt: prompt, steps: 8 });
  return new Response(image, { headers: { "content-type": "image/png", "cache-control": "no-store" } });
}

const PAGE = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SaySayMusic AI Music Builder</title>
<style>
:root{--navy:#092b5c;--blue:#0b63ce;--gold:#f1b82d;--green:#198754;--ink:#12213a;--line:#d7e0eb;--pale:#f3f6fb}
*{box-sizing:border-box}body{margin:0;background:var(--pale);color:var(--ink);font:17px/1.5 Arial,sans-serif}button,input,select,textarea{font:inherit}button{cursor:pointer}button:focus,input:focus,select:focus,textarea:focus{outline:3px solid var(--gold);outline-offset:2px}
header{background:#fff;border-bottom:1px solid var(--line);padding:14px 20px}.head{max-width:1300px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:12px}.brand{display:flex;align-items:center;gap:12px}.logo{display:grid;place-items:center;width:48px;height:48px;border-radius:13px;background:var(--navy);color:#fff;font-size:25px}.brand b{font-size:21px}.brand small{display:block;color:#627086}
.wrap{max-width:1300px;margin:auto;padding:18px}.tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}.tab{min-height:62px;border:1px solid var(--line);border-radius:12px;background:#fff;font-weight:800}.tab.active{background:var(--blue);color:#fff}.tab:disabled{opacity:.4}
.card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px;box-shadow:0 3px 12px #17345b10}.center{max-width:760px;margin:auto}h1,h2,h3{line-height:1.2}h2{font-size:30px;margin:0 0 20px}label{display:block;font-weight:800;margin:16px 0 6px}.input,select,textarea{width:100%;border:1px solid #aebdd0;border-radius:11px;background:#fff;padding:13px;color:var(--ink)}.input,select{min-height:54px}textarea{min-height:120px}.lyrics{min-height:520px;line-height:1.65}
.btn{min-height:50px;border:0;border-radius:10px;padding:10px 18px;background:var(--blue);color:#fff;font-weight:800}.btn.secondary{background:#fff;color:var(--ink);border:1px solid #aebdd0}.btn.green{background:var(--green)}.wide{width:100%;margin-top:20px}.notice{margin-bottom:15px;padding:13px;border:1px solid #e0bc52;border-radius:10px;background:#fff8d9;font-weight:700}.progress{margin-bottom:15px;padding:14px;border:1px solid var(--line);border-radius:14px;background:#fff}.bar{height:10px;border-radius:9px;background:#e4eaf1;overflow:hidden}.fill{height:100%;background:var(--green)}
.plan{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.album{border:1px solid var(--line);border-radius:15px;background:#f8fafc;padding:15px}.album h3{margin:0 0 10px}.album ol{margin:0;padding-left:27px}.album li{margin:7px 0}.editable{width:calc(100% - 4px);border:1px solid #c6d1df;border-radius:7px;padding:7px;background:#fff}
.work{display:grid;grid-template-columns:320px 1fr;gap:16px}.side,.main{background:#fff;border:1px solid var(--line);border-radius:17px;padding:16px}.side button{width:100%;text-align:left;border:0;border-radius:9px;padding:10px;margin:2px 0;background:#eef2f7}.side button.active{background:var(--navy);color:#fff}.side .albumBtn{font-weight:800;background:#dfe9f6;margin-top:9px}.fieldHead{display:flex;align-items:center;justify-content:space-between;gap:10px}.copybox{padding:13px;border:1px solid var(--line);border-radius:10px;background:#f8fafc;font-weight:800}.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px}.cover{display:block;width:min(100%,600px);aspect-ratio:1;object-fit:cover;margin:20px auto;border-radius:18px;box-shadow:0 12px 30px #091f3e35}.empty{min-height:380px;display:grid;place-items:center;border:2px dashed #b9c7d9;border-radius:16px;background:#f8fafc}
@media(max-width:850px){.plan,.work{grid-template-columns:1fr}.side{max-height:320px;overflow:auto}.brand b{font-size:17px}.tabs .tab{font-size:15px}.wrap{padding:12px}.card{padding:18px}}
</style></head><body>
<header><div class="head"><div class="brand"><span class="logo">♫</span><div><b>SaySayMusic AI Music Builder</b><small>Education Through Melody</small></div></div><button id="newBtn" class="btn secondary" hidden>New Topic</button></div></header>
<div class="wrap">
 <nav class="tabs"><button class="tab active" data-tab="topics">1. Topics</button><button class="tab" data-tab="songs" disabled>2. Songs</button><button class="tab" data-tab="cover" disabled>3. Album Cover</button></nav>
 <div id="progress"></div><div id="notice"></div><div id="view"></div>
</div>
<script>
(function(){
 var API="/api",KEY="saysaymusic-builder-v1",plan=null,tab="topics",ai=0,si=0,busy=false,level="College / Medical School";
 function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]})}
 function save(){if(plan)localStorage.setItem(KEY,JSON.stringify(plan))}
 function note(s){document.getElementById("notice").innerHTML=s?'<div class="notice">'+esc(s)+'</div>':""}
 function totals(){var total=0,done=0;if(plan)plan.albums.forEach(function(a){total+=a.songs.length;a.songs.forEach(function(s){if(s.completed)done++})});return{total:total,done:done}}
 function chrome(){var t=totals(),p=t.total?Math.round(t.done/t.total*100):0;document.getElementById("progress").innerHTML=plan?'<div class="progress"><b>'+esc(plan.topic)+'</b><span style="float:right"><b>'+t.done+" of "+t.total+'</b> complete</span><div class="bar"><div class="fill" style="width:'+p+'%"></div></div></div>':"";document.getElementById("newBtn").hidden=!plan;document.querySelectorAll(".tab").forEach(function(b){b.classList.toggle("active",b.dataset.tab===tab);b.disabled=b.dataset.tab!=="topics"&&!(plan&&plan.approved)})}
 async function call(path,body){var r=await fetch(API+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}),raw=await r.text(),d;try{d=JSON.parse(raw)}catch(e){throw Error("Cloudflare error "+r.status+". Check the Worker live log.")}if(!r.ok)throw Error(d.error||"Request failed");return d}
 function render(){chrome();if(tab==="topics")topics();else if(tab==="songs")songs();else cover()}
 function topics(){var v=document.getElementById("view");if(!plan){v.innerHTML='<section class="card center"><h2>Enter your main topic</h2><label>Main topic</label><input id="topic" class="input" placeholder="Example: Triglycerides"><label>Education level</label><select id="level"><option>College / Medical School</option><option>High School</option><option>Middle School</option><option>Elementary School</option></select><button id="makePlan" class="btn wide">✨ Create Albums and Song List</button></section>';document.getElementById("makePlan").onclick=makePlan;return}var h='<section class="card"><h2>'+esc(plan.topic)+'</h2><div class="plan">';plan.albums.forEach(function(a,x){h+='<article class="album"><h3>'+esc(a.title)+'</h3><ol>';a.songs.forEach(function(s){h+='<li>'+esc(s.title)+'</li>'});h+='</ol></article>'});h+='</div>'+(plan.approved?'<button id="toSongs" class="btn wide">Continue to Songs</button>':'<button id="approve" class="btn green wide">✓ Approve Album Plan</button>')+'</section>';v.innerHTML=h;(document.getElementById("approve")||document.getElementById("toSongs")).onclick=function(){plan.approved=true;save();tab="songs";render()}}
 async function makePlan(){if(busy)return;var topic=document.getElementById("topic").value.trim();if(!topic){note("Enter a topic first.");return}level=document.getElementById("level").value;busy=true;note("AI is creating the complete album plan…");try{var d=await call("/plan",{topic:topic,level:level});plan={topic:topic,albums:d.albums,approved:false};save();note("");render()}catch(e){note(e.message)}finally{busy=false}}
 function nav(){var h="";plan.albums.forEach(function(a,x){h+='<button class="albumBtn" data-a="'+x+'">'+esc(a.title)+'</button>';if(x===ai)a.songs.forEach(function(s,y){h+='<button class="'+(y===si?"active":"")+'" data-s="'+y+'">'+(s.completed?"✓ ":"")+(y+1)+". "+esc(s.title)+'</button>'})});return h}
 function wireNav(){document.querySelectorAll("[data-a]").forEach(function(b){b.onclick=function(){ai=+b.dataset.a;si=0;render()}});document.querySelectorAll("[data-s]").forEach(function(b){b.onclick=function(){si=+b.dataset.s;render()}})}
 function songs(){var a=plan.albums[ai],s=a.songs[si],main='<p><b>'+esc(a.title)+'</b></p><h2>'+esc(s.title)+'</h2>';if(!s.lyrics)main+='<div class="empty"><button id="makeSong" class="btn">✨ Create Song</button></div>';else main+='<div class="fieldHead"><h3>Song Name</h3><button class="btn secondary copy" data-copy="name">Copy Name</button></div><div class="copybox">'+esc(s.title)+'</div><div class="fieldHead"><h3>Genre</h3><button class="btn secondary copy" data-copy="genre">Copy Genre</button></div><textarea id="genre">'+esc(s.genre)+'</textarea><div class="fieldHead"><h3>Lyrics</h3><button class="btn secondary copy" data-copy="lyrics">Copy Lyrics</button></div><textarea id="lyrics" class="lyrics">'+esc(s.lyrics)+'</textarea><div class="actions"><button id="rewrite" class="btn secondary">Rewrite Song</button><button id="next" class="btn green">✓ Save and Open Next</button></div>';document.getElementById("view").innerHTML='<section class="work"><aside class="side"><h3>Albums and Songs</h3>'+nav()+'</aside><article class="main">'+main+'</article></section>';wireNav();var make=document.getElementById("makeSong"),rewrite=document.getElementById("rewrite");if(make)make.onclick=makeSong;if(rewrite)rewrite.onclick=makeSong;document.querySelectorAll(".copy").forEach(function(b){b.onclick=function(){var value=b.dataset.copy==="name"?s.title:b.dataset.copy==="genre"?document.getElementById("genre").value:document.getElementById("lyrics").value;navigator.clipboard.writeText(value);note("Copied.")}});var next=document.getElementById("next");if(next)next.onclick=function(){s.genre=document.getElementById("genre").value;s.lyrics=document.getElementById("lyrics").value;s.completed=true;save();if(si<a.songs.length-1)si++;else if(ai<plan.albums.length-1){ai++;si=0}else tab="cover";render()}}
 async function makeSong(){if(busy)return;var a=plan.albums[ai],s=a.songs[si];busy=true;note("AI is writing the college-level song…");try{var d=await call("/song",{topic:plan.topic,level:level,albumTitle:a.title,songTitle:s.title,albumSongs:a.songs.map(function(x){return x.title})});s.genre=d.genre;s.lyrics=d.lyrics;save();note("");render()}catch(e){note(e.message)}finally{busy=false}}
 function cover(){var a=plan.albums[ai],main='<h2>'+esc(a.title)+'</h2><p>Square scientific album artwork.</p>';main+=a.cover?'<img class="cover" src="'+a.cover+'" alt="Album cover"><div class="actions"><button id="makeCover" class="btn secondary">Create Another</button><a class="btn green" style="text-align:center;text-decoration:none" href="'+a.cover+'" download="'+esc(a.title)+'.png">⬇ Download Cover</a></div>':'<div class="empty"><button id="makeCover" class="btn">🖼 Create Album Cover</button></div>';document.getElementById("view").innerHTML='<section class="work"><aside class="side"><h3>Choose Album</h3>'+plan.albums.map(function(x,n){return '<button class="albumBtn '+(n===ai?"active":"")+'" data-a="'+n+'">'+esc(x.title)+'</button>'}).join("")+'</aside><article class="main">'+main+'</article></section>';wireNav();document.getElementById("makeCover").onclick=makeCover}
 async function makeCover(){if(busy)return;busy=true;note("AI is creating the album cover…");try{var r=await fetch(API+"/cover",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({topic:plan.topic,albumTitle:plan.albums[ai].title})});if(!r.ok){var d=await r.json();throw Error(d.error||"Cover failed")}var blob=await r.blob(),url=await new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(reader.result)};reader.onerror=reject;reader.readAsDataURL(blob)});plan.albums[ai].cover=url;save();note("");render()}catch(e){note(e.message)}finally{busy=false}}
 document.querySelectorAll(".tab").forEach(function(b){b.onclick=function(){tab=b.dataset.tab;render()}});
 document.getElementById("newBtn").onclick=function(){if(confirm("Start a new topic and clear this project?")){localStorage.removeItem(KEY);plan=null;tab="topics";ai=si=0;note("");render()}};
 try{plan=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){}render();
})();
</script></body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/" && request.method === "GET") {
        const user = await requireCreator(request);
        if (!user) return new Response("Please log into app.saysaymusic.com with a Creator or Administrator account, then open Music Builder again.", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
        return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY" } });
      }
      if (url.pathname.startsWith("/api/")) {
        if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
        const user = await requireCreator(request);
        if (!user) return json({ error: "Creator or Administrator login required." }, 401);
        if (url.pathname === "/api/plan") return makePlan(request, env);
        if (url.pathname === "/api/song") return makeSong(request, env);
        if (url.pathname === "/api/cover") return makeCover(request, env);
      }
      return new Response("Not found", { status: 404 });
    } catch (error) {
      return json({ error: error && error.message ? error.message : "Music Builder failed." }, 500);
    }
  }
};
