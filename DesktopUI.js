import app from "./PolishedUI.js";

const DESKTOP_CSS = String.raw`
@media (min-width:981px){
body.ss-redesign .wrap{max-width:1480px!important;margin:0 auto!important;padding:12px 18px 28px!important}
body.ss-redesign .top{min-height:74px!important;grid-template-columns:minmax(285px,1fr) auto auto auto!important;gap:14px!important;padding:10px 16px!important;border-radius:0!important;border-left:0!important;border-right:0!important;border-top:0!important;background:linear-gradient(90deg,#090b0e,#080a0d)!important}
body.ss-redesign .top .logo{width:54px!important;height:54px!important;min-width:54px!important}body.ss-redesign .top .logo img{width:54px!important;height:54px!important}
body.ss-redesign .top .title{font-size:27px!important;line-height:1.02!important;white-space:nowrap!important}
#ssProductNav{gap:8px!important}#ssProductNav .btn{min-height:44px!important;padding:9px 15px!important;border-radius:9px!important;font-size:13px!important}
#ssAccountButton{min-height:44px!important;border-radius:9px!important}body.ss-redesign #authRow{gap:7px!important}
body.ss-redesign .grid{grid-template-columns:290px minmax(0,1fr)!important;gap:20px!important;margin-top:16px!important}
body.ss-redesign .grid>.card{border-radius:14px!important;box-shadow:none!important}body.ss-redesign .grid>.card:first-child h3{font-size:19px!important;padding:14px 14px 10px!important}body.ss-redesign .grid>.card:first-child .body{padding:0 14px 18px!important}
#ssNowArt{border-radius:13px!important;margin-bottom:12px!important;width:100%!important;aspect-ratio:1/1!important;object-fit:cover!important}body.ss-redesign #npTitle{font-size:18px!important}
body.ss-redesign .rightHeader{padding:0 0 12px!important;background:transparent!important;border:0!important}body.ss-redesign .rightHeader .row.ssDiscoveryNav{grid-template-columns:minmax(320px,1fr) 145px 145px 115px!important;gap:12px!important}
body.ss-redesign .rightHeader .row.ssDiscoveryNav #search,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnHome,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnSubject,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnAll{min-height:44px!important;border-radius:9px!important}
body.ss-redesign .grid>.card:last-child{border:0!important;background:transparent!important}body.ss-redesign .grid>.card:last-child>.body{padding:0!important;overflow:visible!important}
.ssHero{min-height:235px!important;border-radius:13px!important;margin-bottom:20px!important;grid-template-columns:minmax(390px,.78fr) minmax(620px,1.22fr)!important;background:linear-gradient(90deg,rgba(12,19,29,.96) 0%,rgba(12,19,29,.90) 34%,rgba(12,19,29,.24) 58%,rgba(12,19,29,.18) 100%),url('https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=1600&q=85') center 38%/cover no-repeat!important}
.ssHeroCopy{padding:32px 34px!important}.ssHero h1{font-size:43px!important;line-height:.98!important;max-width:430px!important}.ssHero p{font-size:15px!important;margin:13px 0 16px!important}.ssHeroCta{min-height:42px!important;border-radius:8px!important;padding:8px 20px!important}
.ssHeroVisual{visibility:hidden!important}.ssMetrics{right:24px!important;top:44px!important;bottom:auto!important;display:grid!important;gap:13px!important;justify-items:start!important}.ssMetric{font-size:12px!important;padding:0!important;border:0!important;background:transparent!important}
.ssSection{margin:16px 0 24px!important}.ssSectionHead{margin-bottom:10px!important}.ssSectionHead h2{font-size:20px!important}.ssSectionHead button{padding:6px 11px!important;font-size:12px!important}
.ssSubjectGrid{grid-template-columns:repeat(10,minmax(0,1fr))!important;gap:8px!important}.ssSubjectCard,.ssMoreTile{min-height:112px!important;border-radius:9px!important;padding:10px 6px!important}.ssSubjectIcon{font-size:38px!important;line-height:1!important;min-height:40px!important;display:flex!important;align-items:center!important;justify-content:center!important}.ssSubjectCard{font-size:11px!important;gap:9px!important}.ssSubjectCard:nth-child(2) .ssSubjectIcon{font-size:25px!important;font-weight:900!important}
.ssAlbumGrid{grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:9px!important}.ssAlbumGrid .albumCard{border-radius:10px!important}.ssAlbumGrid .albumCover{border-radius:8px!important}
}
`;
export default {async fetch(request,env,ctx){const response=await app.fetch(request,env,ctx);const type=response.headers.get("content-type")||"";if(!type.includes("text/html"))return response;let html=await response.text();const tag=`<style id="ss-desktop-target">${DESKTOP_CSS}</style>`;html=html.includes("</head>")?html.replace("</head>",tag+"</head>"):tag+html;return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});}};
