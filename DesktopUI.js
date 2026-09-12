import app from "./PolishedUI.js";

const DESKTOP_CSS = String.raw`
@media (min-width:981px){
body.ss-redesign .wrap{max-width:1480px!important;margin:0 auto!important;padding:12px 18px 28px!important}
body.ss-redesign .top{min-height:78px!important;grid-template-columns:minmax(315px,1fr) auto auto auto!important;gap:14px!important;padding:10px 16px!important;border-radius:0!important;border-left:0!important;border-right:0!important;border-top:0!important;background:linear-gradient(90deg,#090b0e,#080a0d)!important}
body.ss-redesign .top .logo{width:58px!important;height:58px!important;min-width:58px!important}body.ss-redesign .top .logo img{width:58px!important;height:58px!important}body.ss-redesign .top .title{font-size:28px!important;line-height:1.02!important;white-space:nowrap!important}
#ssProductNav{gap:9px!important}#ssProductNav .btn{min-height:46px!important;padding:9px 18px!important;border-radius:9px!important;font-size:15px!important;font-weight:800!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:0!important}#ssProductNav .btn:before,#ssProductNav .btn:after{display:none!important;content:none!important}#ssProductNav #btnMusic{display:none!important}
#ssAccountButton{min-height:46px!important;border-radius:9px!important}body.ss-redesign #authRow{gap:7px!important}
body.ss-redesign .grid{grid-template-columns:300px minmax(0,1fr)!important;gap:22px!important;margin-top:16px!important}body.ss-redesign .grid>.card{border-radius:14px!important;box-shadow:none!important}body.ss-redesign .grid>.card:first-child h3{font-size:20px!important;padding:14px 14px 10px!important}body.ss-redesign .grid>.card:first-child .body{padding:0 14px 18px!important}#ssNowArt{border-radius:13px!important;margin-bottom:12px!important;width:100%!important;aspect-ratio:1/1!important;object-fit:cover!important}body.ss-redesign #npTitle{font-size:19px!important}
body.ss-redesign .rightHeader{padding:0 0 12px!important;background:transparent!important;border:0!important}body.ss-redesign .rightHeader .row.ssDiscoveryNav{grid-template-columns:minmax(320px,1fr) 145px 145px 115px!important;gap:12px!important}body.ss-redesign .rightHeader .row.ssDiscoveryNav #search,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnHome,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnSubject,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnAll{min-height:44px!important;border-radius:9px!important;font-size:14px!important}
body.ss-redesign .grid>.card:last-child{border:0!important;background:transparent!important}body.ss-redesign .grid>.card:last-child>.body{padding:0!important;overflow:visible!important}
.ssHero{min-height:245px!important;border-radius:13px!important;margin-bottom:20px!important;display:block!important;position:relative!important;background:linear-gradient(90deg,rgba(10,18,29,.98) 0%,rgba(10,18,29,.94) 30%,rgba(10,18,29,.40) 48%,rgba(10,18,29,.06) 72%),url('https://audio.saysaymusic.com/one.png') center center/cover no-repeat!important}.ssHeroCopy{padding:34px 36px!important;width:47%!important;position:relative!important;z-index:3!important}.ssHero h1{font-size:46px!important;line-height:.98!important;max-width:455px!important}.ssHero p{font-size:16px!important;margin:14px 0 18px!important}.ssHeroCta{min-height:44px!important;border-radius:8px!important;padding:9px 21px!important}.ssHeroVisual{display:none!important}.ssMetrics{right:20px!important;top:48px!important;bottom:auto!important;display:grid!important;gap:15px!important;justify-items:start!important;width:245px!important;z-index:4!important}.ssMetric{font-size:12px!important;padding:0!important;border:0!important;background:rgba(4,8,13,.18)!important;text-shadow:0 1px 3px #000!important}
.ssSection{margin:17px 0 25px!important}.ssSectionHead{margin-bottom:11px!important}.ssSectionHead h2{font-size:21px!important}.ssSectionHead button{padding:7px 12px!important;font-size:12px!important}
.ssSubjectGrid{grid-template-columns:repeat(10,minmax(0,1fr))!important;gap:10px!important}.ssSubjectCard,.ssMoreTile{height:128px!important;min-height:128px!important;border-radius:11px!important;padding:13px 6px 10px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:10px!important;text-align:center!important}.ssSubjectCard .ssSubjectIcon{display:flex!important;align-items:center!important;justify-content:center!important;height:54px!important;min-height:54px!important;font-size:44px!important;line-height:1!important;margin:0!important}.ssSubjectCard>span:last-child{font-size:14px!important;line-height:1.08!important;font-weight:800!important;display:flex!important;align-items:center!important;justify-content:center!important;min-height:30px!important}.ssMoreTile span:first-child{display:flex!important;font-size:38px!important;line-height:1!important;height:54px!important;align-items:center!important}.ssMoreTile span:last-child{font-size:14px!important;font-weight:800!important;line-height:1.08!important}
.ssAlbumGrid{grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:10px!important}.ssAlbumGrid .albumCard{border-radius:10px!important}.ssAlbumGrid .albumCover{border-radius:8px!important}
}
`;

const DESKTOP_JS = String.raw`
(function(){
 function cleanTopNav(){
  var labels={btnLearningGames:'Learning Games',btnMusicBuilder:'Music Builder',btnGlobal:'Books'};
  Object.keys(labels).forEach(function(id){var b=document.getElementById(id);if(b)b.textContent=labels[id];});
 }
 function fixSubjects(){
  document.querySelectorAll('.ssSubjectCard').forEach(function(card){
   var label=card.querySelector('span:last-child');if(!label)return;var name=(label.textContent||'').trim();var icon=card.querySelector('.ssSubjectIcon');if(!icon)return;
   if(name==='SAT'){icon.textContent='SAT';icon.style.fontSize='24px';icon.style.fontWeight='900';}
   else if(name==='Math'){icon.textContent='▦';}else if(name==='Biology'){icon.textContent='⚕';}else if(name==='Chemistry'){icon.textContent='⚗';}else if(name==='Microbiology'){icon.textContent='☼';}else if(name==='Anatomy & Physiology'){icon.textContent='♙';}else if(name==='Food & Nutrition'){icon.textContent='●';}else if(name==='Languages'){icon.textContent='◉';}else if(name==='Life After College'){icon.textContent='▣';}
  });
 }
 function apply(){cleanTopNav();fixSubjects();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();setTimeout(apply,400);setTimeout(apply,1200);
 new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
})();
`;
export default {async fetch(request,env,ctx){const response=await app.fetch(request,env,ctx);const type=response.headers.get("content-type")||"";if(!type.includes("text/html"))return response;let html=await response.text();const tag=`<style id="ss-desktop-target">${DESKTOP_CSS}</style><script id="ss-desktop-target-js">${DESKTOP_JS}</script>`;html=html.includes("</head>")?html.replace("</head>",tag+"</head>"):tag+html;return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});}};
