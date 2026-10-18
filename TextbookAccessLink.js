// Configure only after the separate textbook platform passes its launch checks.
// Missing configuration deliberately leaves the existing navigation unchanged.
export function textbookAccessLink(configuredUrl) {
  if (!configuredUrl) return '';
  let url;
  try { url=new URL(configuredUrl); } catch { return ''; }
  if(url.protocol!=='https:' || url.username || url.password) return '';
  const target=JSON.stringify(url.href).replace(/</g,'\\u003c');
  return `<script id="ss-textbook-access-link">(function(){
    function add(){var nav=document.getElementById('ssProductNav');if(!nav||document.getElementById('ssTextbookAccess'))return;
      var link=document.createElement('a');link.id='ssTextbookAccess';link.className='btn';link.href=${target};link.textContent='Textbook Access';nav.appendChild(link);}
    function boot(){add();new MutationObserver(add).observe(document.body,{childList:true,subtree:true});}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  })();</script>`;
}
