import app from "./PolishedUI.js";

const DESKTOP_CSS = String.raw`
@media (min-width:981px){
body.ss-redesign .wrap{max-width:1480px!important;margin:0 auto!important;padding:12px 18px 28px!important}
body.ss-redesign .top{min-height:78px!important;grid-template-columns:minmax(315px,1fr) auto auto auto!important;gap:14px!important;padding:10px 16px!important;border-radius:0!important;border-left:0!important;border-right:0!important;border-top:0!important;background:linear-gradient(90deg,#090b0e,#080a0d)!important}
body.ss-redesign .top .logo{width:58px!important;height:58px!important;min-width:58px!important}body.ss-redesign .top .logo img{width:58px!important;height:58px!important}
body.ss-redesign .top .title{font-size:28px!important;line-height:1.02!important;white-space:nowrap!important}
#ssProductNav{gap:9px!important}#ssProductNav .btn{min-height:46px!important;padding:9px 16px!important;border-radius:9px!important;font-size:14px!important;display:inline-flex!important;align-items:center!important;gap:8px!important}
#ssProductNav #btnMusic{font-size:0!important}#ssProductNav #btnMusic:before{content:'♫';font-size:21px!important;font-weight:900!important}#ssProductNav #btnMusic:after{content:'Music';font-size:14px!important;font-weight:900!important}
#ssProductNav #btnLearningGames:before{content:'🎮';font-size:18px!important}#ssProductNav #btnMusicBuilder:before{content:'▥';font-size:20px!important;color:#8e78ff!important}#ssProductNav #btnGlobal:before{content:'▰';font-size:19px!important;color:#77a7ff!important}
#ssAccountButton{min-height:46px!important;border-radius:9px!important}body.ss-redesign #authRow{gap:7px!important}
body.ss-redesign .grid{grid-template-columns:300px minmax(0,1fr)!important;gap:22px!important;margin-top:16px!important}
body.ss-redesign .grid>.card{border-radius:14px!important;box-shadow:none!important}body.ss-redesign .grid>.card:first-child h3{font-size:20px!important;padding:14px 14px 10px!important}body.ss-redesign .grid>.card:first-child .body{padding:0 14px 18px!important}
#ssNowArt{border-radius:13px!important;margin-bottom:12px!important;width:100%!important;aspect-ratio:1/1!important;object-fit:cover!important}body.ss-redesign #npTitle{font-size:19px!important}
body.ss-redesign .rightHeader{padding:0 0 12px!important;background:transparent!important;border:0!important}body.ss-redesign .rightHeader .row.ssDiscoveryNav{grid-template-columns:minmax(320px,1fr) 145px 145px 115px!important;gap:12px!important}
body.ss-redesign .rightHeader .row.ssDiscoveryNav #search,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnHome,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnSubject,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnAll{min-height:44px!important;border-radius:9px!important;font-size:14px!important}
body.ss-redesign .grid>.card:last-child{border:0!important;background:transparent!important}body.ss-redesign .grid>.card:last-child>.body{padding:0!important;overflow:visible!important}
.ssHero{min-height:245px!important;border-radius:13px!important;margin-bottom:20px!important;grid-template-columns:minmax(410px,.78fr) minmax(620px,1.22fr)!important;background:radial-gradient(circle at 72% 38%,rgba(38,76,120,.28),transparent 43%),linear-gradient(110deg,#111b2b 0%,#0b121d 48%,#111927 100%)!important}
.ssHeroCopy{padding:34px 36px!important}.ssHero h1{font-size:46px!important;line-height:.98!important;max-width:455px!important}.ssHero p{font-size:16px!important;margin:14px 0 18px!important}.ssHeroCta{min-height:44px!important;border-radius:8px!important;padding:9px 21px!important}
.ssHeroVisual{visibility:visible!important;padding:14px 285px 14px 0!important;overflow:visible!important}.ssHeroVisual img{width:150px!important;border-radius:13px!important}.ssHeroVisual img:nth-child(1){transform:translateX(38px) rotate(-7deg)!important}.ssHeroVisual img:nth-child(2){width:184px!important}.ssHeroVisual img:nth-child(3){transform:translateX(-38px) rotate(7deg)!important}.ssMetrics{right:18px!important;top:47px!important;bottom:auto!important;display:grid!important;gap:15px!important;justify-items:start!important;width:245px!important}.ssMetric{font-size:12px!important;padding:0!important;border:0!important;background:transparent!important}
.ssSection{margin:17px 0 25px!important}.ssSectionHead{margin-bottom:11px!important}.ssSectionHead h2{font-size:21px!important}.ssSectionHead button{padding:7px 12px!important;font-size:12px!important}
.ssSubjectGrid{grid-template-columns:repeat(10,minmax(0,1fr))!important;gap:9px!important}.ssSubjectCard,.ssMoreTile{min-height:118px!important;border-radius:10px!important;padding:11px 6px!important}.ssSubjectIcon{font-size:44px!important;line-height:1!important;min-height:48px!important;display:flex!important;align-items:center!important;justify-content:center!important}.ssSubjectCard{font-size:11px!important;gap:10px!important}.ssSubjectCard:nth-child(1) .ssSubjectIcon{font-size:42px!important}.ssSubjectCard:nth-child(2) .ssSubjectIcon{font-size:28px!important;font-weight:900!important}.ssMoreTile span:first-child{font-size:38px!important}
.ssAlbumGrid{grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:10px!important}.ssAlbumGrid .albumCard{border-radius:10px!important}.ssAlbumGrid .albumCover{border-radius:8px!important}
}
`;

const DESKTOP_JS = String.raw`
(function(){
 function iconize(){
  var ids={btnLearningGames:'Learning Games',btnMusicBuilder:'Music Builder',btnGlobal:'Books'};
  Object.keys(ids).forEach(function(id){var b=document.getElementById(id);if(b)b.setAttribute('data-desktop-label',ids[id])});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iconize);else iconize();setTimeout(iconize,500);setTimeout(iconize,1500);
})();
`;
export default {async fetch(request,env,ctx){const response=await app.fetch(request,env,ctx);const type=response.headers.get("content-type")||"";if(!type.includes("text/html"))return response;let html=await response.text();const tag=`<style id="ss-desktop-target">${DESKTOP_CSS}</style><script id="ss-desktop-target-js">${DESKTOP_JS}</script>`;html=html.includes("</head>")?html.replace("</head>",tag+"</head>"):tag+html;return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});}};
