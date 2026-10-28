import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("./API.js", import.meta.url), "utf8");
const uiSource = readFileSync(new URL("./UI.js", import.meta.url), "utf8");
function part(a,b) { return source.slice(source.indexOf(a), source.indexOf(b,source.indexOf(a))); }

test("R2 folder scan uses objects and follows all pages", async () => {
  const calls = [];
  const context = vm.createContext({ normalizeAlbumPath: s => s, r2ListAll: async (_,prefix,limit,cursor) => {
    calls.push({prefix,limit,cursor});
    return cursor ? {objects:[{key:"folder/two.mp3"}],truncated:false} : {objects:[{key:"folder/one.mp3"}],truncated:true,cursor:"next"};
  } });
  vm.runInContext(part("async function listAlbumFolderObjects(", "async function getOrCreateAlbum("),context);
  const out = await context.listAlbumFolderObjects({}, "folder", 2000);
  assert.equal(out.objects.length,2);
  assert.equal(calls[0].limit,1000);
  assert.equal(calls[1].cursor,"next");
});

test("Album ID resolves to its verified cover folder", async () => {
  const id = "a".repeat(40);
  const context = vm.createContext({normalizeAlbumPath:s=>s, getAlbumById:async()=>({cover_key:"folder/1.png"}),sha1Hex:async()=>id});
  vm.runInContext(part("async function resolveAlbumToolPath(", "async function apiAdminRebuildAlbumCover("),context);
  assert.equal(await context.resolveAlbumToolPath({},id),"folder");
  assert.equal(await context.resolveAlbumToolPath({},"folder"),"folder");
});

test("relink preserves existing album details and order while appending new tracks", async () => {
  const statements = [];
  const album = {id:"album",artist:"SaySayCreator",user_id:"owner",status:"published",subject:"Entertainment",cover_key:"folder/1.png"};
  const context = vm.createContext({
    URL, Response, Map,
    requireAdminOrCreator:async()=>({ok:true,user:{id:"admin"}}),
    normalizeAlbumRef:body=>body.prefix,isTruthyFlag:Boolean,resolveAlbumToolPath:async(_,s)=>s,
    sha1Hex:async s=>s.startsWith("album:")?"album":"new",
    listAlbumFolderObjects:async()=>({objects:[{key:"folder/new.mp3"},{key:"folder/old.mp3"},{key:"folder/1.png"}]}),
    isAudioKey:s=>s.endsWith(".mp3"),isImageKey:s=>s.endsWith(".png"),pickCoverKey:()=> "folder/1.png",
    deriveCatalogInfo:()=>({}),getAlbumById:async()=>album,
    getOrCreateAlbum:()=>{throw Error("Existing album must not be rewritten");},
    fetchExistingTrackIdsByAudioKey:async()=>({"folder/old.mp3":"old"}),
    basename:s=>s.split("/").pop(),parseTrackIndex:()=>null,trackTitleFromFilename:s=>s,
    buildPublicAudioUrl:s=>s,withCors:(_,r)=>r,json:body=>new Response(JSON.stringify(body)),
    bad:(error,status)=>new Response(JSON.stringify({error}),{status})
  });
  const env={DB:{prepare(sql){
    const entry={sql,values:[]};statements.push(entry);
    return {bind(...values){entry.values=values;return this;},async all(){return {results:[{track_id:"old",track_index:7}]};},async run(){}};
  }}};
  vm.runInContext(part("async function apiAdminRelinkAlbumTracks(", "async function apiAdminAlbumAudit("),context);
  const response=await context.apiAdminRelinkAlbumTracks({url:"https://test.invalid",method:"POST",json:async()=>({prefix:"folder"})},env);
  const out=await response.json();
  assert.equal(out.ok,true);
  assert.equal(out.summary.audio_found,2);
  assert.equal(out.summary.tracks_created,1);
  const insert=statements.find(e=>e.sql.startsWith("INSERT INTO tracks"));
  assert.equal(insert.values[2],"SaySayCreator");
  assert.equal(insert.values[4],"owner");
  assert.equal(insert.values[8],"album");
  assert.equal(insert.values[9],"published");
  const links=statements.filter(e=>e.sql.startsWith("INSERT INTO album_tracks"));
  assert.equal(links[0].values[2],8);
  assert.equal(links[1].values[2],7);
  assert.ok(!statements.some(e=>e.sql.startsWith("UPDATE albums")));
});

function uiContext(api) {
  const start=uiSource.indexOf('"  function studioRunAlbumTool(');
  const end=uiSource.indexOf('"  function studioRefreshDashboard(){",',start);
  const js=uiSource.slice(start,end).split("\n").filter(l=>l.trim().startsWith('"')).map(l=>JSON.parse(l.trim().replace(/,$/,""))).join("\n");
  const results=[];
  const context=vm.createContext({Promise,JSON,studioPayloadFromAlbumRef:()=>({prefix:"folder",albumId:"folder"}),studioSetResult:(_,s)=>results.push(s),api});
  vm.runInContext(js,context);
  return {context,results};
}
test("existing Relink button helper sends POST and displays loading plus result",async()=>{
  const calls=[];
  const {context,results}=uiContext(async(path,opts)=>{calls.push({path,opts});return {ok:true,summary:{tracks_linked:2}};});
  await context.studioRunRelinkAlbum();
  assert.equal(calls[0].path,"/api/admin/relink-album-tracks");
  assert.equal(calls[0].opts.method,"POST");
  assert.match(results[0],/Linking/);
  assert.equal(results[1].summary.tracks_linked,2);
});
test("album tools display API errors",async()=>{
  const {context,results}=uiContext(async()=>{throw Error("Access denied");});
  await context.studioRunAlbumAudit();
  assert.equal(results.at(-1),"Error: Access denied");
});
