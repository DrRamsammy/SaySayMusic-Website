const ALLOWED_LANGS = new Set(['en','es','fr']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(request);
    if (request.method === 'OPTIONS') return new Response(null,{headers});
    try {
      if (url.pathname === '/health') return json({ok:true,service:'saysay-learning-games'},200,headers);
      if (url.pathname === '/api/categories' && request.method === 'GET') return listCategories(env,headers);
      if (url.pathname.startsWith('/api/games/') && request.method === 'GET') {
        const slug = decodeURIComponent(url.pathname.split('/').pop());
        return getGame(env,slug,url.searchParams.get('lang') || 'en',headers);
      }
      if (url.pathname === '/api/admin/games' && request.method === 'POST') return createGame(request,env,headers);
      if (url.pathname.match(/^\/api\/admin\/games\/[^/]+\/publish$/) && request.method === 'POST') {
        const slug = decodeURIComponent(url.pathname.split('/')[4]);
        return publishGame(env,slug,headers);
      }
      if (url.pathname === '/api/attempts' && request.method === 'POST') return saveAttempt(request,env,headers);
      return json({error:'Not found'},404,headers);
    } catch (err) {
      return json({error:'Server error',detail:String(err?.message || err)},500,headers);
    }
  }
};

function corsHeaders(request){
  const origin=request.headers.get('Origin')||'';
  const allowed = origin.endsWith('.saysaymusic.com') || origin.endsWith('.pages.dev') || origin === '';
  return {'content-type':'application/json; charset=utf-8','access-control-allow-origin':allowed ? (origin || '*') : 'null','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,authorization'};
}
function json(body,status=200,headers={}){return new Response(JSON.stringify(body),{status,headers});}
function requireDb(env){if(!env.DB) throw new Error('Cloudflare D1 binding DB is not configured');return env.DB;}

async function listCategories(env,headers){
  const db=requireDb(env);
  const rows=await db.prepare(`SELECT c.id,c.parent_id,c.slug,c.sort_order,i.language,i.name,i.description FROM categories c LEFT JOIN category_i18n i ON i.category_id=c.id AND i.language='en' WHERE c.status='active' ORDER BY c.parent_id,c.sort_order,i.name`).all();
  return json({categories:rows.results||[]},200,headers);
}

async function getGame(env,slug,lang,headers){
  if(!ALLOWED_LANGS.has(lang)) lang='en';
  const db=requireDb(env);
  const game=await db.prepare(`SELECT g.id,g.slug,g.engine,g.difficulty,g.status,g.category_id,gi.title,gi.instructions,gi.passage,gi.explanation FROM games g JOIN game_i18n gi ON gi.game_id=g.id AND gi.language=? WHERE g.slug=? AND g.status='published'`).bind(lang,slug).first();
  if(!game) return json({error:'Game not found'},404,headers);
  const blanks=await db.prepare(`SELECT blank_key,answer_text,sort_order FROM blanks WHERE game_id=? AND language=? ORDER BY sort_order`).bind(game.id,lang).all();
  const path=await categoryPath(db,game.category_id,lang);
  return json({game:{...game,path,answers:blanks.results||[]}},200,headers);
}

async function categoryPath(db,categoryId,lang){
  const path=[];let id=categoryId;let guard=0;
  while(id && guard++<30){
    const row=await db.prepare(`SELECT c.id,c.parent_id,c.slug,COALESCE(i.name,c.slug) name FROM categories c LEFT JOIN category_i18n i ON i.category_id=c.id AND i.language=? WHERE c.id=?`).bind(lang,id).first();
    if(!row) break;path.unshift({id:row.id,slug:row.slug,name:row.name});id=row.parent_id;
  }
  return path;
}

async function createGame(request,env,headers){
  const db=requireDb(env);const body=await request.json();
  if(!body.slug || !body.category_id || !body.languages?.en) return json({error:'slug, category_id and English content are required'},400,headers);
  const existing=await db.prepare('SELECT id FROM games WHERE slug=?').bind(body.slug).first();
  if(existing) return json({error:'A game with this slug already exists'},409,headers);
  const result=await db.prepare(`INSERT INTO games(category_id,slug,engine,difficulty,status) VALUES(?,?,?,?,?)`).bind(body.category_id,body.slug,body.engine||'fill-build',body.difficulty||null,'draft').run();
  const gameId=result.meta.last_row_id;
  for(const lang of ['en','es','fr']){
    const d=body.languages?.[lang];if(!d) continue;
    await db.prepare(`INSERT INTO game_i18n(game_id,language,title,instructions,passage,explanation,translation_status) VALUES(?,?,?,?,?,?,?)`).bind(gameId,lang,d.title||body.slug,d.instructions||'',d.passage||'',d.explanation||'',lang==='en'?'approved':'draft').run();
    const answers=d.answers||[];
    for(let i=0;i<answers.length;i++) await db.prepare(`INSERT INTO blanks(game_id,language,blank_key,answer_text,occurrence_index,sort_order) VALUES(?,?,?,?,?,?)`).bind(gameId,lang,`b${i+1}`,answers[i],0,i+1).run();
  }
  return json({ok:true,id:gameId,slug:body.slug,status:'draft'},201,headers);
}

async function publishGame(env,slug,headers){
  const db=requireDb(env);const game=await db.prepare('SELECT id FROM games WHERE slug=?').bind(slug).first();if(!game)return json({error:'Game not found'},404,headers);
  const translations=await db.prepare(`SELECT language,title,passage FROM game_i18n WHERE game_id=?`).bind(game.id).all();
  const have=new Set((translations.results||[]).filter(x=>x.title&&x.passage).map(x=>x.language));
  for(const lang of ['en','es','fr']) if(!have.has(lang)) return json({error:`Cannot publish: ${lang} content is incomplete`},400,headers);
  await db.prepare(`UPDATE games SET status='published',published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(game.id).run();
  return json({ok:true,slug,status:'published'},200,headers);
}

async function saveAttempt(request,env,headers){
  const db=requireDb(env);const b=await request.json();
  if(!b.game_id || !ALLOWED_LANGS.has(b.language) || !Number.isFinite(b.score) || !Number.isFinite(b.max_score)) return json({error:'Invalid attempt'},400,headers);
  await db.prepare(`INSERT INTO game_attempts(game_id,user_key,language,score,max_score,duration_ms) VALUES(?,?,?,?,?,?)`).bind(b.game_id,b.user_key||null,b.language,b.score,b.max_score,b.duration_ms||null).run();
  return json({ok:true},201,headers);
}