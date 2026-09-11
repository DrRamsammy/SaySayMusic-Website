import app from "./RedesignedUI.js";

const DESKTOP_CSS = String.raw`
@media (min-width:981px){
body.ss-redesign .wrap{max-width:1480px!important;margin:0 auto!important;padding:12px 18px 28px!important}
body.ss-redesign .top{min-height:74px!important;grid-template-columns:minmax(285px,1fr) auto auto auto!important;gap:14px!important;padding:10px 16px!important;border-radius:0!important;border-left:0!important;border-right:0!important;border-top:0!important;background:linear-gradient(90deg,#090b0e,#080a0d)!important}
body.ss-redesign .top .logo{width:54px!important;height:54px!important;min-width:54px!important}body.ss-redesign .top .logo img{width:54px!important;height:54px!important}
body.ss-redesign .top .title{font-size:27px!important;line-height:1.02!important;white-space:nowrap!important}
body.ss-redesign .top .title:after{content:'Education through melody.';display:block;color:#ffbf00;font-size:14px;line-height:1.25;margin-top:3px;font-weight:800}
#ssProductNav{gap:8px!important}#ssProductNav .btn{min-height:44px!important;padding:9px 15px!important;border-radius:9px!important;font-size:13px!important}
#ssAccountButton{min-height:44px!important;border-radius:9px!important}body.ss-redesign #authRow{gap:7px!important}
body.ss-redesign .grid{grid-template-columns:275px minmax(0,1fr)!important;gap:20px!important;margin-top:16px!important}
body.ss-redesign .grid>.card{border-radius:14px!important;box-shadow:none!important}body.ss-redesign .grid>.card:first-child h3{font-size:18px!important;padding:14px 14px 10px!important}body.ss-redesign .grid>.card:first-child .body{padding:0 14px 18px!important}
#ssNowArt{border-radius:13px!important;margin-bottom:12px!important}body.ss-redesign #npTitle{font-size:18px!important}
body.ss-redesign .rightHeader{padding:0 0 12px!important;background:transparent!important;border:0!important}body.ss-redesign .rightHeader .row.ssDiscoveryNav{grid-template-columns:minmax(320px,1fr) 145px 145px 115px!important;gap:12px!important}
body.ss-redesign .rightHeader .row.ssDiscoveryNav #search,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnHome,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnSubject,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnAll{min-height:44px!important;border-radius:9px!important}
body.ss-redesign .grid>.card:last-child{border:0!important;background:transparent!important}body.ss-redesign .grid>.card:last-child>.body{padding:0!important;overflow:visible!important}
.ssHero{min-height:218px!important;border-radius:13px!important;margin-bottom:20px!important;grid-template-columns:minmax(420px,.95fr) minmax(500px,1.05fr)!important;background:radial-gradient(circle at 70% 35%,rgba(29,83,127,.28),transparent 45%),linear-gradient(110deg,#121b2a 0%,#0b111a 48%,#111824 100%)!important}.ssHeroCopy{padding:28px 32px!important}.ssHero h1{font-size:42px!important;line-height:.98!important;max-width:500px!important}.ssHero p{font-size:15px!important;margin:13px 0 16px!important}.ssHeroCta{min-height:42px!important;border-radius:8px!important;padding:8px 20px!important}
.ssHeroVisual{padding:12px 24px 12px 0!important}.ssHeroVisual img{width:132px!important;border-radius:12px!important}.ssHeroVisual img:nth-child(2){width:160px!important}.ssMetrics{right:16px!important;bottom:13px!important}.ssMetric{font-size:9px!important;padding:5px 8px!important}
.ssSection{margin:16px 0 24px!important}.ssSectionHead{margin-bottom:10px!important}.ssSectionHead h2{font-size:20px!important}.ssSectionHead button{padding:6px 11px!important;font-size:12px!important}
.ssSubjectGrid{grid-template-columns:repeat(10,minmax(0,1fr))!important;gap:8px!important}.ssSubjectCard,.ssMoreTile{min-height:104px!important;border-radius:9px!important;padding:10px 6px!important}.ssSubjectIcon{font-size:25px!important}.ssSubjectCard{font-size:10px!important}
.ssAlbumGrid{grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:9px!important}.ssAlbumGrid .albumCard{border-radius:10px!important}.ssAlbumGrid .albumCover{border-radius:8px!important}
}
`;

export default {
  async fetch(request, env, ctx) {
    const response = await app.fetch(request, env, ctx);
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/html")) return response;
    let html = await response.text();
    const tag = `<style id="ss-desktop-target">${DESKTOP_CSS}</style>`;
    html = html.includes("</head>") ? html.replace("</head>", tag + "</head>") : tag + html;
    return new Response(html, {status: response.status, statusText: response.statusText, headers: response.headers});
  }
};
