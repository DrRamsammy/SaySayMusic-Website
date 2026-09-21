import desktopApp from "./PolishedUI.js";
import mobileApp from "./PolishedUI.js";
import lyricsBook from "./LyricsBook.js";
import freeSong from "./FreeSong.js";

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
.ssSubjectGrid{grid-template-columns:repeat(10,minmax(0,1fr))!important;gap:10px!important}.ssSubjectCard,.ssMoreTile{height:128px!important;min-height:128px!important;border-radius:11px!important;padding:13px 6px 10px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:10px!important;text-align:center!important}.ssSubjectCard .ssSubjectIcon{display:flex!important;align-items:center!important;justify-content:center!important;height:54px!important;min-height:54px!important;font-size:44px!important;line-height:1!important;margin:0!important}.ssSubjectCard>span:last-child{font-size:14px!important;line-height:1.08!important;font-weight:800!important;display:flex!important;align-items:center!important;justify-content:center!important;min-height:30px!important}.ssSubjectCard>span:last-child:before,.ssSubjectCard>span:last-child:after{display:none!important;content:none!important}.ssMoreTile span:first-child{display:flex!important;font-size:38px!important;line-height:1!important;height:54px!important;align-items:center!important}.ssMoreTile span:last-child{font-size:14px!important;font-weight:800!important;line-height:1.08!important}
.ssAlbumGrid{grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:10px!important}.ssAlbumGrid .albumCard{border-radius:10px!important}.ssAlbumGrid .albumCover{border-radius:8px!important}
}
@media (min-width:981px) and (max-width:1180px) and (hover:none) and (pointer:coarse){
html,body{max-width:100%!important;overflow-x:hidden!important}
body.ss-redesign .wrap{width:100%!important;max-width:100%!important;padding:10px 12px 24px!important;overflow:hidden!important}
body.ss-redesign .top{width:100%!important;min-height:0!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:'brand account' 'products products'!important;gap:9px!important;padding:10px 12px!important}
body.ss-redesign .top .brand{grid-area:brand!important;min-width:0!important;overflow:hidden!important}
body.ss-redesign .top .brandText{min-width:0!important;overflow:hidden!important}
body.ss-redesign .top .title{font-size:23px!important;white-space:nowrap!important}
#ssForArtists{display:none!important}
#ssAccountWrap{grid-area:account!important;min-width:0!important;max-width:100%!important;align-self:start!important}
#ssAccountButton{width:auto!important;max-width:100%!important;min-height:44px!important;white-space:nowrap!important}
#ssProductNav{grid-area:products!important;position:relative!important;display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;padding:0!important}
#ssMobileMenuButton{display:flex!important;width:100%!important;min-height:44px!important;align-items:center!important;justify-content:space-between!important;padding:9px 14px!important;border-radius:10px!important;font-size:14px!important;font-weight:900!important;background:#0b0e12!important;border:1px solid rgba(255,191,0,.42)!important;color:#fff!important}
#ssMobileMenuButton:after{content:'\25BE'!important;color:#ffbf00!important;font-size:15px!important}
#ssProductNav>.btn:not(#ssMobileMenuButton){display:none!important;width:100%!important;min-height:44px!important;margin:0!important;font-size:13px!important;text-align:center!important;justify-content:center!important}
#ssProductNav.open{z-index:10040!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important;padding:7px!important;border-radius:12px!important;border:1px solid rgba(255,191,0,.34)!important;background:#090b0e!important;box-shadow:0 18px 42px rgba(0,0,0,.7)!important}
#ssProductNav.open>#ssMobileMenuButton{grid-column:1/-1!important;margin-bottom:0!important}
#ssProductNav.open>.btn:not(#ssMobileMenuButton){display:flex!important}
#ssProductNav.open #btnStudio[style*='display: none']{display:none!important}
body.ss-redesign .grid{width:100%!important;grid-template-columns:220px minmax(0,1fr)!important;gap:15px!important;margin-top:12px!important}
body.ss-redesign .grid>.card{min-width:0!important}
body.ss-redesign .grid>.card:first-child h3{font-size:17px!important;padding:12px 11px 8px!important}
body.ss-redesign .grid>.card:first-child .body{padding:0 11px 14px!important}
#ssNowArt{width:100%!important;max-width:198px!important;margin:0 auto 10px!important}
body.ss-redesign #npTitle{font-size:17px!important;overflow-wrap:anywhere!important}
body.ss-redesign .rightHeader .row.ssDiscoveryNav{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important}
body.ss-redesign .rightHeader .row.ssDiscoveryNav #search{grid-column:1/-1!important;width:100%!important;min-width:0!important}
body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnHome,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnSubject,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnAll{min-width:0!important;width:100%!important;padding:7px!important}
.ssHero{display:block!important;width:100%!important;min-height:220px!important;background:linear-gradient(90deg,rgba(10,18,29,.99) 0%,rgba(10,18,29,.96) 44%,rgba(10,18,29,.34) 66%,rgba(10,18,29,.04) 100%),url('https://audio.saysaymusic.com/one.png') right center/auto 100% no-repeat!important}
.ssHeroCopy{width:60%!important;padding:28px 24px!important}
.ssHero h1{font-size:37px!important;line-height:1!important;max-width:390px!important}
.ssHero p{font-size:15px!important;margin:12px 0 16px!important}
.ssHeroVisual{display:none!important}
.ssMetrics{right:12px!important;top:auto!important;bottom:11px!important;width:auto!important;display:flex!important;gap:6px!important;justify-content:flex-end!important}
.ssMetric{font-size:9px!important;padding:5px 7px!important;border:1px solid rgba(255,255,255,.12)!important;background:rgba(3,5,7,.76)!important}
.ssSubjectGrid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:9px!important}
.ssSubjectCard,.ssMoreTile{height:auto!important;min-height:108px!important;padding:10px 6px!important}
.ssAlbumGrid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:9px!important}
.ssAlbumGrid .albumCard,.ssAlbumGrid .albumCard *{min-width:0!important;max-width:100%!important}
}
`;

const DESKTOP_JS = String.raw`
(function(){
 function cleanTopNav(){
  var labels={btnLearningGames:'Learning Games',btnMusicBuilder:'Music Builder',btnGlobal:'Books'};
  Object.keys(labels).forEach(function(id){var b=document.getElementById(id);if(b&&b.textContent!==labels[id])b.textContent=labels[id];});
 }
 function cleanName(raw){
  raw=(raw||'').trim();
  var names=['Anatomy & Physiology','Food & Nutrition','Biomolecules','Entertainment','Microbiology','Chemistry','Biology','Languages','Gospel','Math','SAT'];
  for(var i=0;i<names.length;i++){if(raw.indexOf(names[i])!==-1)return names[i];}
  return raw.replace(/^[^A-Za-z0-9]+\s*/,'').trim();
 }
 function fixSubjects(){document.querySelectorAll('.ssSubjectCard').forEach(function(card){var label=card.querySelector('span:last-child');if(!label)return;var name=cleanName(label.textContent);if(label.textContent!==name)label.textContent=name;});}
 function apply(){cleanTopNav();fixSubjects();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();setTimeout(apply,500);setTimeout(apply,1500);
})();
`;

const STUDIO_BOOK_JS = String.raw`
(function(){
 function addBookLink(){
  var list=document.getElementById('list');
  if(!list)return;
  var card=list.querySelector('.studioCard');
  if(!card||document.getElementById('ssLyricsBookLink'))return;
  var link=document.createElement('a');link.id='ssLyricsBookLink';link.href='/studio/lyrics-book';
  link.textContent='Lyrics Book Maker';link.className='btn primary';
  link.style.cssText='display:inline-block;margin:10px 0;padding:12px 18px';
  var title=card.querySelector('.studioSectionTitle');
  if(title)title.insertAdjacentElement('afterend',link);else card.prepend(link);
 }
 function boot(){var list=document.getElementById('list');if(!list)return;new MutationObserver(addBookLink).observe(list,{childList:true,subtree:true});addBookLink()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();`;

function isMobileRequest(request){
 const ua=request.headers.get('user-agent')||'';
 return /Android|iPhone|iPod|Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

export default {async fetch(request,env,ctx){
 const pathname=new URL(request.url).pathname;
 if(pathname==='/studio/lyrics-book')return lyricsBook.fetch(request);
 if(pathname==='/free-song'||pathname==='/free-song/'||pathname==='/free-song-cover.jpg')return freeSong.fetch(request);
 const mobile=isMobileRequest(request);
 const response=await (mobile?mobileApp:desktopApp).fetch(request,env,ctx);
 const type=response.headers.get("content-type")||"";
 if(!type.includes("text/html"))return response;
 let html=await response.text();
 const tag=(mobile?'':`<style id="ss-desktop-target">${DESKTOP_CSS}</style><script id="ss-desktop-target-js">${DESKTOP_JS}</script>`)+`<script id="ss-lyrics-studio-link">${STUDIO_BOOK_JS}</script>`;
 html=html.includes("</head>")?html.replace("</head>",tag+"</head>"):tag+html;
 return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
}};
