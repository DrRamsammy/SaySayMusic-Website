import redesigned from "./RedesignedUI.js";

const POLISH_CSS = String.raw`
body.ss-redesign .wrap{max-width:1600px;padding:18px 28px}
body.ss-redesign .top{min-height:92px;grid-template-columns:minmax(330px,1fr) auto auto auto;gap:22px;padding:16px 20px;border-radius:18px}
body.ss-redesign .top .logo{width:64px;height:64px;min-width:64px}body.ss-redesign .top .logo img{width:64px!important;height:64px!important}
body.ss-redesign .top .title{font-size:29px;line-height:1.05;letter-spacing:-.35px}
#ssProductNav{gap:12px}#ssProductNav .btn{min-height:50px;padding:11px 20px;font-size:15px;border-radius:13px}
#ssAccountButton,#ssForArtists{min-height:48px;padding:10px 18px;font-size:14px;border-radius:13px}
body.ss-redesign #authRow{display:none!important}
body.ss-redesign .grid{grid-template-columns:320px minmax(0,1fr);gap:26px;margin-top:24px}
body.ss-redesign .grid>.card:first-child h3{font-size:21px;padding:18px 18px 14px}
body.ss-redesign .grid>.card:first-child .body{padding:0 18px 22px}
#ssNowArt{border-radius:18px;margin-bottom:16px}
body.ss-redesign #npTitle{font-size:21px}
body.ss-redesign .rightHeader{padding:16px 18px}
body.ss-redesign .rightHeader .row.ssDiscoveryNav{grid-template-columns:minmax(320px,1fr) repeat(3,minmax(130px,170px));gap:12px}
body.ss-redesign .rightHeader .row.ssDiscoveryNav #search,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnHome,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnSubject,body.ss-redesign .rightHeader .row.ssDiscoveryNav #btnAll{min-height:50px;font-size:15px}
body.ss-redesign .grid>.card:last-child>.body{padding:20px 22px 30px}
.ssHero{min-height:270px;border-radius:18px;margin-bottom:26px;grid-template-columns:minmax(0,1.15fr) minmax(420px,.85fr)}
.ssHeroCopy{padding:40px 46px}.ssHero h1{font-size:54px;line-height:.98;max-width:700px}.ssHero p{font-size:18px;margin:18px 0 20px}.ssHeroCta{min-height:50px;padding:11px 22px;font-size:16px}
.ssHeroVisual{padding:20px 38px 20px 0}.ssHeroVisual img{width:170px;border-radius:18px}.ssHeroVisual img:nth-child(2){width:205px}
.ssSection{margin:24px 0 30px}.ssSectionHead{margin-bottom:14px}.ssSectionHead h2{font-size:25px}.ssSectionHead button{padding:8px 14px;font-size:13px}
.ssSubjectGrid{grid-template-columns:repeat(10,minmax(0,1fr));gap:12px}.ssSubjectCard,.ssMoreTile{min-height:128px!important;border-radius:15px!important}.ssSubjectIcon{font-size:31px}.ssSubjectCard{font-size:12px!important}
.ssAlbumGrid{grid-template-columns:repeat(6,minmax(0,1fr));gap:14px}.ssAlbumGrid .albumCard{border-radius:16px!important}.ssAlbumGrid .albumCover{border-radius:14px!important}
#ssForArtists{background:#0b0e12;border:1px solid rgba(255,191,0,.32);color:#fff;font-weight:800;cursor:pointer;white-space:nowrap}
@media(max-width:1320px){body.ss-redesign .top{grid-template-columns:minmax(260px,1fr) auto auto auto;gap:12px}body.ss-redesign .top .title{font-size:22px}#ssProductNav .btn{padding:9px 13px;font-size:12px}.ssSubjectGrid{grid-template-columns:repeat(5,minmax(0,1fr))}.ssAlbumGrid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:980px){body.ss-redesign .wrap{padding:10px}.ssHeroCopy{padding:24px 20px}.ssHero h1{font-size:36px}.ssSubjectGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.ssAlbumGrid{grid-template-columns:repeat(2,minmax(0,1fr))}#ssForArtists{display:none}}
`;

const POLISH_JS = String.raw`
(function(){
  function byId(id){return document.getElementById(id)}
  function findButton(text){var all=document.querySelectorAll('button');for(var i=0;i<all.length;i++){if(String(all[i].textContent||'').trim()===text)return all[i]}return null}
  function polishHeader(){
    var top=document.querySelector('.top'); if(!top)return;
    var account=byId('ssAccountWrap');
    var artists=byId('ssForArtists');
    if(!artists){
      var existing=findButton('For Artists');
      if(existing){artists=existing;artists.id='ssForArtists'}
      else{
        artists=document.createElement('button');artists.id='ssForArtists';artists.type='button';artists.textContent='For Artists';
        artists.onclick=function(){
          var studio=byId('btnStudio');
          var artistUpgrade=byId('btnUpgradeArtist');
          if(studio&&getComputedStyle(studio).display!=='none'){studio.click();return}
          if(artistUpgrade){artistUpgrade.click();return}
          var upgrade=byId('btnUpgradeTop');if(upgrade)upgrade.click();
        };
      }
    }
    if(account&&artists.parentNode!==top)top.insertBefore(artists,account);
    else if(!account&&artists.parentNode!==top)top.appendChild(artists);
    var menu=byId('ssAccountMenu');
    var auth=byId('authRow');
    if(menu&&auth){
      var logout=null,buttons=auth.querySelectorAll('button');
      for(var i=0;i<buttons.length;i++){if(/logout/i.test(buttons[i].textContent||'')){logout=buttons[i];break}}
      if(logout&&logout.parentNode!==menu){logout.textContent='↪ Log out';menu.appendChild(logout)}
    }
  }
  function boot(){polishHeader();var a=byId('authRow');if(a)new MutationObserver(function(){setTimeout(polishHeader,20)}).observe(a,{childList:true,subtree:true});setTimeout(polishHeader,300);setTimeout(polishHeader,1200)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
`;

function enhance(html){if(!html||typeof html!=="string")return html;if(html.includes('id="saysay-polish-css"'))return html;html=html.replace('</head>','<style id="saysay-polish-css">'+POLISH_CSS+'</style></head>');html=html.replace('</body>','<script id="saysay-polish-js">'+POLISH_JS+'</script></body>');return html}

export default{async fetch(request,env,ctx){const response=await redesigned.fetch(request,env,ctx);const ct=response.headers.get('content-type')||'';if(!ct.toLowerCase().includes('text/html'))return response;const html=await response.text();const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');return new Response(enhance(html),{status:response.status,statusText:response.statusText,headers})}};
