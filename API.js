/**
 * saysay-platform-api — FULL WORKER (SAFE API MATURITY REBUILD v2)
 *
 * Fix in this version:
 * ✅ Repairs /api/tracks 1101 error
 * ✅ Keeps all previous rebuild improvements
 * ✅ Keeps Bundle 7 behavior
 * ✅ Keeps metadata inference improvements
 * ✅ Keeps additive search / sort support
 */

const FIXED_ORIGINS = new Set([
  "https://app.saysaymusic.com",
  "https://studio.saysaymusic.com",
  "https://saysaymusic.com",
  "https://www.saysaymusic.com",
]);

const AUDIO_EXT_RE = /\.(mp3|wav|m4a|flac|ogg)$/i;
const IMAGE_EXT_RE = /\.(png|jpg|jpeg|webp)$/i;

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (FIXED_ORIGINS.has(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.protocol === "https:" && u.hostname.endsWith(".saysayeducator.workers.dev")) return true;
    if (u.protocol === "https:" && u.hostname.endsWith(".pages.dev")) return true;
    return false;
  } catch {
    return false;
  }
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowOrigin = isAllowedOrigin(origin) ? origin : "https://app.saysaymusic.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
    "Vary": "Origin",
  };
}

function withCors(request, resp) {
  const h = new Headers(resp.headers);
  const c = corsHeaders(request);
  Object.keys(c).forEach((k) => h.set(k, c[k]));
  h.set("X-Debug-Host", new URL(request.url).host);
  h.set("X-Debug-Path", new URL(request.url).pathname);
  h.set("X-Debug-Origin", request.headers.get("Origin") || "");
  return new Response(resp.body, { status: resp.status, headers: h });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj, null, 2), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function bad(msg, status) {
  return json({ ok: false, error: msg }, status || 400);
}

function getCookie(request, name) {
  const c = request.headers.get("Cookie") || "";
  const parts = c.split(";").map((s) => s.trim());
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}

function setSessionCookie(sessionToken) {
  return [
    "ss_session=" + encodeURIComponent(sessionToken),
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Domain=.saysaymusic.com",
    "Max-Age=" + String(60 * 60 * 24 * 14),
  ].join("; ");
}

function clearSessionCookie() {
  return [
    "ss_session=",
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Domain=.saysaymusic.com",
    "Max-Age=0",
  ].join("; ");
}

function randomToken() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  let s = "";
  for (let i = 0; i < a.length; i++) s += a[i].toString(16).padStart(2, "0");
  return s;
}

async function sha1Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

async function hashPassword(password) {
  const raw = String(password || "");
  return await sha256Hex("saysay_pw_v1::" + raw);
}

function safeTitleFromSegment(seg) {
  return String(seg || "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function slugifySegment(seg) {
  return String(seg || "")
    .replace(/\.[^/.]+$/g, "")
    .replace(/[^a-zA-Z0-9 _-]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function trackTitleFromFilename(filename) {
  const base = String(filename || "").replace(AUDIO_EXT_RE, "");
  const stripped = base.replace(/^\s*\d+\s*[-_ ]\s*/g, "");
  return safeTitleFromSegment(stripped);
}

function parseTrackIndex(filename) {
  const m = String(filename || "").match(/^\s*(\d{1,4})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!isFinite(n)) return null;
  return n;
}

function isAudioKey(key) {
  return AUDIO_EXT_RE.test(String(key || ""));
}

function isImageKey(key) {
  return IMAGE_EXT_RE.test(String(key || ""));
}

function basename(key) {
  const parts = String(key || "").split("/");
  return parts.length ? parts[parts.length - 1] : key;
}

function dirname(key) {
  const parts = String(key || "").split("/");
  if (parts.length <= 1) return "";
  parts.pop();
  return parts.join("/");
}

function buildPublicAudioUrl(key) {
  return "https://audio.saysaymusic.com/" + encodeURI(key).replace(/#/g, "%23");
}

function getAdminToken(request) {
  const auth = request.headers.get("Authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const x = request.headers.get("X-Admin-Token");
  if (x) return x.trim();
  return null;
}

async function getSessionUser(request, env) {
  const token = getCookie(request, "ss_session");
  if (!token) return null;

  const tokenHash = await sha1Hex(token);
  const row = await env.DB.prepare(
"SELECT s.user_id AS user_id, u.handle AS handle, u.email AS email, u.role AS role, u.plan AS plan, u.daily_seconds_used AS daily_seconds_used, u.last_listen_date AS last_listen_date " +
    "FROM sessions s JOIN users u ON u.id = s.user_id " +
    "WHERE s.token_hash = ? AND s.expires_at > datetime('now')"
  ).bind(tokenHash).first();

  if (!row) return null;
return {
  id: row.user_id,
  handle: row.handle,
  email: row.email,
  role: row.role || "creator",
  plan: row.plan || "free",
  daily_seconds_used: row.daily_seconds_used,
  last_listen_date: row.last_listen_date
};
}

function hasUnlimitedAccess(user) {
  if (!user) return false;

  const role = String(user.role || "").toLowerCase().trim();
  const plan = String(user.plan || "").toLowerCase().trim();

  if (role === "admin") return true;
  if (role === "creator") return true;
  if (role === "artist") return true;
  if (plan === "premium") return true;
  if (plan === "artist") return true;

  return false;
}

async function requireAdmin(request, env) {
  const tok = getAdminToken(request);
  if (tok && env.ADMIN_TOKEN && tok === env.ADMIN_TOKEN) return true;

  const user = await getSessionUser(request, env);
  if (user && String(user.role || "").toLowerCase() === "admin") return true;

  return false;
}

async function requireAdminOrCreator(request, env) {
  const headerAdmin = await requireAdmin(request, env);
  if (headerAdmin) return { ok: true, user: null, via: "header_admin" };

  const user = await getSessionUser(request, env);
  if (!user) return { ok: false, status: 401, error: "Login required" };

  const role = String(user.role || "creator").toLowerCase();
 if (role !== "admin" && role !== "creator" && role !== "artist") {
    return { ok: false, status: 403, error: "Admin only" };
  }

  return { ok: true, user: user, via: "session" };
}

async function addColumnIfMissing(env, tableName, columnName, definitionSql) {
  try {
    const info = await env.DB.prepare("PRAGMA table_info(" + tableName + ")").all();
    const cols = (info.results || []).map((r) => String(r.name || "").toLowerCase());
    if (cols.indexOf(String(columnName).toLowerCase()) === -1) {
      await env.DB.prepare("ALTER TABLE " + tableName + " ADD COLUMN " + definitionSql).run();
    }
  } catch {}
}

async function ensureSchema(env) {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      handle TEXT UNIQUE,
      email TEXT,
      role TEXT DEFAULT 'creator',
      password_hash TEXT,
      plan TEXT DEFAULT 'free',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS invites (
      code TEXT PRIMARY KEY,
      note TEXT,
      used_by TEXT,
      used_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      title TEXT,
      artist TEXT,
      audio_key TEXT,
      user_id TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    )`,
    `CREATE TABLE IF NOT EXISTS likes (
      user_id TEXT,
      track_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, track_id)
    )`,
    `CREATE TABLE IF NOT EXISTS plays_daily (
      day TEXT,
      track_id TEXT,
      plays INTEGER DEFAULT 0,
      PRIMARY KEY (day, track_id)
    )`,
    `CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT,
      following_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (follower_id, following_id)
    )`,
    `CREATE TABLE IF NOT EXISTS albums (
      id TEXT PRIMARY KEY,
      title TEXT,
      artist TEXT,
      cover_key TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    )`,
    `CREATE TABLE IF NOT EXISTS album_tracks (
      album_id TEXT,
      track_id TEXT,
      track_index INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (album_id, track_id)
    )`,
    `CREATE TABLE IF NOT EXISTS artist_applications (
      id TEXT PRIMARY KEY,
      name TEXT,
      artist_name TEXT,
      email TEXT,
      phone TEXT,
      message TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ];

  for (let i = 0; i < stmts.length; i++) {
    await env.DB.prepare(stmts[i]).run();
  }

  await addColumnIfMissing(env, "users", "role", "role TEXT DEFAULT 'creator'");
  await addColumnIfMissing(env, "users", "password_hash", "password_hash TEXT");
  await addColumnIfMissing(env, "users", "plan", "plan TEXT DEFAULT 'free'");
  await addColumnIfMissing(env, "users", "daily_seconds_used", "daily_seconds_used INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(env, "users", "last_listen_date", "last_listen_date TEXT");

  await addColumnIfMissing(env, "tracks", "subject", "subject TEXT");
  await addColumnIfMissing(env, "tracks", "grade_level", "grade_level TEXT");
  await addColumnIfMissing(env, "tracks", "grade_group", "grade_group TEXT");
  await addColumnIfMissing(env, "tracks", "status", "status TEXT DEFAULT 'draft'");

  await addColumnIfMissing(env, "albums", "subject", "subject TEXT");
  await addColumnIfMissing(env, "albums", "grade_level", "grade_level TEXT");
  await addColumnIfMissing(env, "albums", "grade_group", "grade_group TEXT");
  await addColumnIfMissing(env, "albums", "user_id", "user_id TEXT");
  await addColumnIfMissing(env, "albums", "status", "status TEXT DEFAULT 'draft'");

  await addColumnIfMissing(env, "artist_applications", "name", "name TEXT");
  await addColumnIfMissing(env, "artist_applications", "artist_name", "artist_name TEXT");
  await addColumnIfMissing(env, "artist_applications", "email", "email TEXT");
  await addColumnIfMissing(env, "artist_applications", "phone", "phone TEXT");
  await addColumnIfMissing(env, "artist_applications", "message", "message TEXT");
  await addColumnIfMissing(env, "artist_applications", "status", "status TEXT DEFAULT 'pending'");
  await addColumnIfMissing(env, "artist_applications", "created_at", "created_at TEXT DEFAULT (datetime('now'))");
}

async function handleOptions(request) {
  return withCors(request, new Response("", { status: 204 }));
}

async function r2ListAll(env, prefix, limit, cursor) {
  const opts = {};
  if (prefix) opts.prefix = prefix;
  if (limit) opts.limit = limit;
  if (cursor) opts.cursor = cursor;
  return await env.AUDIO_USER.list(opts);
}

async function r2ObjectExists(env, key) {
  try {
    const obj = await env.AUDIO_USER.head(key);
    return !!obj;
  } catch {
    return false;
  }
}

function pickCoverKey(imageKeys) {
  const priorities = [
    "1.png","1.jpg","1.jpeg","1.webp",
    "01.png","01.jpg","01.jpeg","01.webp",
    "ac.png","ac.jpg","ac.jpeg","ac.webp",
    "ac1.png","ac2.png","ac3.png","ac4.png","ac5.png","ac6.png","ac7.png","ac8.png","ac9.png",
    "album_cover.png","album_cover.jpg","albumcover.png",
    "cover.png","cover.jpg","folder.png",
    "b1.png",
  ];

  const lower = (imageKeys || []).map((k) => ({ k: k, b: basename(k).toLowerCase() }));
  for (let i = 0; i < priorities.length; i++) {
    const p = priorities[i];
    for (let j = 0; j < lower.length; j++) {
      if (lower[j].b === p) return lower[j].k;
    }
  }
  return imageKeys && imageKeys.length ? imageKeys[0] : null;
}

function deriveCatalogInfo(pathOrKey) {
  const raw = String(pathOrKey || "");
  const pathOnly = raw.replace(/\\/g, "/");
  const parts = pathOnly.split("/").filter(Boolean);
  const joined = parts.join("/");
  const lowerJoined = joined.toLowerCase();
  const root = parts[0] || "";
  const rootLower = root.toLowerCase();

  let subject = root || null;
  let grade_level = null;
  let grade_group = null;

  const normalizedJoined = lowerJoined
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const candidates = [
    ...parts.map((p) => String(p)),
    joined,
    normalizedJoined,
  ];

  function setGrade(level, group) {
    if (level !== null && level !== undefined && grade_level === null) grade_level = String(level);
    if (group && !grade_group) grade_group = group;
  }

  for (let i = 0; i < candidates.length; i++) {
    const c = String(candidates[i] || "");
    const lc = c.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

    let m = lc.match(/\belementary\s*grade\s*(\d{1,2})\b/);
    if (m) setGrade(m[1], "Elementary");

    m = lc.match(/\bmiddle\s*math\s*grade\s*(\d{1,2})\b/);
    if (m) setGrade(m[1], "Middle");

    m = lc.match(/\bhigh\s*s?\s*math\s*grade\s*(\d{1,2})\b/);
    if (m) setGrade(m[1], "High");

    m = lc.match(/\bgrade\s*(\d{1,2})\b/);
    if (m && grade_level === null) setGrade(m[1], null);

    m = lc.match(/\balgebra\s*1\b/);
    if (m && grade_group === null) grade_group = "High";

    m = lc.match(/\balgebra\s*2\b/);
    if (m && grade_group === null) grade_group = "High";
  }

  if (grade_level !== null) {
    const n = parseInt(grade_level, 10);
    if (isFinite(n) && !grade_group) {
      if (n >= 3 && n <= 5) grade_group = "Elementary";
      else if (n >= 6 && n <= 8) grade_group = "Middle";
      else if (n >= 9 && n <= 12) grade_group = "High";
    }
  }

  if (rootLower === "math") {
    subject = "Math";
  }

  if (!subject) subject = null;

  return { subject, grade_level, grade_group };
}

function normalizeAlbumPath(input) {
  return String(input || "").trim().replace(/^\/+|\/+$/g, "");
}

function isTruthyFlag(v) {
  return v === true || v === 1 || v === "1" || v === "true" || v === "yes";
}

function firstNonEmpty() {
  for (let i = 0; i < arguments.length; i++) {
    const v = arguments[i];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function normalizeAlbumRef(body, url) {
  body = body || {};
  url = url || new URL("https://x.invalid");
  return normalizeAlbumPath(firstNonEmpty(
    body.album,
    body.album_path,
    body.prefix,
    body.albumId,
    body.album_id,
    url.searchParams.get("album"),
    url.searchParams.get("album_path"),
    url.searchParams.get("prefix"),
    url.searchParams.get("albumId"),
    url.searchParams.get("album_id")
  ));
}

function buildCreatorAlbumPath(user, subject, albumTitle, fallbackTitle) {
  const handle = slugifySegment(
    (user && user.handle) ? String(user.handle) : "unknown_creator"
  ) || "unknown_creator";

  const safeSubject = slugifySegment(String(subject || "").trim()) || "Unsorted";
  const baseAlbumTitle = String(albumTitle || fallbackTitle || "Untitled Album").trim();
  const safeAlbumTitle = slugifySegment(baseAlbumTitle) || "Untitled_Album";

  return normalizeAlbumPath("Creators/" + handle + "/" + safeSubject + "/" + safeAlbumTitle);
}

function normalizeTrackId(body, url) {
  body = body || {};
  url = url || new URL("https://x.invalid");
  return firstNonEmpty(
    body.track_id,
    body.trackId,
    url.searchParams.get("track_id"),
    url.searchParams.get("trackId")
  );
}

function parseCursorPair(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const idx = s.indexOf("__");
  if (idx === -1) return null;
  const left = s.slice(0, idx);
  const right = s.slice(idx + 2);
  if (!left || !right) return null;
  return { created_at: left, id: right };
}

function parsePrefixCursor(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const idx = s.indexOf("__");
  if (idx === -1) return null;
  const left = s.slice(0, idx);
  const right = s.slice(idx + 2);
  if (!left || !right) return null;
  return { created_at: left, id: right };
}

function clampInt(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (!isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function buildNextCursorFromRow(row) {
  if (!row) return null;
  return String(row.created_at) + "__" + String(row.id);
}

function appendFilterEquals(filters, binds, sqlExpr, rawValue) {
  const v = String(rawValue || "").trim();
  if (!v) return;
  filters.push(sqlExpr + " = ?");
  binds.push(v);
}

function appendFilterQ(filters, binds, expressions, rawValue) {
  const q = String(rawValue || "").trim();
  if (!q) return;
  const like = "%" + q + "%";
  const ors = [];
  for (let i = 0; i < expressions.length; i++) {
    ors.push(expressions[i] + " LIKE ?");
    binds.push(like);
  }
  if (ors.length) filters.push("(" + ors.join(" OR ") + ")");
}

function appendCursorDesc(filters, binds, createdExpr, idExpr, cursor) {
  if (!cursor || cursor.created_at === undefined || cursor.id === undefined) return;
  filters.push("((" + createdExpr + " < ?) OR (" + createdExpr + " = ? AND " + idExpr + " < ?))");
  binds.push(cursor.created_at, cursor.created_at, cursor.id);
}

function sqlBindAll(stmt, binds) {
  return stmt.bind.apply(stmt, binds);
}

function normalizeSort(rawSort, kind) {
  const s = String(rawSort || "").trim().toLowerCase();

  if (kind === "albums") {
    if (s === "title") return "title";
    if (s === "subject") return "subject";
    if (s === "grade") return "grade";
    if (s === "newest") return "newest";
    if (s === "recently_added") return "newest";
    return "newest";
  }

  if (kind === "tracks") {
    if (s === "title") return "title";
    if (s === "subject") return "subject";
    if (s === "grade") return "grade";
    if (s === "newest") return "newest";
    if (s === "recently_added") return "newest";
    if (s === "popularity") return "popularity";
    return "newest";
  }

  return "newest";
}

function buildTrackOrderBy(sort) {
  if (sort === "title") return "t.title COLLATE NOCASE ASC, t.created_at DESC, t.id DESC";
  if (sort === "subject") return "t.subject COLLATE NOCASE ASC, t.title COLLATE NOCASE ASC, t.created_at DESC, t.id DESC";
  if (sort === "grade") return "CAST(COALESCE(NULLIF(t.grade_level,''), '999') AS INTEGER) ASC, t.title COLLATE NOCASE ASC, t.created_at DESC, t.id DESC";
  if (sort === "popularity") return "COALESCE(p.plays,0) DESC, t.created_at DESC, t.id DESC";
  return "t.created_at DESC, t.id DESC";
}

function buildAlbumOrderBy(sort) {
  if (sort === "title") return "a.title COLLATE NOCASE ASC, a.created_at DESC, a.id DESC";
  if (sort === "subject") return "a.subject COLLATE NOCASE ASC, a.title COLLATE NOCASE ASC, a.created_at DESC, a.id DESC";
  if (sort === "grade") return "CAST(COALESCE(NULLIF(a.grade_level,''), '999') AS INTEGER) ASC, a.title COLLATE NOCASE ASC, a.created_at DESC, a.id DESC";
  return "a.created_at DESC, a.id DESC";
}

function guessAudioContentType(key) {
  const k = String(key || "").toLowerCase();
  if (k.endsWith(".mp3")) return "audio/mpeg";
  if (k.endsWith(".wav")) return "audio/wav";
  if (k.endsWith(".m4a")) return "audio/mp4";
  if (k.endsWith(".flac")) return "audio/flac";
  if (k.endsWith(".ogg")) return "audio/ogg";
  return "application/octet-stream";
}

function guessImageContentType(name) {
  const k = String(name || "").toLowerCase();
  if (k.endsWith(".png")) return "image/png";
  if (k.endsWith(".jpg") || k.endsWith(".jpeg")) return "image/jpeg";
  if (k.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function isAllowedAudioUpload(file) {
  if (!file || typeof file.name !== "string") return false;
  return AUDIO_EXT_RE.test(file.name || "");
}

function isAllowedCoverUpload(file) {
  if (!file || typeof file.name !== "string") return false;
  return IMAGE_EXT_RE.test(file.name || "");
}

function preferredCoverFilename(fileName) {
  const lower = String(fileName || "").toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "1.jpg";
  if (lower.endsWith(".webp")) return "1.webp";
  return "1.png";
}

function passesKindFilter(key, kind) {
  if (!kind || kind === "all") return true;
  if (kind === "audio") return isAudioKey(key);
  if (kind === "image") return isImageKey(key);
  return true;
}

function summarizeSubjects(items, maxItems) {
  const map = {};
  const list = items || [];
  for (let i = 0; i < list.length; i++) {
    const s = String((list[i] && list[i].subject) || "").trim();
    if (!s) continue;
    if (!map[s]) map[s] = 0;
    map[s] += 1;
  }
  return Object.keys(map)
    .sort(function(a, b) { return map[b] - map[a]; })
    .slice(0, maxItems || 10)
    .map(function(k) {
      return { subject: k, count: map[k] };
    });
}

function summarizeFolders(albumPlans, maxItems) {
  const list = albumPlans || [];
  return list.slice(0, maxItems || 25).map(function(a) {
    return {
      folder: a.folder,
      album_id: a.id,
      title: a.title,
      cover_key: a.cover_key || null,
      has_cover: !!a.cover_key,
      subject: a.subject || null,
      grade_level: a.grade_level || null,
      grade_group: a.grade_group || null
    };
  });
}

function summarizeDuplicateRisk(trackPlan, maxItems) {
  const titleMap = {};
  const keyMap = {};
  const risks = [];

  for (let i = 0; i < trackPlan.length; i++) {
    const t = trackPlan[i];
    const titleKey = String((t.title || "") + "||" + (t.album_id || "")).toLowerCase();
    const audioKey = String(t.audio_key || "").toLowerCase();

    if (!titleMap[titleKey]) titleMap[titleKey] = 0;
    titleMap[titleKey] += 1;

    if (!keyMap[audioKey]) keyMap[audioKey] = 0;
    keyMap[audioKey] += 1;
  }

  for (let i = 0; i < trackPlan.length; i++) {
    const t = trackPlan[i];
    const titleKey = String((t.title || "") + "||" + (t.album_id || "")).toLowerCase();
    const audioKey = String(t.audio_key || "").toLowerCase();
    const titleDup = titleMap[titleKey] > 1;
    const keyDup = keyMap[audioKey] > 1;
    if (titleDup || keyDup) {
      risks.push({
        track_id: t.id,
        title: t.title,
        album_id: t.album_id,
        audio_key: t.audio_key,
        duplicate_title_within_album: titleDup,
        duplicate_audio_key_in_scan: keyDup
      });
    }
  }

  return risks.slice(0, maxItems || 25);
}

async function getAlbumById(env, albumId) {
  return await env.DB.prepare(
    "SELECT id, title, artist, cover_key, created_at, subject, grade_level, grade_group, user_id, status FROM albums WHERE id = ?"
  ).bind(albumId).first();
}

async function getTrackById(env, trackId) {
  return await env.DB.prepare(
    "SELECT id, title, artist, audio_key, user_id, created_at, subject, grade_level, grade_group FROM tracks WHERE id = ?"
  ).bind(trackId).first();
}

async function getNextAlbumTrackIndex(env, albumId) {
  const row = await env.DB.prepare(
    "SELECT COALESCE(MAX(track_index), 0) AS max_idx FROM album_tracks WHERE album_id = ?"
  ).bind(albumId).first();
  const maxIdx = row && row.max_idx ? Number(row.max_idx) : 0;
  return maxIdx + 1;
}

async function listAlbumFolderObjects(env, albumPath, limit) {
  return await r2ListAll(env, normalizeAlbumPath(albumPath) + "/", limit || 1000, undefined);
}

async function getOrCreateAlbum(env, albumPath, artist, subject, gradeLevel, gradeGroup, albumTitleOverride, coverKey, userId, status) {
  const safeAlbumPath = normalizeAlbumPath(albumPath);
  const albumId = await sha1Hex("album:" + safeAlbumPath);
  const existingAlbum = await getAlbumById(env, albumId);

  await env.DB.prepare(
    "INSERT INTO albums (id, title, artist, cover_key, subject, grade_level, grade_group, user_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET " +
    "title=COALESCE(excluded.title, albums.title), " +
    "artist=COALESCE(excluded.artist, albums.artist), " +
    "cover_key=COALESCE(excluded.cover_key, albums.cover_key), " +
    "subject=COALESCE(excluded.subject, albums.subject), " +
    "grade_level=COALESCE(excluded.grade_level, albums.grade_level), " +
    "grade_group=COALESCE(excluded.grade_group, albums.grade_group), " +
    "user_id=COALESCE(albums.user_id, excluded.user_id), " +
    "status='draft'"
  ).bind(
    albumId,
    albumTitleOverride || safeTitleFromSegment(safeAlbumPath.split("/").pop() || safeAlbumPath),
    artist || "SaySay",
    coverKey || null,
  (String(subject || "").trim() || "Other"),
    gradeLevel || null,
    gradeGroup || null,
    userId || null,
        "draft"
  ).run();

  const album = await getAlbumById(env, albumId);
  return {
    album_id: albumId,
    album: album,
    existed_before: !!existingAlbum,
    album_path: safeAlbumPath
  };
}

async function fetchExistingTrackIdsByAudioKey(env, audioKeys) {
  const map = {};
  if (!audioKeys || !audioKeys.length) return map;

  const CHUNK = 100;
  for (let i = 0; i < audioKeys.length; i += CHUNK) {
    const slice = audioKeys.slice(i, i + CHUNK);
    const q = "SELECT id, audio_key FROM tracks WHERE audio_key IN (" + slice.map(() => "?").join(",") + ")";
    const res = await env.DB.prepare(q).bind(...slice).all();
    (res.results || []).forEach((r) => { map[r.audio_key] = r.id; });
  }
  return map;
}

function parseRangeHeader(rangeHeader) {
  const m = String(rangeHeader || "").match(/bytes=(\d+)-(\d*)/i);
  if (!m) return undefined;
  const start = parseInt(m[1], 10);
  const endStr = m[2];
  let end = undefined;
  if (endStr && endStr.length) end = parseInt(endStr, 10);
  if (!isFinite(start)) return undefined;
  if (end !== undefined && !isFinite(end)) end = undefined;
  if (end !== undefined && end >= start) return { offset: start, length: end - start + 1 };
  return { offset: start };
}

async function sendTwilioSms(env, toNumber, messageText) {
  const sid = String(env.TWILIO_ACCOUNT_SID || "").trim();
  const token = String(env.TWILIO_AUTH_TOKEN || "").trim();
  const from = String(env.TWILIO_FROM_NUMBER || "").trim();
  const to = String(toNumber || "").trim();
  const bodyText = String(messageText || "").trim();

  if (!sid) throw new Error("Missing TWILIO_ACCOUNT_SID");
  if (!token) throw new Error("Missing TWILIO_AUTH_TOKEN");
  if (!from) throw new Error("Missing TWILIO_FROM_NUMBER");
  if (!to) throw new Error("Missing destination phone number");
  if (!bodyText) throw new Error("Missing SMS message body");

  const basic = btoa(sid + ":" + token);
  const form = new URLSearchParams();
  form.set("From", from);
  form.set("To", to);
  form.set("Body", bodyText);

  const res = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + encodeURIComponent(sid) + "/Messages.json", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + basic,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}

  if (!res.ok) {
    throw new Error((data && data.message) ? data.message : ("Twilio SMS failed: HTTP " + res.status));
  }

  return data;
}

async function apiHealth(request) {
  return withCors(request, json({ ok: true, service: "saysay-platform-api" }));
}

async function apiMe(request, env) {
  const u = await getSessionUser(request, env);
  return withCors(request, json({ ok: true, user: u }));
}

async function apiLogin(request, env) {
  let body;
  try { body = await request.json(); } catch { return withCors(request, bad("Invalid JSON", 400)); }

  const handle = (body.handle || "").trim();
  const email = (body.email || "").trim();
  const invite_code = (body.invite_code || "").trim();
  if (!handle || !invite_code) return withCors(request, bad("Missing handle or invite_code", 400));

  const inv = await env.DB.prepare("SELECT code, used_by FROM invites WHERE code = ?").bind(invite_code).first();
  if (!inv) return withCors(request, bad("Invalid invite code", 403));
  if (inv.used_by) return withCors(request, bad("Invite code already used", 403));

  const userId = await sha1Hex("user:" + handle.toLowerCase());
  await env.DB.prepare(
    "INSERT INTO users (id, handle, email, role) VALUES (?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET handle=excluded.handle, email=excluded.email"
  ).bind(userId, handle, email, "creator").run();

  await env.DB.prepare("UPDATE invites SET used_by = ?, used_at = datetime('now') WHERE code = ?")
    .bind(userId, invite_code).run();

  const token = randomToken();
  const tokenHash = await sha1Hex(token);
  const sessionId = await sha1Hex("sess:" + tokenHash + ":" + Date.now());

  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+14 days'))"
  ).bind(sessionId, userId, tokenHash).run();

  const resp = json({ ok: true, user: { id: userId, handle: handle, email: email, role: "creator" } });
  const h = new Headers(resp.headers);
  h.append("Set-Cookie", setSessionCookie(token));
  return withCors(request, new Response(resp.body, { status: 200, headers: h }));
}

async function apiLogout(request, env) {
  const token = getCookie(request, "ss_session");
  if (token) {
    const tokenHash = await sha1Hex(token);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  const resp = json({ ok: true });
  const h = new Headers(resp.headers);
  h.append("Set-Cookie", clearSessionCookie());
  return withCors(request, new Response(resp.body, { status: 200, headers: h }));
}

async function apiAuthRegister(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return withCors(request, bad("Invalid JSON", 400));
  }

  const handle = String(body.handle || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const plan = String(body.plan || "free").trim().toLowerCase();

  if (!handle) return withCors(request, bad("Handle required", 400));
  if (!email) return withCors(request, bad("Email required", 400));
  if (!password) return withCors(request, bad("Password required", 400));
  if (password.length < 6) return withCors(request, bad("Password must be at least 6 characters", 400));

  const validPlan = (
    plan === "free" ||
    plan === "premium" ||
    plan === "family" ||
    plan === "school"
  ) ? plan : "free";

  const existingHandle = await env.DB.prepare(
    "SELECT id FROM users WHERE lower(handle) = lower(?)"
  ).bind(handle).first();

  if (existingHandle) {
    return withCors(request, bad("Handle already exists", 409));
  }

  const existingEmail = await env.DB.prepare(
    "SELECT id FROM users WHERE lower(email) = lower(?)"
  ).bind(email).first();

  if (existingEmail) {
    return withCors(request, bad("Email already exists", 409));
  }

  const userId = await sha1Hex("user:" + handle.toLowerCase());
  const passwordHash = await hashPassword(password);

  await env.DB.prepare(
    "INSERT INTO users (id, handle, email, role, password_hash, plan) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(
    userId,
    handle,
    email,
    "customer",
    passwordHash,
    validPlan
  ).run();

  const token = randomToken();
  const tokenHash = await sha1Hex(token);
  const sessionId = await sha1Hex("sess:" + tokenHash + ":" + Date.now());

  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+14 days'))"
  ).bind(sessionId, userId, tokenHash).run();

  const resp = json({
    ok: true,
    user: {
      id: userId,
      handle: handle,
      email: email,
      role: "customer",
      plan: validPlan
    }
  });

  const h = new Headers(resp.headers);
  h.append("Set-Cookie", setSessionCookie(token));
  return withCors(request, new Response(resp.body, { status: 200, headers: h }));
}

async function apiAuthLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return withCors(request, bad("Invalid JSON", 400));
  }

  const handle = String(body.handle || "").trim();
  const password = String(body.password || "");

  if (!handle) return withCors(request, bad("Handle required", 400));
  if (!password) return withCors(request, bad("Password required", 400));

  const user = await env.DB.prepare(
    "SELECT id, handle, email, role, password_hash, plan FROM users WHERE lower(handle) = lower(?)"
  ).bind(handle).first();

  if (!user) {
    return withCors(request, bad("Invalid handle or password", 401));
  }

  if (!user.password_hash) {
    return withCors(request, bad("This account does not support password login yet", 403));
  }

  const passwordHash = await hashPassword(password);
  if (String(user.password_hash) !== String(passwordHash)) {
    return withCors(request, bad("Invalid handle or password", 401));
  }

  const oldCookieToken = getCookie(request, "ss_session");
  if (oldCookieToken) {
    const oldHash = await sha1Hex(oldCookieToken);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(oldHash).run();
  }

  const token = randomToken();
  const tokenHash = await sha1Hex(token);
  const sessionId = await sha1Hex("sess:" + tokenHash + ":" + Date.now());

  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+14 days'))"
  ).bind(sessionId, user.id, tokenHash).run();

  const resp = json({
    ok: true,
    user: {
      id: user.id,
      handle: user.handle,
      email: user.email || null,
      role: user.role || "customer",
      plan: user.plan || "free"
    }
  });

  const h = new Headers(resp.headers);
  h.append("Set-Cookie", setSessionCookie(token));
  return withCors(request, new Response(resp.body, { status: 200, headers: h }));
}

async function apiTracks(request, env) {
  const u = new URL(request.url);

  const limit = clampInt(u.searchParams.get("limit") || "200", 200, 1, 5000);
  const cursor = parseCursorPair(u.searchParams.get("cursor") || "");

  const filters = [];
  const binds = [];


  const subject = (u.searchParams.get("subject") || "").trim();
  const genre = (u.searchParams.get("genre") || "").trim();
  const gradeLevel = (u.searchParams.get("grade_level") || u.searchParams.get("grade") || "").trim();
  const gradeGroup = (u.searchParams.get("grade_group") || "").trim();
  const albumId = (u.searchParams.get("album_id") || "").trim();
  const q = (u.searchParams.get("q") || u.searchParams.get("search") || "").trim();
  const sort = normalizeSort(u.searchParams.get("sort"), "tracks");

  const fromParts = ["tracks t"];
  let selectPlaysExpr = "0 AS plays";

  if (albumId) {
    fromParts.push("JOIN album_tracks at ON at.track_id = t.id");
    filters.push("at.album_id = ?");
    binds.push(albumId);
  }

  if (sort === "popularity") {
    const today = new Date().toISOString().slice(0, 10);
    fromParts.push("LEFT JOIN plays_daily p ON p.track_id = t.id AND p.day = ?");
    binds.push(today);
    selectPlaysExpr = "COALESCE(p.plays,0) AS plays";
  }

  appendFilterEquals(filters, binds, "t.subject", subject);
  appendFilterEquals(filters, binds, "t.genre", genre);
  appendFilterEquals(filters, binds, "t.grade_level", gradeLevel);
  appendFilterEquals(filters, binds, "t.grade_group", gradeGroup);
  appendFilterQ(filters, binds, ["t.title", "t.artist", "t.subject", "t.audio_key"], q);
  filters.push("t.status IN ('published','pending_review','draft')");
  if (sort === "newest") {
    appendCursorDesc(filters, binds, "t.created_at", "t.id", cursor);
  }

  const whereSql = filters.length ? (" WHERE " + filters.join(" AND ")) : "";
  const orderBy = buildTrackOrderBy(sort);

  const sql =
   "SELECT t.id, t.title, t.artist, t.audio_key, t.user_id, t.created_at, t.subject, t.grade_level, t.grade_group, t.genre, " + selectPlaysExpr + " " +
    "FROM " + fromParts.join(" ") +
    whereSql +
    " ORDER BY " + orderBy + " LIMIT ?";

  binds.push(limit + 1);

  const rows = await sqlBindAll(env.DB.prepare(sql), binds).all();

  let list = rows.results || [];
  const hasMore = list.length > limit;
  if (hasMore) list = list.slice(0, limit);

  const items = list.map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    audio_key: r.audio_key,
    stream_url: "/api/stream/" + encodeURIComponent(r.id),
    created_at: r.created_at,
    plays: Number(r.plays || 0),
    subject: r.subject || null,
    grade_level: r.grade_level || null,
    grade_group: r.grade_group || null,
    genre: r.genre || null,
  }));

  const nextCursor = (sort === "newest" && hasMore && list.length) ? buildNextCursorFromRow(list[list.length - 1]) : null;

  return withCors(request, json({
    ok: true,
    tracks: items,
    next_cursor: nextCursor,
    has_more: hasMore,
    filters: {
      subject: subject || null,
      grade_level: gradeLevel || null,
      grade_group: gradeGroup || null,
      q: q || null,
      sort: sort
    }
  }));
}

/* the rest of the worker remains the same as the prior full rebuild */

async function apiLibraryPrefixes(request, env) {
  const u = new URL(request.url);
  const limit = clampInt(u.searchParams.get("limit") || "100", 100, 1, 500);
  const subject = (u.searchParams.get("subject") || "").trim();
  const genre = (u.searchParams.get("genre") || "").trim();
  const gradeLevel = (u.searchParams.get("grade_level") || "").trim();
  const gradeGroup = (u.searchParams.get("grade_group") || "").trim();
  const q = (u.searchParams.get("q") || u.searchParams.get("search") || "").trim();

  const filters = [
    "audio_key IS NOT NULL",
    "audio_key != ''",
    "audio_key NOT LIKE 'http%'"
  ];
  const binds = [];

  appendFilterEquals(filters, binds, "subject", subject);
  appendFilterEquals(filters, binds, "grade_level", gradeLevel);
  appendFilterEquals(filters, binds, "grade_group", gradeGroup);
  appendFilterQ(filters, binds, ["audio_key", "title", "artist", "subject"], q);

  const sql = "SELECT audio_key FROM tracks WHERE " + filters.join(" AND ") + " LIMIT 10000";
  const rows = await sqlBindAll(env.DB.prepare(sql), binds).all();

  const map = {};
  const list = rows.results || [];
  for (let i = 0; i < list.length; i++) {
    const key = String(list[i].audio_key || "");
    if (!key) continue;
    const first = key.indexOf("/") >= 0 ? key.slice(0, key.indexOf("/")) : key;
    if (!first) continue;
    if (!map[first]) map[first] = 0;
    map[first] += 1;
  }

  const prefixes = Object.keys(map)
    .sort(function(a, b) { return map[b] - map[a]; })
    .slice(0, limit)
    .map(function(k) {
      return { prefix_1: k, track_count: map[k] };
    });

  return withCors(request, json({
    ok: true,
    prefixes: prefixes,
    filters: {
      subject: subject || null,
      grade_level: gradeLevel || null,
      grade_group: gradeGroup || null,
      q: q || null
    }
  }));
}

async function apiLibraryByPrefix(request, env) {
  const u = new URL(request.url);
  const prefix = (u.searchParams.get("prefix") || "").trim();
  if (!prefix) return withCors(request, bad("Missing prefix", 400));

  const limit = clampInt(u.searchParams.get("limit") || "100", 100, 1, 500);
  const cursor = parsePrefixCursor(u.searchParams.get("cursor") || "");
  const subject = (u.searchParams.get("subject") || "").trim();
  const gradeLevel = (u.searchParams.get("grade_level") || "").trim();
  const gradeGroup = (u.searchParams.get("grade_group") || "").trim();
  const q = (u.searchParams.get("q") || u.searchParams.get("search") || "").trim();

  const filters = [
    "audio_key LIKE ?",
    "audio_key NOT LIKE 'http%'"
  ];
  const binds = [prefix + "/%"];

  appendFilterEquals(filters, binds, "subject", subject);
  appendFilterEquals(filters, binds, "grade_level", gradeLevel);
  appendFilterEquals(filters, binds, "grade_group", gradeGroup);
  appendFilterQ(filters, binds, ["audio_key", "title", "artist", "subject"], q);
  appendCursorDesc(filters, binds, "created_at", "id", cursor);

  const sql =
    "SELECT id, title, artist, audio_key, created_at, subject, grade_level, grade_group " +
    "FROM tracks " +
    "WHERE " + filters.join(" AND ") + " " +
    "ORDER BY created_at DESC, id DESC " +
    "LIMIT ?";

  binds.push(limit + 1);

  const rows = await sqlBindAll(env.DB.prepare(sql), binds).all();

  let list = rows.results || [];
  const hasMore = list.length > limit;
  if (hasMore) list = list.slice(0, limit);

  const items = list.map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    audio_key: r.audio_key,
    stream_url: "/api/stream/" + encodeURIComponent(r.id),
    created_at: r.created_at,
    subject: r.subject || null,
    grade_level: r.grade_level || null,
    grade_group: r.grade_group || null,
  }));

  const nextCursor = hasMore && list.length ? buildNextCursorFromRow(list[list.length - 1]) : null;

  return withCors(request, json({
    ok: true,
    prefix: prefix,
    tracks: items,
    next_cursor: nextCursor,
    has_more: hasMore,
    filters: {
      subject: subject || null,
      grade_level: gradeLevel || null,
      grade_group: gradeGroup || null,
      q: q || null
    }
  }));
}

async function apiLibrarySummary(request, env) {
  const u = new URL(request.url);
  const subject = (u.searchParams.get("subject") || "").trim();
  const gradeLevel = (u.searchParams.get("grade_level") || "").trim();
  const gradeGroup = (u.searchParams.get("grade_group") || "").trim();
  const q = (u.searchParams.get("q") || u.searchParams.get("search") || "").trim();

  const trackFilters = [];
  const trackBinds = [];
  appendFilterEquals(trackFilters, trackBinds, "subject", subject);
  appendFilterEquals(trackFilters, trackBinds, "grade_level", gradeLevel);
  appendFilterEquals(trackFilters, trackBinds, "grade_group", gradeGroup);
  appendFilterQ(trackFilters, trackBinds, ["title", "artist", "subject", "audio_key"], q);
  const trackWhere = trackFilters.length ? (" WHERE " + trackFilters.join(" AND ")) : "";

  const albumFilters = [];
  const albumBinds = [];
  appendFilterEquals(albumFilters, albumBinds, "subject", subject);
  appendFilterEquals(albumFilters, albumBinds, "grade_level", gradeLevel);
  appendFilterEquals(albumFilters, albumBinds, "grade_group", gradeGroup);
  appendFilterQ(albumFilters, albumBinds, ["title", "artist", "subject", "cover_key"], q);
  const albumWhere = albumFilters.length ? (" WHERE " + albumFilters.join(" AND ")) : "";

  const totalTracksStmt = env.DB.prepare("SELECT COUNT(*) AS c FROM tracks" + trackWhere);
  const totalAlbumsStmt = env.DB.prepare("SELECT COUNT(*) AS c FROM albums" + albumWhere);
  const topSubjectsStmt = env.DB.prepare(
    "SELECT subject, COUNT(*) AS c FROM tracks" +
    trackWhere +
    (trackWhere ? " AND " : " WHERE ") +
    "subject IS NOT NULL AND subject != '' GROUP BY subject ORDER BY c DESC, subject ASC LIMIT 25"
  );
  const topGradeLevelsStmt = env.DB.prepare(
    "SELECT grade_level, COUNT(*) AS c FROM tracks" +
    trackWhere +
    (trackWhere ? " AND " : " WHERE ") +
    "grade_level IS NOT NULL AND grade_level != '' GROUP BY grade_level ORDER BY c DESC, grade_level ASC LIMIT 25"
  );
  const topGradeGroupsStmt = env.DB.prepare(
    "SELECT grade_group, COUNT(*) AS c FROM tracks" +
    trackWhere +
    (trackWhere ? " AND " : " WHERE ") +
    "grade_group IS NOT NULL AND grade_group != '' GROUP BY grade_group ORDER BY c DESC, grade_group ASC LIMIT 25"
  );
  const usersStmt = env.DB.prepare("SELECT COUNT(*) AS c FROM users");
  const todayStmt = env.DB.prepare("SELECT COALESCE(SUM(plays),0) AS c FROM plays_daily WHERE day = ?");

  const totalTracks = await sqlBindAll(totalTracksStmt, trackBinds).first();
  const totalAlbums = await sqlBindAll(totalAlbumsStmt, albumBinds).first();
  const topSubjects = await sqlBindAll(topSubjectsStmt, trackBinds).all();
  const topGradeLevels = await sqlBindAll(topGradeLevelsStmt, trackBinds).all();
  const topGradeGroups = await sqlBindAll(topGradeGroupsStmt, trackBinds).all();
  const users = await usersStmt.first();
  const today = await todayStmt.bind(new Date().toISOString().slice(0, 10)).first();

  const bySubject = (topSubjects.results || []).map(function(r) {
    return { subject: r.subject, count: Number(r.c || 0) };
  });
  const byGradeLevel = (topGradeLevels.results || []).map(function(r) {
    return { grade_level: r.grade_level, count: Number(r.c || 0) };
  });
  const byGradeGroup = (topGradeGroups.results || []).map(function(r) {
    return { grade_group: r.grade_group, count: Number(r.c || 0) };
  });

  return withCors(request, json({
    ok: true,
    filters: {
      subject: subject || null,
      grade_level: gradeLevel || null,
      grade_group: gradeGroup || null,
      q: q || null
    },
    totals: {
      albums: totalAlbums && totalAlbums.c ? Number(totalAlbums.c) : 0,
      tracks: totalTracks && totalTracks.c ? Number(totalTracks.c) : 0
    },
    albums: totalAlbums && totalAlbums.c ? Number(totalAlbums.c) : 0,
    tracks: totalTracks && totalTracks.c ? Number(totalTracks.c) : 0,
    total_albums: totalAlbums && totalAlbums.c ? Number(totalAlbums.c) : 0,
    total_tracks: totalTracks && totalTracks.c ? Number(totalTracks.c) : 0,
    users: users && users.c ? Number(users.c) : 0,
    today_plays: today && today.c ? Number(today.c) : 0,
    by_subject: bySubject,
    by_grade_level: byGradeLevel,
    by_grade_group: byGradeGroup,
    subjects: bySubject.map(function(x) { return x.subject; }),
    subject_counts: bySubject.reduce(function(acc, row) {
      acc[row.subject] = row.count;
      return acc;
    }, {})
  }));
}

async function apiTrending(request, env) {
  const day = new Date().toISOString().slice(0, 10);
  const top = await env.DB.prepare(
    "SELECT p.track_id AS id, p.plays AS plays FROM plays_daily p WHERE p.day = ? ORDER BY p.plays DESC LIMIT 50"
  ).bind(day).all();

  if (top.results && top.results.length) {
    const ids = top.results.map((x) => x.id);
    const q = "SELECT id, title, artist, audio_key, created_at, subject, grade_level, grade_group FROM tracks WHERE id IN (" + ids.map(() => "?").join(",") + ")";
    const rows = await env.DB.prepare(q).bind(...ids).all();
    const map = {};
    (rows.results || []).forEach((r) => { map[r.id] = r; });

    const items = top.results.map((t) => {
      const r = map[t.id];
      if (!r) return null;
      return {
        id: r.id,
        title: r.title,
        artist: r.artist,
        audio_key: r.audio_key,
        stream_url: "/api/stream/" + encodeURIComponent(r.id),
        plays: t.plays,
        subject: r.subject || null,
        grade_level: r.grade_level || null,
        grade_group: r.grade_group || null,
      };
    }).filter(Boolean);

    return withCors(request, json({ ok: true, tracks: items, day: day }));
  }

  return apiTracks(request, env);
}

async function apiPlay(request, env) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const track_id = (body.track_id || "").trim();
  if (!track_id) return withCors(request, bad("Missing track_id", 400));

  const day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    "INSERT INTO plays_daily (day, track_id, plays) VALUES (?, ?, 1) " +
    "ON CONFLICT(day, track_id) DO UPDATE SET plays = plays + 1"
  ).bind(day, track_id).run();

  return withCors(request, json({ ok: true }));
}

async function apiLike(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return withCors(request, bad("Not logged in", 401));

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const track_id = (body.track_id || "").trim();
  const liked = !!body.liked;
  if (!track_id) return withCors(request, bad("Missing track_id", 400));

  if (liked) {
    await env.DB.prepare(
      "INSERT INTO likes (user_id, track_id) VALUES (?, ?) ON CONFLICT(user_id, track_id) DO NOTHING"
    ).bind(user.id, track_id).run();
  } else {
    await env.DB.prepare("DELETE FROM likes WHERE user_id = ? AND track_id = ?")
      .bind(user.id, track_id).run();
  }

  return withCors(request, json({ ok: true, liked: liked }));
}

async function apiMyLikes(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return withCors(request, bad("Not logged in", 401));

  const rows = await env.DB.prepare(
    "SELECT t.id, t.title, t.artist, t.audio_key, t.created_at, t.subject, t.grade_level, t.grade_group " +
    "FROM likes l JOIN tracks t ON t.id = l.track_id " +
    "WHERE l.user_id = ? ORDER BY l.created_at DESC LIMIT 300"
  ).bind(user.id).all();

  const items = (rows.results || []).map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    audio_key: r.audio_key,
    stream_url: "/api/stream/" + encodeURIComponent(r.id),
    created_at: r.created_at,
    subject: r.subject || null,
    grade_level: r.grade_level || null,
    grade_group: r.grade_group || null,
  }));

  return withCors(request, json({ ok: true, tracks: items }));
}

async function apiMyAlbums(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return withCors(request, bad("Not logged in", 401));

  const u = new URL(request.url);

  const limit = clampInt(u.searchParams.get("limit") || "200", 200, 1, 500);
  const cursor = parseCursorPair(u.searchParams.get("cursor") || "");

  const role = String(user.role || "").toLowerCase();
  const isAdmin = role === "admin";

  const filters = [];
  const binds = [];

  if (!isAdmin) {
    filters.push("a.user_id = ?");
    binds.push(user.id);
  }

  const subject = (u.searchParams.get("subject") || "").trim();
  const gradeLevel = (u.searchParams.get("grade_level") || u.searchParams.get("grade") || "").trim();
  const gradeGroup = (u.searchParams.get("grade_group") || "").trim();
  const status = (u.searchParams.get("status") || "").trim();
  const artist = (u.searchParams.get("artist") || "").trim();
  const q = (u.searchParams.get("q") || u.searchParams.get("search") || "").trim();
  const sort = normalizeSort(u.searchParams.get("sort"), "albums");

  appendFilterEquals(filters, binds, "a.subject", subject);
  appendFilterEquals(filters, binds, "a.grade_level", gradeLevel);
  appendFilterEquals(filters, binds, "a.grade_group", gradeGroup);
  appendFilterEquals(filters, binds, "a.status", status);
  appendFilterEquals(filters, binds, "a.artist", artist);
  appendFilterQ(filters, binds, ["a.title", "a.artist", "a.subject", "a.cover_key"], q);

  if (sort === "newest") {
    appendCursorDesc(filters, binds, "a.created_at", "a.id", cursor);
  }

  const whereSql = filters.length ? (" WHERE " + filters.join(" AND ")) : "";
  const orderBy = buildAlbumOrderBy(sort);

  const sql =
    "SELECT a.id, a.title, a.artist, a.cover_key, a.created_at, a.subject, a.grade_level, a.grade_group, a.status, a.user_id " +
    "FROM albums a " +
    whereSql +
    " ORDER BY " + orderBy + " LIMIT ?";

  binds.push(limit + 1);

  const rows = await sqlBindAll(env.DB.prepare(sql), binds).all();

  let list = rows.results || [];
  const hasMore = list.length > limit;
  if (hasMore) list = list.slice(0, limit);

  const items = list.map((a) => ({
    id: a.id,
    title: a.title,
    artist: a.artist,
    cover_key: a.cover_key,
    cover_url: a.cover_key ? buildPublicAudioUrl(a.cover_key) : null,
    created_at: a.created_at,
    subject: a.subject || null,
    grade_level: a.grade_level || null,
    grade_group: a.grade_group || null,
    status: a.status || "draft",
    user_id: a.user_id || null
  }));

  const nextCursor = (sort === "newest" && hasMore && list.length)
    ? buildNextCursorFromRow(list[list.length - 1])
    : null;

  return withCors(request, json({
    ok: true,
    albums: items,
    next_cursor: nextCursor,
    has_more: hasMore,
    scope: isAdmin ? "admin_all" : "owner_only",
    filters: {
      subject: subject || null,
      grade_level: gradeLevel || null,
      grade_group: gradeGroup || null,
      status: status || null,
      artist: artist || null,
      q: q || null,
      sort: sort
    }
  }));
}

async function apiMyTracks(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return withCors(request, bad("Not logged in", 401));

  const u = new URL(request.url);

  const limit = clampInt(u.searchParams.get("limit") || "500", 500, 1, 1000);
  const subject = (u.searchParams.get("subject") || "").trim();
  const gradeLevel = (u.searchParams.get("grade_level") || u.searchParams.get("grade") || "").trim();
  const gradeGroup = (u.searchParams.get("grade_group") || "").trim();
  const status = (u.searchParams.get("status") || "").trim();
  const albumId = (u.searchParams.get("album_id") || "").trim();
  const artist = (u.searchParams.get("artist") || "").trim();
  const q = (u.searchParams.get("q") || u.searchParams.get("search") || "").trim();
  const sort = normalizeSort(u.searchParams.get("sort"), "tracks");

  const role = String(user.role || "").toLowerCase();
  const isAdmin = role === "admin";

  const filters = [];
  const binds = [];

  if (!isAdmin) {
    filters.push("(" +
      "t.user_id = ? " +
      "OR at.album_id IN (SELECT id FROM albums WHERE user_id = ?)" +
    ")");
    binds.push(user.id, user.id);
  }

  const fromParts = [
    "tracks t",
    "LEFT JOIN album_tracks at ON at.track_id = t.id",
    "LEFT JOIN albums a ON a.id = at.album_id"
  ];

  let selectPlaysExpr = "0 AS plays";

  const genre = (u.searchParams.get("genre") || "").trim();

  if (albumId) {
    filters.push("at.album_id = ?");
    binds.push(albumId);
  }

  if (sort === "popularity") {
    const today = new Date().toISOString().slice(0, 10);
    fromParts.push("LEFT JOIN plays_daily p ON p.track_id = t.id AND p.day = ?");
    binds.push(today);
    selectPlaysExpr = "COALESCE(p.plays,0) AS plays";
  }

  appendFilterEquals(filters, binds, "t.subject", subject);
  appendFilterEquals(filters, binds, "t.genre", genre);
  appendFilterEquals(filters, binds, "t.grade_level", gradeLevel);
  appendFilterEquals(filters, binds, "t.grade_group", gradeGroup);
  appendFilterEquals(filters, binds, "t.status", status);
  appendFilterEquals(filters, binds, "t.artist", artist);
  appendFilterQ(filters, binds, ["t.title", "t.artist", "t.subject", "t.audio_key"], q);

  const whereSql = filters.length ? (" WHERE " + filters.join(" AND ")) : "";
  const orderBy = buildTrackOrderBy(sort);

  const sql =
    "SELECT " +
    "t.id, t.title, t.artist, t.audio_key, t.user_id, t.created_at, " +
    "t.subject, t.grade_level, t.grade_group, t.status, " +
    "at.album_id AS album_id, a.title AS album_title, " +
    selectPlaysExpr + " " +
    "FROM " + fromParts.join(" ") +
    whereSql +
    " ORDER BY " + orderBy + " LIMIT ?";

  binds.push(limit * 3);

  const rows = await sqlBindAll(env.DB.prepare(sql), binds).all();
  const rawList = rows.results || [];

  const deduped = [];
  const seen = {};

  for (let i = 0; i < rawList.length; i++) {
    const r = rawList[i];
    if (seen[r.id]) continue;
    seen[r.id] = true;
    deduped.push(r);
    if (deduped.length >= limit) break;
  }

  const items = deduped.map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    audio_key: r.audio_key,
    stream_url: "/api/stream/" + encodeURIComponent(r.id),
    created_at: r.created_at,
    plays: Number(r.plays || 0),
    subject: r.subject || null,
    grade_level: r.grade_level || null,
    grade_group: r.grade_group || null,
    status: r.status || "draft",
    album_id: r.album_id || null,
    album_title: r.album_title || null,
    user_id: r.user_id || null
  }));

  return withCors(request, json({
    ok: true,
    tracks: items,
    next_cursor: null,
    has_more: false,
    scope: isAdmin ? "admin_all" : "owner_only",
    filters: {
      subject: subject || null,
      grade_level: gradeLevel || null,
      grade_group: gradeGroup || null,
      status: status || null,
      album_id: albumId || null,
      artist: artist || null,
      q: q || null,
      sort: sort
    }
  }));
}

async function apiStream(request, env, trackId) {
  const user = await getSessionUser(request, env);
  const row = await env.DB.prepare("SELECT id, audio_key FROM tracks WHERE id = ?").bind(trackId).first();
  if (!row || !row.audio_key) return withCors(request, bad("Track not found", 404));

  const key = row.audio_key;
  const range = request.headers.get("Range");
  if (user && !hasUnlimitedAccess(user) && Number(user.daily_seconds_used || 0) >= 3600) {
    return withCors(request, bad("Daily limit reached", 403));
  }
  const obj = await env.AUDIO_USER.get(key, { range: range ? parseRangeHeader(range) : undefined });
  if (!obj) return withCors(request, bad("Audio missing in R2: " + key, 404));

const headers = new Headers();
  headers.set("Content-Type", guessAudioContentType(key));
  headers.set("Accept-Ranges", "bytes");

  if (obj.range) {
    headers.set("Content-Range", "bytes " + obj.range.offset + "-" + (obj.range.offset + obj.range.length - 1) + "/" + obj.size);
    headers.set("Content-Length", String(obj.range.length));
    return withCors(request, new Response(obj.body, { status: 206, headers: headers }));
  } else {
    headers.set("Content-Length", String(obj.size));
    return withCors(request, new Response(obj.body, { status: 200, headers: headers }));
  }
}

async function apiAlbums(request, env) {
  const u = new URL(request.url);

  const limit = clampInt(u.searchParams.get("limit") || "200", 200, 1, 500);
  const cursor = parseCursorPair(u.searchParams.get("cursor") || "");

  const filters = [];
  const binds = [];
        filters.push("a.status = 'published'");
  const subject = (u.searchParams.get("subject") || "").trim();
  const genre = (u.searchParams.get("genre") || "").trim();
  const gradeLevel = (u.searchParams.get("grade_level") || u.searchParams.get("grade") || "").trim();
  const gradeGroup = (u.searchParams.get("grade_group") || "").trim();
  const q = (u.searchParams.get("q") || u.searchParams.get("search") || "").trim();
  const sort = normalizeSort(u.searchParams.get("sort"), "albums");

  appendFilterEquals(filters, binds, "a.subject", subject);
  appendFilterEquals(filters, binds, "a.grade_level", gradeLevel);
  appendFilterEquals(filters, binds, "a.grade_group", gradeGroup);
  appendFilterQ(filters, binds, ["a.title", "a.artist", "a.subject", "a.cover_key"], q);

  if (sort === "newest") {
    appendCursorDesc(filters, binds, "a.created_at", "a.id", cursor);
  }

  const whereSql = filters.length ? (" WHERE " + filters.join(" AND ")) : "";
  const orderBy = buildAlbumOrderBy(sort);

const sql =
  "SELECT a.id, a.title, a.artist, a.cover_key, a.created_at, a.subject, a.grade_level, a.grade_group, a.status " +
  "FROM albums a " +
  whereSql +
  " ORDER BY " + orderBy + " LIMIT ?";

  binds.push(limit + 1);

  const rows = await sqlBindAll(env.DB.prepare(sql), binds).all();

  let list = rows.results || [];
  const hasMore = list.length > limit;
  if (hasMore) list = list.slice(0, limit);

  const items = list.map((a) => ({
    id: a.id,
    title: a.title,
    artist: a.artist,
    cover_key: a.cover_key,
    cover_url: a.cover_key ? buildPublicAudioUrl(a.cover_key) : null,
    created_at: a.created_at,
    subject: a.subject || null,
    grade_level: a.grade_level || null,
    grade_group: a.grade_group || null,
  }));

  const nextCursor = (sort === "newest" && hasMore && list.length) ? buildNextCursorFromRow(list[list.length - 1]) : null;

  return withCors(request, json({
    ok: true,
    albums: items,
    next_cursor: nextCursor,
    has_more: hasMore,
    filters: {
      subject: subject || null,
      grade_level: gradeLevel || null,
      grade_group: gradeGroup || null,
      q: q || null,
      sort: sort
    }
  }));
}

async function apiAlbumById(request, env, albumId) {
  const album = await env.DB.prepare(
      "SELECT id, title, artist, cover_key, created_at, subject, grade_level, grade_group FROM albums WHERE id = ? AND (status IS NULL OR (status != 'archived' AND status != 'pending_review'))"
  ).bind(albumId).first();
  if (!album) return withCors(request, bad("Album not found", 404));

  const rows = await env.DB.prepare(
    "SELECT t.id, t.title, t.artist, t.audio_key, at.track_index AS track_index, t.subject, t.grade_level, t.grade_group " +
    "FROM album_tracks at JOIN tracks t ON t.id = at.track_id " +
    "WHERE at.album_id = ? " +
    "ORDER BY at.track_index ASC, t.title ASC"
  ).bind(albumId).all();

  const tracks = (rows.results || []).map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    audio_key: r.audio_key,
    track_index: r.track_index,
    stream_url: "/api/stream/" + encodeURIComponent(r.id),
    subject: r.subject || null,
    grade_level: r.grade_level || null,
    grade_group: r.grade_group || null,
  }));

  return withCors(request, json({
    ok: true,
    album: {
      id: album.id,
      title: album.title,
      artist: album.artist,
      cover_key: album.cover_key,
      cover_url: album.cover_key ? buildPublicAudioUrl(album.cover_key) : null,
      created_at: album.created_at,
      subject: album.subject || null,
      grade_level: album.grade_level || null,
      grade_group: album.grade_group || null,
    },
    tracks: tracks,
  }));
}

async function apiAdminInvite(request, env) {
  const isAdmin = await requireAdmin(request, env);
  if (!isAdmin) return withCors(request, bad("Admin only", 403));

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const note = (body.note || "").trim();
  const code = (body.code || "").trim() || randomToken().slice(0, 10);

  await env.DB.prepare(
    "INSERT INTO invites (code, note) VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET note=excluded.note"
  ).bind(code, note).run();

  return withCors(request, json({ ok: true, code: code }));
}

async function apiAdminR2Peek(request, env) {
  const isAdmin = await requireAdmin(request, env);
  if (!isAdmin) return withCors(request, bad("Admin only", 403));

  const u = new URL(request.url);
  const prefix = (u.searchParams.get("prefix") || "").trim();
  const limit = clampInt(u.searchParams.get("limit") || "50", 50, 1, 1000);
  const cursor = (u.searchParams.get("cursor") || "").trim();
  const kind = String(u.searchParams.get("kind") || "all").trim().toLowerCase();
  const groupBy = String(u.searchParams.get("group_by") || "").trim().toLowerCase();

  const res = await r2ListAll(env, prefix || undefined, limit, cursor || undefined);
  const objects = res.objects || [];

  const filtered = [];
  const folderMap = {};

  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    if (!o || !o.key) continue;
    if (!passesKindFilter(o.key, kind)) continue;

    filtered.push({
      key: o.key,
      size: o.size,
      uploaded: o.uploaded ? String(o.uploaded) : null,
      etag: o.etag || null,
      kind: isAudioKey(o.key) ? "audio" : (isImageKey(o.key) ? "image" : "other"),
      folder: dirname(o.key)
    });

    const d = dirname(o.key);
    if (!folderMap[d]) {
      folderMap[d] = {
        folder: d,
        audio_count: 0,
        image_count: 0,
        other_count: 0,
        sample_cover_key: null
      };
    }
    if (isAudioKey(o.key)) folderMap[d].audio_count += 1;
    else if (isImageKey(o.key)) {
      folderMap[d].image_count += 1;
      if (!folderMap[d].sample_cover_key) folderMap[d].sample_cover_key = o.key;
    } else folderMap[d].other_count += 1;
  }

  const folders = Object.keys(folderMap).sort().map(function(k) { return folderMap[k]; });

  return withCors(request, json({
    ok: true,
    prefix: prefix || "",
    limit: limit,
    cursor: res.cursor || null,
    truncated: !!res.truncated,
    kind: kind,
    group_by: groupBy || null,
    objects: groupBy === "folder" ? [] : filtered,
    folders: groupBy === "folder" ? folders : []
  }));
}

async function apiAdminCatalogCheck(request, env) {
  const isAdmin = await requireAdmin(request, env);
  if (!isAdmin) return withCors(request, bad("Admin only", 403));

  const u = new URL(request.url);
  const limit = clampInt(u.searchParams.get("limit") || "25", 25, 1, 200);

  const totalAlbums = await env.DB.prepare("SELECT COUNT(*) AS c FROM albums").first();
  const totalTracks = await env.DB.prepare("SELECT COUNT(*) AS c FROM tracks").first();

  const albumsMissingCover = await env.DB.prepare(
    "SELECT id, title, artist, subject, grade_level, grade_group " +
    "FROM albums " +
    "WHERE cover_key IS NULL OR cover_key = '' " +
    "ORDER BY created_at DESC, id DESC LIMIT ?"
  ).bind(limit).all();

  const albumsMissingCoverCount = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM albums WHERE cover_key IS NULL OR cover_key = ''"
  ).first();

  const albumsZeroTracks = await env.DB.prepare(
    "SELECT a.id, a.title, a.artist, a.subject, a.grade_level, a.grade_group " +
    "FROM albums a " +
    "LEFT JOIN album_tracks at ON at.album_id = a.id " +
    "WHERE at.track_id IS NULL " +
    "ORDER BY a.created_at DESC, a.id DESC LIMIT ?"
  ).bind(limit).all();

  const albumsZeroTracksCount = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM albums a LEFT JOIN album_tracks at ON at.album_id = a.id WHERE at.track_id IS NULL"
  ).first();

  const tracksMissingAlbumLink = await env.DB.prepare(
    "SELECT t.id, t.title, t.artist, t.audio_key, t.subject, t.grade_level, t.grade_group " +
    "FROM tracks t " +
    "LEFT JOIN album_tracks at ON at.track_id = t.id " +
    "WHERE at.album_id IS NULL " +
    "ORDER BY t.created_at DESC, t.id DESC LIMIT ?"
  ).bind(limit).all();

  const tracksMissingAlbumLinkCount = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM tracks t LEFT JOIN album_tracks at ON at.track_id = t.id WHERE at.album_id IS NULL"
  ).first();

  const tracksMissingSubjectCount = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM tracks WHERE subject IS NULL OR subject = ''"
  ).first();

  const tracksMissingGradeLevelCount = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM tracks WHERE grade_level IS NULL OR grade_level = ''"
  ).first();

  const albumsBySubject = await env.DB.prepare(
    "SELECT subject, COUNT(*) AS c FROM albums WHERE subject IS NOT NULL AND subject != '' GROUP BY subject ORDER BY c DESC, subject ASC LIMIT 25"
  ).all();

  return withCors(request, json({
    ok: true,
    totals: {
      albums: totalAlbums && totalAlbums.c ? Number(totalAlbums.c) : 0,
      tracks: totalTracks && totalTracks.c ? Number(totalTracks.c) : 0
    },
    health: {
      albums_missing_cover_count: albumsMissingCoverCount && albumsMissingCoverCount.c ? Number(albumsMissingCoverCount.c) : 0,
      albums_zero_tracks_count: albumsZeroTracksCount && albumsZeroTracksCount.c ? Number(albumsZeroTracksCount.c) : 0,
      tracks_missing_album_link_count: tracksMissingAlbumLinkCount && tracksMissingAlbumLinkCount.c ? Number(tracksMissingAlbumLinkCount.c) : 0,
      tracks_missing_subject_count: tracksMissingSubjectCount && tracksMissingSubjectCount.c ? Number(tracksMissingSubjectCount.c) : 0,
      tracks_missing_grade_level_count: tracksMissingGradeLevelCount && tracksMissingGradeLevelCount.c ? Number(tracksMissingGradeLevelCount.c) : 0
    },
    preview: {
      albums_missing_cover: (albumsMissingCover.results || []),
      albums_zero_tracks: (albumsZeroTracks.results || []),
      tracks_missing_album_link: (tracksMissingAlbumLink.results || [])
    },
    by_subject: (albumsBySubject.results || []).map(function(r) {
      return { subject: r.subject, albums: Number(r.c || 0) };
    })
  }));
}

/* Remaining admin endpoints preserved exactly as prior version */

async function apiAdminTrackAudit(request, env) {
  const isAdmin = await requireAdmin(request, env);
  if (!isAdmin) return withCors(request, bad("Admin only", 403));

  const url = new URL(request.url);
  const trackId = normalizeTrackId({}, url);
  if (!trackId) return withCors(request, bad("track_id required", 400));

  const track = await getTrackById(env, trackId);
  if (!track) return withCors(request, bad("Track not found", 404));

  const linkedAlbums = await env.DB.prepare(
    "SELECT a.id, a.title, a.artist, a.cover_key, at.track_index " +
    "FROM album_tracks at JOIN albums a ON a.id = at.album_id " +
    "WHERE at.track_id = ? " +
    "ORDER BY at.track_index ASC, a.title ASC"
  ).bind(trackId).all();

  const audioExists = track.audio_key ? await r2ObjectExists(env, track.audio_key) : false;
  const folder = track.audio_key ? dirname(track.audio_key) : "";
  const file = track.audio_key ? basename(track.audio_key) : "";
  const inferred = deriveCatalogInfo(track.audio_key || "");

  return withCors(request, json({
    ok: true,
    track: {
      id: track.id,
      title: track.title,
      artist: track.artist,
      audio_key: track.audio_key,
      audio_url: track.audio_key ? buildPublicAudioUrl(track.audio_key) : null,
      audio_exists_in_r2: audioExists,
      folder: folder,
      filename: file,
      subject: track.subject || null,
      grade_level: track.grade_level || null,
      grade_group: track.grade_group || null,
      inferred_subject: inferred.subject || null,
      inferred_grade_level: inferred.grade_level || null,
      inferred_grade_group: inferred.grade_group || null,
      created_at: track.created_at
    },
    linked_albums: linkedAlbums.results || []
  }));
}

async function apiAdminUpdateTrackMeta(request, env) {
  const isAdmin = await requireAdmin(request, env);
  if (!isAdmin) return withCors(request, bad("Admin only", 403));
  if (request.method !== "POST") return withCors(request, bad("POST required", 405));

  let body = {};
  try { body = await request.json(); } catch {}

  const trackId = firstNonEmpty(body.track_id, body.trackId);
  if (!trackId) return withCors(request, bad("track_id required", 400));

  const existing = await getTrackById(env, trackId);
  if (!existing) return withCors(request, bad("Track not found", 404));

  const nextTitle = body.title !== undefined ? String(body.title || "").trim() : existing.title;
  const nextArtist = body.artist !== undefined ? String(body.artist || "").trim() : existing.artist;
  const nextAudioKey = body.audio_key !== undefined ? String(body.audio_key || "").trim() : existing.audio_key;
  const nextSubject = body.subject !== undefined ? String(body.subject || "").trim() : existing.subject;
  const nextGradeLevel = body.grade_level !== undefined ? String(body.grade_level || "").trim() : existing.grade_level;
  const nextGradeGroup = body.grade_group !== undefined ? String(body.grade_group || "").trim() : existing.grade_group;

  await env.DB.prepare(
    "UPDATE tracks SET title = ?, artist = ?, audio_key = ?, subject = ?, grade_level = ?, grade_group = ? WHERE id = ?"
  ).bind(
    nextTitle || null,
    nextArtist || null,
    nextAudioKey || null,
    nextSubject || null,
    nextGradeLevel || null,
    nextGradeGroup || null,
    trackId
  ).run();

  const updated = await getTrackById(env, trackId);

  return withCors(request, json({ ok: true, track: updated }));
}

async function apiAdminUpdateAlbumMeta(request, env) {
  const isAdmin = await requireAdmin(request, env);
  if (!isAdmin) return withCors(request, bad("Admin only", 403));
  if (request.method !== "POST") return withCors(request, bad("POST required", 405));

  let body = {};
  try { body = await request.json(); } catch {}

  let albumId = firstNonEmpty(body.album_id, body.albumId);
  const albumPath = normalizeAlbumPath(firstNonEmpty(body.album, body.album_path, body.prefix));
  if (!albumId && albumPath) {
    albumId = await sha1Hex("album:" + albumPath);
  }
  if (!albumId) return withCors(request, bad("album_id or album required", 400));

  const existing = await getAlbumById(env, albumId);
  if (!existing) return withCors(request, bad("Album not found", 404));

  const nextTitle = body.title !== undefined ? String(body.title || "").trim() : existing.title;
  const nextArtist = body.artist !== undefined ? String(body.artist || "").trim() : existing.artist;
  const nextCoverKey = body.cover_key !== undefined ? String(body.cover_key || "").trim() : existing.cover_key;
  const nextSubject = body.subject !== undefined ? String(body.subject || "").trim() : existing.subject;
  const nextGradeLevel = body.grade_level !== undefined ? String(body.grade_level || "").trim() : existing.grade_level;
  const nextGradeGroup = body.grade_group !== undefined ? String(body.grade_group || "").trim() : existing.grade_group;

  await env.DB.prepare(
    "UPDATE albums SET title = ?, artist = ?, cover_key = ?, subject = ?, grade_level = ?, grade_group = ? WHERE id = ?"
  ).bind(
    nextTitle || null,
    nextArtist || null,
    nextCoverKey || null,
    nextSubject || null,
    nextGradeLevel || null,
    nextGradeGroup || null,
    albumId
  ).run();

  const updated = await getAlbumById(env, albumId);

  return withCors(request, json({
    ok: true,
    album: {
      id: updated.id,
      title: updated.title,
      artist: updated.artist,
      cover_key: updated.cover_key,
      cover_url: updated.cover_key ? buildPublicAudioUrl(updated.cover_key) : null,
      subject: updated.subject || null,
      grade_level: updated.grade_level || null,
      grade_group: updated.grade_group || null,
      created_at: updated.created_at
    }
  }));
}

async function apiAdminCorrectMetadataByPrefix(request, env) {
  const isAdmin = await requireAdmin(request, env);
  if (!isAdmin) return withCors(request, bad("Admin only", 403));
  if (request.method !== "POST") return withCors(request, bad("POST required", 405));

  let body = {};
  try { body = await request.json(); } catch {}

  const prefix = normalizeAlbumPath(firstNonEmpty(body.prefix, body.album, body.album_path));
  if (!prefix) return withCors(request, bad("prefix required", 400));

  const nextSubject = body.subject !== undefined ? String(body.subject || "").trim() : null;
  const nextGradeLevel = body.grade_level !== undefined ? String(body.grade_level || "").trim() : null;
  const nextGradeGroup = body.grade_group !== undefined ? String(body.grade_group || "").trim() : null;
  const dryRun = body.dry_run === undefined ? true : isTruthyFlag(body.dry_run);
  const inferMissing = isTruthyFlag(body.infer_missing);

  const like = prefix + "/%";

  const tracks = await env.DB.prepare(
    "SELECT id, title, audio_key, subject, grade_level, grade_group FROM tracks WHERE audio_key LIKE ? ORDER BY created_at DESC LIMIT 5000"
  ).bind(like).all();

  const albums = await env.DB.prepare(
    "SELECT id, title, cover_key, subject, grade_level, grade_group FROM albums WHERE id IN (" +
    "SELECT DISTINCT at.album_id FROM album_tracks at JOIN tracks t ON t.id = at.track_id WHERE t.audio_key LIKE ?" +
    ") ORDER BY created_at DESC LIMIT 2000"
  ).bind(like).all();

  const trackPreview = (tracks.results || []).slice(0, 50).map(function(t) {
    const inf = deriveCatalogInfo(t.audio_key || "");
    return {
      ...t,
      inferred_subject: inf.subject || null,
      inferred_grade_level: inf.grade_level || null,
      inferred_grade_group: inf.grade_group || null
    };
  });

  if (dryRun) {
    return withCors(request, json({
      ok: true,
      dry_run: true,
      prefix: prefix,
      changes: {
        subject: nextSubject,
        grade_level: nextGradeLevel,
        grade_group: nextGradeGroup,
        infer_missing: inferMissing
      },
      match_counts: {
        tracks: (tracks.results || []).length,
        albums: (albums.results || []).length
      },
      preview: {
        tracks: trackPreview,
        albums: (albums.results || []).slice(0, 50)
      }
    }));
  }

  if (nextSubject !== null) {
    await env.DB.prepare("UPDATE tracks SET subject = ? WHERE audio_key LIKE ?").bind(nextSubject || null, like).run();
    await env.DB.prepare(
      "UPDATE albums SET subject = ? WHERE id IN (" +
      "SELECT DISTINCT at.album_id FROM album_tracks at JOIN tracks t ON t.id = at.track_id WHERE t.audio_key LIKE ?" +
      ")"
    ).bind(nextSubject || null, like).run();
  }

  if (nextGradeLevel !== null) {
    await env.DB.prepare("UPDATE tracks SET grade_level = ? WHERE audio_key LIKE ?").bind(nextGradeLevel || null, like).run();
    await env.DB.prepare(
      "UPDATE albums SET grade_level = ? WHERE id IN (" +
      "SELECT DISTINCT at.album_id FROM album_tracks at JOIN tracks t ON t.id = at.track_id WHERE t.audio_key LIKE ?" +
      ")"
    ).bind(nextGradeLevel || null, like).run();
  }

  if (nextGradeGroup !== null) {
    await env.DB.prepare("UPDATE tracks SET grade_group = ? WHERE audio_key LIKE ?").bind(nextGradeGroup || null, like).run();
    await env.DB.prepare(
      "UPDATE albums SET grade_group = ? WHERE id IN (" +
      "SELECT DISTINCT at.album_id FROM album_tracks at JOIN tracks t ON t.id = at.track_id WHERE t.audio_key LIKE ?" +
      ")"
    ).bind(nextGradeGroup || null, like).run();
  }

  if (inferMissing) {
    const list = tracks.results || [];
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      const inf = deriveCatalogInfo(t.audio_key || "");
      const finalSubject = (t.subject || nextSubject || "").trim() || (inf.subject || null);
      const finalGradeLevel = (t.grade_level || nextGradeLevel || "").trim() || (inf.grade_level || null);
      const finalGradeGroup = (t.grade_group || nextGradeGroup || "").trim() || (inf.grade_group || null);

      await env.DB.prepare(
        "UPDATE tracks SET subject = ?, grade_level = ?, grade_group = ? WHERE id = ?"
      ).bind(
        finalSubject || null,
        finalGradeLevel || null,
        finalGradeGroup || null,
        t.id
      ).run();
    }
  }

  return withCors(request, json({
    ok: true,
    dry_run: false,
    prefix: prefix,
    updated: {
      tracks: (tracks.results || []).length,
      albums: (albums.results || []).length
    },
    changes: {
      subject: nextSubject,
      grade_level: nextGradeLevel,
      grade_group: nextGradeGroup,
      infer_missing: inferMissing
    }
  }));
}

async function apiAdminRemoveTrackCatalog(request, env) {
  const isAdmin = await requireAdmin(request, env);
  if (!isAdmin) return withCors(request, bad("Admin only", 403));
  if (request.method !== "POST") return withCors(request, bad("POST required", 405));

  let body = {};
  try { body = await request.json(); } catch {}

  const trackId = firstNonEmpty(body.track_id, body.trackId);
  if (!trackId) return withCors(request, bad("track_id required", 400));

  const dryRun = body.dry_run === undefined ? true : isTruthyFlag(body.dry_run);
  const deleteTrackRow = isTruthyFlag(body.delete_track_row);
  const unlinkFromAlbums = body.unlink_from_albums === undefined ? true : isTruthyFlag(body.unlink_from_albums);

  const track = await getTrackById(env, trackId);
  if (!track) return withCors(request, bad("Track not found", 404));

  const links = await env.DB.prepare(
    "SELECT album_id, track_index FROM album_tracks WHERE track_id = ? ORDER BY track_index ASC"
  ).bind(trackId).all();

  if (dryRun) {
    return withCors(request, json({
      ok: true,
      dry_run: true,
      track: track,
      plan: {
        unlink_album_links: unlinkFromAlbums ? (links.results || []).length : 0,
        delete_track_row: deleteTrackRow
      },
      linked_albums: links.results || [],
      note: "No R2 object will be deleted by this endpoint."
    }));
  }

  if (unlinkFromAlbums) {
    await env.DB.prepare("DELETE FROM album_tracks WHERE track_id = ?").bind(trackId).run();
  }
  if (deleteTrackRow) {
    await env.DB.prepare("DELETE FROM likes WHERE track_id = ?").bind(trackId).run();
    await env.DB.prepare("DELETE FROM plays_daily WHERE track_id = ?").bind(trackId).run();
    await env.DB.prepare("DELETE FROM tracks WHERE id = ?").bind(trackId).run();
  }

  return withCors(request, json({
    ok: true,
    dry_run: false,
    removed: {
      unlinked_album_links: unlinkFromAlbums ? (links.results || []).length : 0,
      deleted_track_row: deleteTrackRow
    },
    note: "R2 audio was not deleted."
  }));
}

async function apiAdminRemoveAlbumLinks(request, env) {
  const isAdmin = await requireAdmin(request, env);
  if (!isAdmin) return withCors(request, bad("Admin only", 403));
  if (request.method !== "POST") return withCors(request, bad("POST required", 405));

  let body = {};
  try { body = await request.json(); } catch {}

  let albumId = firstNonEmpty(body.album_id, body.albumId);
  const albumPath = normalizeAlbumPath(firstNonEmpty(body.album, body.album_path, body.prefix));
  if (!albumId && albumPath) albumId = await sha1Hex("album:" + albumPath);
  if (!albumId) return withCors(request, bad("album_id or album required", 400));

  const dryRun = body.dry_run === undefined ? true : isTruthyFlag(body.dry_run);
  const clearCover = isTruthyFlag(body.clear_cover);
  const deleteAlbumRow = isTruthyFlag(body.delete_album_row);

  const album = await getAlbumById(env, albumId);
  if (!album) return withCors(request, bad("Album not found", 404));

  const links = await env.DB.prepare(
    "SELECT track_id, track_index FROM album_tracks WHERE album_id = ? ORDER BY track_index ASC"
  ).bind(albumId).all();

  if (dryRun) {
    return withCors(request, json({
      ok: true,
      dry_run: true,
      album: {
        id: album.id,
        title: album.title,
        cover_key: album.cover_key,
        linked_tracks: (links.results || []).length
      },
      plan: {
        remove_album_tracks: (links.results || []).length,
        clear_cover: clearCover,
        delete_album_row: deleteAlbumRow
      },
      note: "R2 objects will not be deleted by this endpoint."
    }));
  }

  await env.DB.prepare("DELETE FROM album_tracks WHERE album_id = ?").bind(albumId).run();
  if (clearCover) {
    await env.DB.prepare("UPDATE albums SET cover_key = NULL WHERE id = ?").bind(albumId).run();
  }
  if (deleteAlbumRow) {
    await env.DB.prepare("DELETE FROM albums WHERE id = ?").bind(albumId).run();
  }

  return withCors(request, json({
    ok: true,
    dry_run: false,
    removed: {
      album_track_links: (links.results || []).length,
      cleared_cover: clearCover,
      deleted_album_row: deleteAlbumRow
    },
    note: "R2 audio and cover objects were not deleted."
  }));
}

async function apiAdminArchiveAlbum(request, env) {
  try {
    const auth = await requireAdminOrCreator(request, env);
    if (!auth.ok) return withCors(request, bad(auth.error, auth.status));
    if (request.method !== "POST") return withCors(request, bad("POST required", 405));

    let body = {};
    try { body = await request.json(); } catch {}

    let albumId = firstNonEmpty(body.album_id, body.albumId).trim();
    const albumPath = normalizeAlbumPath(firstNonEmpty(body.album, body.album_path, body.prefix));

    if (!albumId && albumPath) {
      albumId = await sha1Hex("album:" + albumPath);
    }
    if (!albumId) return withCors(request, bad("album_id or album required", 400));

    const album = await env.DB.prepare(
      "SELECT id, title, user_id, status, subject, grade_level, grade_group FROM albums WHERE id = ?"
    ).bind(albumId).first();

    if (!album) return withCors(request, bad("Album not found", 404));

    const role = String((auth.user && auth.user.role) || "").toLowerCase();
    const isAdmin = role === "admin" || auth.via === "header_admin";

    if (!isAdmin) {
      if (!auth.user || !album.user_id || String(album.user_id) !== String(auth.user.id)) {
        return withCors(request, bad("You can only archive your own albums", 403));
      }
    }

    const linkedRow = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM album_tracks WHERE album_id = ?"
    ).bind(albumId).first();

    const linkedTracks = Number(linkedRow && linkedRow.c ? linkedRow.c : 0);
    const dryRun = body.dry_run === undefined ? true : isTruthyFlag(body.dry_run);

    if (dryRun) {
      return withCors(request, json({
        ok: true,
        dry_run: true,
        album: {
          id: album.id,
          title: album.title,
          user_id: album.user_id || null,
          current_status: album.status || "draft",
          subject: album.subject || null,
          grade_level: album.grade_level || null,
          grade_group: album.grade_group || null
        },
        plan: {
          next_album_status: "archived",
          linked_tracks: linkedTracks
        }
      }));
    }

    await env.DB.prepare(
      "UPDATE albums SET status = 'archived' WHERE id = ?"
    ).bind(albumId).run();

    return withCors(request, json({
      ok: true,
      dry_run: false,
      archived: {
        album_id: album.id,
        title: album.title,
        previous_status: album.status || "draft",
        album_status: "archived",
        linked_tracks: linkedTracks
      }
    }));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiAdminUnarchiveAlbum(request, env) {
  try {
    const auth = await requireAdminOrCreator(request, env);
    if (!auth.ok) return withCors(request, bad(auth.error, auth.status));
    if (request.method !== "POST") return withCors(request, bad("POST required", 405));

    let body = {};
    try { body = await request.json(); } catch {}

    let albumId = firstNonEmpty(body.album_id, body.albumId).trim();
    const albumPath = normalizeAlbumPath(firstNonEmpty(body.album, body.album_path, body.prefix));

    if (!albumId && albumPath) {
      albumId = await sha1Hex("album:" + albumPath);
    }
    if (!albumId) return withCors(request, bad("album_id or album required", 400));

    const album = await env.DB.prepare(
      "SELECT id, title, user_id, status, subject, grade_level, grade_group FROM albums WHERE id = ?"
    ).bind(albumId).first();

    if (!album) return withCors(request, bad("Album not found", 404));

    const role = String((auth.user && auth.user.role) || "").toLowerCase();
    const isAdmin = role === "admin" || auth.via === "header_admin";

    if (!isAdmin) {
      if (!auth.user || !album.user_id || String(album.user_id) !== String(auth.user.id)) {
        return withCors(request, bad("You can only unarchive your own albums", 403));
      }
    }

    const linkedRow = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM album_tracks WHERE album_id = ?"
    ).bind(albumId).first();

    const linkedTracks = Number(linkedRow && linkedRow.c ? linkedRow.c : 0);
    const dryRun = body.dry_run === undefined ? true : isTruthyFlag(body.dry_run);

    if (dryRun) {
      return withCors(request, json({
        ok: true,
        dry_run: true,
        album: {
          id: album.id,
          title: album.title,
          user_id: album.user_id || null,
          current_status: album.status || "draft",
          subject: album.subject || null,
          grade_level: album.grade_level || null,
          grade_group: album.grade_group || null
        },
        plan: {
          next_album_status: "published",
          linked_tracks: linkedTracks
        }
      }));
    }

    await env.DB.prepare(
      "UPDATE albums SET status IN ('published','pending','draft') WHERE id = ?"
    ).bind(albumId).run();

    return withCors(request, json({
      ok: true,
      dry_run: false,
      unarchived: {
        album_id: album.id,
        title: album.title,
        previous_status: album.status || "draft",
        album_status: "draft",
        linked_tracks: linkedTracks
      }
    }));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiAdminPublishAlbum(request, env) {
  try {
    const auth = await requireAdminOrCreator(request, env);
    if (!auth.ok) return withCors(request, bad(auth.error, auth.status));
    if (request.method !== "POST") return withCors(request, bad("POST required", 405));

    let body = {};
    try { body = await request.json(); } catch {}

    let albumId = firstNonEmpty(body.album_id, body.albumId).trim();
    const albumPath = normalizeAlbumPath(firstNonEmpty(body.album, body.album_path, body.prefix));

    if (!albumId && albumPath) {
      albumId = await sha1Hex("album:" + albumPath);
    }
    if (!albumId) return withCors(request, bad("album_id or album required", 400));

    const album = await env.DB.prepare(
      "SELECT id, title, user_id, status, subject, grade_level, grade_group FROM albums WHERE id = ?"
    ).bind(albumId).first();

    if (!album) return withCors(request, bad("Album not found", 404));

    const role = String((auth.user && auth.user.role) || "").toLowerCase();
        const isAdmin = role === "admin" || auth.via === "header_admin";

    if (!isAdmin) {
      if (!auth.user || !album.user_id || String(album.user_id) !== String(auth.user.id)) {
        return withCors(request, bad("You can only publish your own albums", 403));
      }
    }

    const linkedRow = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM album_tracks WHERE album_id = ?"
    ).bind(albumId).first();

    const linkedTracks = Number(linkedRow && linkedRow.c ? linkedRow.c : 0);
    const dryRun = body.dry_run === undefined ? true : isTruthyFlag(body.dry_run);

    if (dryRun) {
      return withCors(request, json({
        ok: true,
        dry_run: true,
        album: {
          id: album.id,
          title: album.title,
          user_id: album.user_id || null,
          current_status: album.status || "draft",
          subject: album.subject || null,
          grade_level: album.grade_level || null,
          grade_group: album.grade_group || null
        },
        plan: {
          next_album_status: "published",
          next_track_status: "published",
          linked_tracks: linkedTracks
        }
      }));
    }

    await env.DB.prepare(
      "UPDATE albums SET status = 'published' WHERE id = ?"
    ).bind(albumId).run();

    await env.DB.prepare(
      "UPDATE tracks SET status = 'published' WHERE id IN (" +
      "SELECT track_id FROM album_tracks WHERE album_id = ?" +
      ")"
    ).bind(albumId).run();

    return withCors(request, json({
      ok: true,
      dry_run: false,
      published: {
        album_id: album.id,
        title: album.title,
        album_status: "published",
        tracks_updated: linkedTracks,
        track_status: "published"
      }
    }));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiCreatorSubmitAlbum(request, env) {
  try {
    const auth = await requireAdminOrCreator(request, env);
    if (!auth.ok) return withCors(request, bad(auth.error || "auth failed", 401));
    if (request.method !== "POST") return withCors(request, bad("POST required", 405));

    let body = {};
    try { body = await request.json(); } catch {}

    const albumId = firstNonEmpty(body.albumId, body.album_id, body.id);
    if (!albumId) return withCors(request, bad("albumId required", 400));

    const album = await env.DB.prepare(
      "SELECT id, title, artist, user_id, status, subject, grade_level, grade_group FROM albums WHERE id = ?"
    ).bind(albumId).first();

    if (!album) return withCors(request, bad("Album not found", 404));

    const role = String((auth.user && auth.user.role) || "").toLowerCase();
    const isAdmin = role === "admin" || auth.via === "header_admin";

    if (!isAdmin) {
      const ownsByUserId = !!(auth.user && album.user_id && String(album.user_id) === String(auth.user.id));
      const ownsByArtist = !!(auth.user && album.artist && String(album.artist).trim().toLowerCase() === String(auth.user.handle || "").trim().toLowerCase());
      if (!ownsByUserId && !ownsByArtist) {
        return withCors(request, bad("You can only submit your own album", 403));
      }
    }

    const currentStatus = String(album.status || "").toLowerCase();
    if (currentStatus !== "draft") {
      return withCors(request, bad("Only draft albums can be submitted for review", 400));
    }

    await env.DB.prepare(
      "UPDATE albums SET status = ? WHERE id = ?"
    ).bind("pending_review", albumId).run();

    return withCors(request, json({
      ok: true,
      submitted: {
        album_id: album.id,
        title: album.title,
        previous_status: album.status || "draft",
        new_status: "pending_review"
      }
    }));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiAdminMaintenancePreview(request, env) {
  const isAdmin = await requireAdmin(request, env);
  if (!isAdmin) return withCors(request, bad("Admin only", 403));

  const url = new URL(request.url);
  let body = {};
  if (request.method === "POST") {
    try { body = await request.json(); } catch {}
  }

  const prefix = normalizeAlbumPath(firstNonEmpty(body.prefix, url.searchParams.get("prefix")));
  const albumPath = normalizeAlbumPath(firstNonEmpty(
    body.album, body.album_path, body.prefix, body.albumId, body.album_id,
    url.searchParams.get("album"), url.searchParams.get("album_path"),
    url.searchParams.get("albumId"), url.searchParams.get("album_id")
  ));

  if (!prefix && !albumPath) {
    return withCors(request, bad("prefix or album required", 400));
  }

  if (albumPath) {
    const safeAlbumPath = normalizeAlbumPath(albumPath);
    const albumId = await sha1Hex("album:" + safeAlbumPath);
    const album = await getAlbumById(env, albumId);
    const folderRes = await listAlbumFolderObjects(env, safeAlbumPath, 2000);
    const folderObjects = folderRes.objects || [];

    const audioFound = [];
    const imageFound = [];
    for (let i = 0; i < folderObjects.length; i++) {
      const k = folderObjects[i] && folderObjects[i].key ? folderObjects[i].key : "";
      if (isAudioKey(k)) audioFound.push(k);
      if (isImageKey(k)) imageFound.push(k);
    }

    const linked = await env.DB.prepare(
      "SELECT t.id, t.title, t.audio_key, at.track_index " +
      "FROM album_tracks at JOIN tracks t ON t.id = at.track_id WHERE at.album_id = ? " +
      "ORDER BY at.track_index ASC"
    ).bind(albumId).all();

    const inferred = deriveCatalogInfo(safeAlbumPath);

    return withCors(request, json({
      ok: true,
      mode: "album",
      album: {
        path: safeAlbumPath,
        id: albumId,
        exists_in_db: !!album,
        title: album ? album.title : null,
        cover_key: album ? album.cover_key : null,
        cover_url: album && album.cover_key ? buildPublicAudioUrl(album.cover_key) : null,
        inferred_subject: inferred.subject || null,
        inferred_grade_level: inferred.grade_level || null,
        inferred_grade_group: inferred.grade_group || null
      },
      scan: {
        audio_found: audioFound.length,
        images_found: imageFound.length,
        best_cover_candidate: pickCoverKey(imageFound)
      },
      catalog: {
        linked_tracks: (linked.results || []).length
      },
      suggested_actions: [
        "rebuild-album-cover",
        "relink-album-tracks",
        "update-album-meta",
        "remove-album-links (dry-run first)"
      ]
    }));
  }

  const like = prefix + "/%";
  const trackRows = await env.DB.prepare(
    "SELECT id, title, audio_key, subject, grade_level, grade_group FROM tracks WHERE audio_key LIKE ? ORDER BY created_at DESC LIMIT 5000"
  ).bind(like).all();

  const linkedAlbumRows = await env.DB.prepare(
    "SELECT DISTINCT a.id, a.title, a.subject, a.grade_level, a.grade_group FROM albums a " +
    "JOIN album_tracks at ON at.album_id = a.id " +
    "JOIN tracks t ON t.id = at.track_id " +
    "WHERE t.audio_key LIKE ? ORDER BY a.title ASC LIMIT 2000"
  ).bind(like).all();

  return withCors(request, json({
    ok: true,
    mode: "prefix",
    prefix: prefix,
    match_counts: {
      tracks: (trackRows.results || []).length,
      albums: (linkedAlbumRows.results || []).length
    },
    suggested_actions: [
      "correct-metadata-by-prefix (dry-run first)",
      "catalog-check",
      "track-audit",
      "update-track-meta",
      "update-album-meta"
    ],
    preview: {
      tracks: (trackRows.results || []).slice(0, 50),
      albums: (linkedAlbumRows.results || []).slice(0, 50)
    }
  }));
}

async function apiAdminBypassLogin(request, env) {
  try {
    const u = new URL(request.url);

    let body = {};
    if (request.method === "POST") {
      try { body = await request.json(); } catch {}
    }

    const token = firstNonEmpty(
      getAdminToken(request),
      body.token,
      u.searchParams.get("token")
    );

    if (!token || !env.ADMIN_BYPASS_TOKEN || token !== env.ADMIN_BYPASS_TOKEN) {
      return withCors(request, json({ ok: false, error: "Admin only" }, 403));
    }

    const handle = firstNonEmpty(body.handle, u.searchParams.get("handle"), "saysay");
    const email = firstNonEmpty(body.email, u.searchParams.get("email"), "admin@saysaymusic.com");
    if (!handle) return withCors(request, bad("Handle required", 400));

    const oldCookieToken = getCookie(request, "ss_session");
    if (oldCookieToken) {
      const oldHash = await sha1Hex(oldCookieToken);
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(oldHash).run();
    }

    let userId = await sha1Hex("user:" + handle.toLowerCase());

    await env.DB.prepare(
      "INSERT INTO users (id, handle, email, role) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT(handle) DO UPDATE SET " +
      "email = COALESCE(excluded.email, users.email), " +
      "role = 'admin'"
    ).bind(userId, handle, email || null, "admin").run();

    const urow = await env.DB.prepare(
      "SELECT id, handle, email, role FROM users WHERE handle = ?"
    ).bind(handle).first();

    if (urow && urow.id) userId = urow.id;

    await env.DB.prepare(
      "UPDATE users SET role = 'admin', email = COALESCE(?, email) WHERE id = ?"
    ).bind(email || null, userId).run();

    const sessionToken = randomToken();
    const tokenHash = await sha1Hex(sessionToken);
    const sessionId = await sha1Hex("sess:" + tokenHash + ":" + Date.now());

    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+14 days'))"
    ).bind(sessionId, userId, tokenHash).run();

    const resp = json({
      ok: true,
      user: {
        id: userId,
        handle: handle,
        email: email || null,
        role: "admin"
      }
    }, 200);

    const h = new Headers(resp.headers);
    h.append("Set-Cookie", setSessionCookie(sessionToken));
    return withCors(request, new Response(resp.body, { status: 200, headers: h }));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}
async function apiPrivateOwnerLogin(request, env) {
  try {
    const u = new URL(request.url);

    let body = {};
    if (request.method === "POST") {
      try { body = await request.json(); } catch {}
    }

    const token = firstNonEmpty(
      body.token,
      u.searchParams.get("token")
    );

    if (!token || !env.OWNER_LOGIN_TOKEN || token !== env.OWNER_LOGIN_TOKEN) {
      return withCors(request, json({ ok: false, error: "Owner only" }, 403));
    }

    const handle = "saysay";
    const email = "admin@saysaymusic.com";
    let userId = await sha1Hex("user:" + handle.toLowerCase());

    await env.DB.prepare(
      "INSERT INTO users (id, handle, email, role) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT(handle) DO UPDATE SET " +
      "email = COALESCE(excluded.email, users.email), " +
      "role = 'admin'"
    ).bind(userId, handle, email, "admin").run();

    const urow = await env.DB.prepare(
      "SELECT id, handle, email, role FROM users WHERE handle = ?"
    ).bind(handle).first();

    if (urow && urow.id) userId = urow.id;

    await env.DB.prepare(
      "UPDATE users SET role = 'admin', email = COALESCE(?, email) WHERE id = ?"
    ).bind(email, userId).run();

    const oldCookieToken = getCookie(request, "ss_session");
    if (oldCookieToken) {
      const oldHash = await sha1Hex(oldCookieToken);
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(oldHash).run();
    }

    const sessionToken = randomToken();
    const tokenHash = await sha1Hex(sessionToken);
    const sessionId = await sha1Hex("sess:" + tokenHash + ":" + Date.now());

    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+14 days'))"
    ).bind(sessionId, userId, tokenHash).run();

    const resp = json({
      ok: true,
      user: {
        id: userId,
        handle: handle,
        email: email,
        role: "admin"
      }
    }, 200);

    const h = new Headers(resp.headers);
    h.append("Set-Cookie", setSessionCookie(sessionToken));
    return withCors(request, new Response(resp.body, { status: 200, headers: h }));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiPrivateCreateCreatorAccount(request, env) {
  try {
    let body = {};
    if (request.method === "POST") {
      try { body = await request.json(); } catch {}
    }

    const token = firstNonEmpty(body.token);
    if (!token || !env.OWNER_LOGIN_TOKEN || token !== env.OWNER_LOGIN_TOKEN) {
      return withCors(request, json({ ok: false, error: "Owner only" }, 403));
    }

    const handle = firstNonEmpty(body.handle).trim();
    const email = firstNonEmpty(body.email).trim().toLowerCase();
    const password = String(body.password || "");
    const role = firstNonEmpty(body.role, "creator").trim().toLowerCase();

    if (!handle) return withCors(request, bad("Handle required", 400));
    if (!email) return withCors(request, bad("Email required", 400));
    if (!password) return withCors(request, bad("Password required", 400));
    if (password.length < 6) return withCors(request, bad("Password must be at least 6 characters", 400));

    const finalRole = (role === "admin") ? "admin" : "creator";
    const userId = await sha1Hex("user:" + handle.toLowerCase());
    const passwordHash = await hashPassword(password);

    await env.DB.prepare(
      "INSERT INTO users (id, handle, email, role, password_hash, plan) VALUES (?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET " +
      "handle = excluded.handle, " +
      "email = excluded.email, " +
      "role = excluded.role, " +
      "password_hash = excluded.password_hash"
    ).bind(
      userId,
      handle,
      email,
      finalRole,
      passwordHash,
      "free"
    ).run();

    const user = await env.DB.prepare(
      "SELECT id, handle, email, role, plan FROM users WHERE id = ?"
    ).bind(userId).first();

    return withCors(request, json({
      ok: true,
      user: {
        id: user.id,
        handle: user.handle,
        email: user.email,
        role: user.role,
        plan: user.plan || "free"
      }
    }, 200));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiPrivateTransferOwnership(request, env) {
  try {
    let body = {};
    if (request.method === "POST") {
      try { body = await request.json(); } catch {}
    }

    const token = firstNonEmpty(body.token);
    if (!token || !env.OWNER_LOGIN_TOKEN || token !== env.OWNER_LOGIN_TOKEN) {
      return withCors(request, json({ ok: false, error: "Owner only" }, 403));
    }

    const fromHandle = firstNonEmpty(body.from_handle).trim();
    const toHandle = firstNonEmpty(body.to_handle).trim();

    if (!fromHandle) return withCors(request, bad("from_handle required", 400));
    if (!toHandle) return withCors(request, bad("to_handle required", 400));

    const fromUser = await env.DB.prepare(
      "SELECT id, handle, email, role FROM users WHERE lower(handle) = lower(?)"
    ).bind(fromHandle).first();

    if (!fromUser) return withCors(request, bad("Source user not found", 404));

    const toUser = await env.DB.prepare(
      "SELECT id, handle, email, role FROM users WHERE lower(handle) = lower(?)"
    ).bind(toHandle).first();

    if (!toUser) return withCors(request, bad("Target user not found", 404));

    const beforeAlbumsRow = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM albums WHERE user_id = ?"
    ).bind(fromUser.id).first();

    const beforeTracksRow = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM tracks WHERE user_id = ?"
    ).bind(fromUser.id).first();

    await env.DB.prepare(
      "UPDATE albums SET user_id = ? WHERE user_id = ?"
    ).bind(toUser.id, fromUser.id).run();

    await env.DB.prepare(
      "UPDATE tracks SET user_id = ? WHERE user_id = ?"
    ).bind(toUser.id, fromUser.id).run();

    const afterAlbumsRow = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM albums WHERE user_id = ?"
    ).bind(toUser.id).first();

    const afterTracksRow = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM tracks WHERE user_id = ?"
    ).bind(toUser.id).first();

    return withCors(request, json({
      ok: true,
      transferred: {
        from_handle: fromUser.handle,
        from_user_id: fromUser.id,
        to_handle: toUser.handle,
        to_user_id: toUser.id,
        albums_moved: Number(beforeAlbumsRow && beforeAlbumsRow.c ? beforeAlbumsRow.c : 0),
        tracks_moved: Number(beforeTracksRow && beforeTracksRow.c ? beforeTracksRow.c : 0)
      },
      target_totals: {
        albums: Number(afterAlbumsRow && afterAlbumsRow.c ? afterAlbumsRow.c : 0),
        tracks: Number(afterTracksRow && afterTracksRow.c ? afterTracksRow.c : 0)
      }
    }, 200));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiBillingPremiumCheckout(request, env) {
  try {
    const user = await getSessionUser(request, env);
    if (!user) return withCors(request, bad("Login required", 401));

    const STRIPE_SECRET = env.STRIPE_SECRET_KEY;

    const params = new URLSearchParams();
    params.append("mode", "subscription");
  params.append("line_items[0][price]", "price_1TDCUVBhXVrt7Js9P3HnOFt4");
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", "https://app.saysaymusic.com/?checkout=success&session_id={CHECKOUT_SESSION_ID}");
    params.append("cancel_url", "https://app.saysaymusic.com/?checkout=cancel");

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + STRIPE_SECRET,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

const data = await res.json();

if (!res.ok) {
  return withCors(request, new Response(JSON.stringify({
    ok: false,
    error: (data && data.error && data.error.message) ? data.error.message : "Stripe checkout failed"
  }), {
    status: res.status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  }));
}

if (!data || !data.url) {
  return withCors(request, new Response(JSON.stringify({
    ok: false,
    error: JSON.stringify(data)
  }), {
    status: 500,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  }));
}

return withCors(request, json({
  ok: true,
  url: data.url
}));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e.message) }, 500));
  }
}

async function apiBillingArtistCheckout(request, env) {
  try {
    const user = await getSessionUser(request, env);
    if (!user) return withCors(request, bad("Login required", 401));

    const STRIPE_SECRET = env.STRIPE_SECRET_KEY;

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("line_items[0][price]", "price_1TDCUWBhXVrt7Js907VnLUed");
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", "https://app.saysaymusic.com/?checkout=success&session_id={CHECKOUT_SESSION_ID}");
    params.append("cancel_url", "https://app.saysaymusic.com/?checkout=cancel");

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + STRIPE_SECRET,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

const data = await res.json();

if (!res.ok) {
  return withCors(request, new Response(JSON.stringify({
    ok: false,
    error: (data && data.error && data.error.message) ? data.error.message : "Stripe checkout failed"
  }), {
    status: res.status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  }));
}

if (!data || !data.url) {
  return withCors(request, new Response(JSON.stringify({
    ok: false,
    error: JSON.stringify(data)
  }), {
    status: 500,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  }));
}

return withCors(request, json({
  ok: true,
  url: data.url
}));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e.message) }, 500));
  }
}

async function apiBillingConfirmCheckout(request, env) {
  try {
    const user = await getSessionUser(request, env);
    if (!user) return withCors(request, bad("Login required", 401));

    const u = new URL(request.url);
    const sessionId = String(u.searchParams.get("session_id") || "").trim();
    if (!sessionId) return withCors(request, bad("Missing session_id", 400));

    const STRIPE_SECRET = env.STRIPE_SECRET_KEY;
    if (!STRIPE_SECRET) return withCors(request, bad("Missing STRIPE_SECRET_KEY", 500));

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(sessionId), {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + STRIPE_SECRET
      }
    });

    const session = await res.json();
    const stripeCustomerId = String((session && session.customer) || "").trim();
    if (!res.ok) {
      return withCors(request, json({
        ok: false,
        error: (session && session.error && session.error.message) ? session.error.message : "Stripe session lookup failed"
      }, 500));
    }

    if (!session || session.payment_status !== "paid") {
      return withCors(request, bad("Checkout not paid", 400));
    }

    let nextPlan = "free";
    let nextRole = user.role || "customer";

    const subRes = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(sessionId) + "/line_items", {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + STRIPE_SECRET
      }
    });

    const lineItems = await subRes.json();
    if (!subRes.ok) {
      return withCors(request, json({
        ok: false,
        error: (lineItems && lineItems.error && lineItems.error.message) ? lineItems.error.message : "Stripe line items lookup failed"
      }, 500));
    }

const items = (lineItems && lineItems.data) ? lineItems.data : [];
for (let i = 0; i < items.length; i++) {
  const priceId = String((((items[i] || {}).price || {}).id) || "");
  if (priceId === "price_1TDCUVBhXVrt7Js9P3HnOFt4") {
    nextPlan = "premium";
  }
  if (priceId === "price_1TDCUWBhXVrt7Js907VnLUed") {
    nextPlan = "artist";
    nextRole = "artist";
  }
}

await env.DB.prepare(
  "UPDATE users SET plan = ?, role = ?, stripe_customer_id = ? WHERE id = ?"
).bind(
  nextPlan,
  nextRole,
  stripeCustomerId,
  user.id
).run();

    return withCors(request, json({
      ok: true,
      plan: nextPlan,
      role: nextRole
    }));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiBillingPortal(request, env) {
  try {
    const user = await getSessionUser(request, env);
    if (!user) return withCors(request, bad("Login required", 401));

    const STRIPE_SECRET = env.STRIPE_SECRET_KEY;
    if (!STRIPE_SECRET) return withCors(request, bad("Missing STRIPE_SECRET_KEY", 500));

    const customerEmail = String(user.email || "").trim().toLowerCase();
    if (!customerEmail) return withCors(request, bad("No email found on account", 400));

    const customerRes = await fetch(
      "https://api.stripe.com/v1/customers?email=" + encodeURIComponent(customerEmail) + "&limit=1",
      {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + STRIPE_SECRET
        }
      }
    );

    const customerData = await customerRes.json();
    if (!customerRes.ok) {
      return withCors(request, json({
        ok: false,
        error: (customerData && customerData.error && customerData.error.message)
          ? customerData.error.message
          : "Stripe customer lookup failed"
      }, 500));
    }

    const customer = (customerData && customerData.data && customerData.data[0]) ? customerData.data[0] : null;
    if (!customer || !customer.id) {
      return withCors(request, bad("No Stripe customer found for this account", 404));
    }

    const origin = new URL(request.url).origin;

    const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + STRIPE_SECRET,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "customer=" + encodeURIComponent(customer.id) +
            "&return_url=" + encodeURIComponent(origin + "/")
    });

    const portalData = await portalRes.json();
    if (!portalRes.ok) {
      return withCors(request, json({
        ok: false,
        error: (portalData && portalData.error && portalData.error.message)
          ? portalData.error.message
          : "Stripe billing portal creation failed"
      }, 500));
    }

    return withCors(request, json({
      ok: true,
      url: portalData.url
    }));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiArtistApply(request, env) {
  try {
    if (request.method !== "POST") return withCors(request, bad("POST required", 405));

    let body = {};
    try { body = await request.json(); } catch {}

    const name = String(body.name || "").trim();
    const artistName = String(body.artist_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const message = String(body.message || "").trim();

    if (!name) return withCors(request, bad("Name required", 400));
    if (!artistName) return withCors(request, bad("Artist name required", 400));
    if (!email) return withCors(request, bad("Email required", 400));

    const applicationId = await sha1Hex(
      "artist_application:" + email + ":" + artistName + ":" + Date.now()
    );

    await env.DB.prepare(
      "INSERT INTO artist_applications (id, name, artist_name, email, phone, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      applicationId,
      name,
      artistName,
      email,
      phone || null,
      message || null,
      "pending"
    ).run();

    return withCors(request, json({
      ok: true,
      application: {
        id: applicationId,
        name: name,
        artist_name: artistName,
        email: email,
        phone: phone || null,
        message: message || null,
        status: "pending"
      }
    }, 200));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiAdminArtistApplications(request, env) {
  try {
    const isAdmin = await requireAdmin(request, env);
    if (!isAdmin) return withCors(request, bad("Admin only", 403));

    const u = new URL(request.url);
    const limit = clampInt(u.searchParams.get("limit") || "100", 100, 1, 500);
    const status = String(u.searchParams.get("status") || "").trim().toLowerCase();
    const q = String(u.searchParams.get("q") || u.searchParams.get("search") || "").trim();

    const filters = [];
    const binds = [];

    if (status) {
      filters.push("status = ?");
      binds.push(status);
    }

    if (q) {
      const like = "%" + q + "%";
      filters.push("(name LIKE ? OR artist_name LIKE ? OR email LIKE ? OR phone LIKE ? OR message LIKE ?)");
      binds.push(like, like, like, like, like);
    }

    const whereSql = filters.length ? (" WHERE " + filters.join(" AND ")) : "";
    const sql =
      "SELECT id, name, artist_name, email, phone, message, status, created_at " +
      "FROM artist_applications" +
      whereSql +
      " ORDER BY datetime(created_at) DESC, id DESC LIMIT ?";

    binds.push(limit);

    const rows = await sqlBindAll(env.DB.prepare(sql), binds).all();

    return withCors(request, json({
      ok: true,
      applications: (rows.results || []).map(function(r) {
        return {
          id: r.id,
          name: r.name || "",
          artist_name: r.artist_name || "",
          email: r.email || "",
          phone: r.phone || "",
          message: r.message || "",
          status: r.status || "pending",
          created_at: r.created_at || null
        };
      }),
      filters: {
        status: status || null,
        q: q || null,
        limit: limit
      }
    }, 200));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiAdminArtistApplicationDecision(request, env) {
  try {
    const isAdmin = await requireAdmin(request, env);
    if (!isAdmin) return withCors(request, bad("Admin only", 403));
    if (request.method !== "POST") return withCors(request, bad("POST required", 405));

    let body = {};
    try { body = await request.json(); } catch {}

    const applicationId = String(body.id || "").trim();
    const action = String(body.action || "").trim().toLowerCase();

    if (!applicationId) return withCors(request, bad("Application id required", 400));
    if (action !== "approve" && action !== "reject") {
      return withCors(request, bad("Action must be approve or reject", 400));
    }

    const existing = await env.DB.prepare(
      "SELECT id, name, artist_name, email, phone, message, status, created_at FROM artist_applications WHERE id = ?"
    ).bind(applicationId).first();

    if (!existing) return withCors(request, bad("Application not found", 404));

    const nextStatus = action === "approve" ? "approved" : "rejected";
    let creatorUser = null;
    let creatorAction = null;
    let tempPassword = null;
    let smsResult = null;

    if (action === "approve") {
      const email = String(existing.email || "").trim().toLowerCase();
      const artistName = String(existing.artist_name || "").trim();
      const fallbackName = String(existing.name || "").trim();

      if (!email) {
        return withCors(request, bad("Approved application is missing email", 400));
      }

      var baseHandle = String(artistName || fallbackName || email.split("@")[0] || "creator")
        .replace(/[^a-zA-Z0-9_]/g, "")
        .trim();

      if (!baseHandle) baseHandle = "creator";

      let chosenHandle = baseHandle;
      let suffix = 2;

      const existingByEmail = await env.DB.prepare(
        "SELECT id, handle, email, role, plan FROM users WHERE lower(email) = lower(?) LIMIT 1"
      ).bind(email).first();

      if (existingByEmail) {
        await env.DB.prepare(
          "UPDATE users SET role = 'creator', plan = COALESCE(plan, 'free') WHERE id = ?"
        ).bind(existingByEmail.id).run();

        creatorUser = await env.DB.prepare(
          "SELECT id, handle, email, role, plan FROM users WHERE id = ?"
        ).bind(existingByEmail.id).first();

        tempPassword = "SaySay" + randomToken().slice(0, 8);
const tempPasswordHash = await hashPassword(tempPassword);

await env.DB.prepare(
  "UPDATE users SET role = 'creator', plan = COALESCE(plan, 'free'), password_hash = ? WHERE id = ?"
).bind(tempPasswordHash, existingByEmail.id).run();

creatorAction = "upgraded_existing_user";
if (existing.phone && tempPassword && creatorUser && creatorUser.handle) {
  smsResult = await sendTwilioSms(
    env,
    existing.phone,
    "SaySay Music: Your artist application was approved. Username: " +
      creatorUser.handle +
      " Temp password: " +
      tempPassword +
      " Log in at app.saysaymusic.com and change your password."
  );
}
      } else {
        while (true) {
          const taken = await env.DB.prepare(
            "SELECT id FROM users WHERE lower(handle) = lower(?) LIMIT 1"
          ).bind(chosenHandle).first();

          if (!taken) break;
          chosenHandle = baseHandle + String(suffix);
          suffix += 1;
        }

        const newUserId = await sha1Hex("user:" + chosenHandle.toLowerCase());

        await env.DB.prepare(
          "INSERT INTO users (id, handle, email, role, plan) VALUES (?, ?, ?, ?, ?)"
        ).bind(
          newUserId,
          chosenHandle,
          email,
          "creator",
          "free"
        ).run();

        creatorUser = await env.DB.prepare(
          "SELECT id, handle, email, role, plan FROM users WHERE id = ?"
        ).bind(newUserId).first();

tempPassword = "SaySay" + randomToken().slice(0, 8);
const tempPasswordHash = await hashPassword(tempPassword);

await env.DB.prepare(
  "INSERT INTO users (id, handle, email, role, plan, password_hash) VALUES (?, ?, ?, ?, ?, ?) " +
  "ON CONFLICT(handle) DO UPDATE SET " +
  "email = excluded.email, " +
  "role = 'creator', " +
  "plan = 'free', " +
  "password_hash = excluded.password_hash"
).bind(
  newUserId,
  chosenHandle,
  email,
  "creator",
  "free",
  tempPasswordHash
).run();

creatorUser = await env.DB.prepare(
  "SELECT id, handle, email, role, plan FROM users WHERE id = ?"
).bind(newUserId).first();

creatorAction = "created_new_creator";
if (existing.phone && tempPassword && creatorUser && creatorUser.handle) {
  smsResult = await sendTwilioSms(
    env,
    existing.phone,
    "SaySay Music: Your artist application was approved. Username: " +
      creatorUser.handle +
      " Temp password: " +
      tempPassword +
      " Log in at app.saysaymusic.com and change your password."
  );
}
      }
    }

    await env.DB.prepare(
      "UPDATE artist_applications SET status = ? WHERE id = ?"
    ).bind(nextStatus, applicationId).run();

    const updated = await env.DB.prepare(
      "SELECT id, name, artist_name, email, phone, message, status, created_at FROM artist_applications WHERE id = ?"
    ).bind(applicationId).first();

    return withCors(request, json({
      ok: true,
      application: {
        id: updated.id,
        name: updated.name || "",
        artist_name: updated.artist_name || "",
        email: updated.email || "",
        phone: updated.phone || "",
        message: updated.message || "",
        status: updated.status || nextStatus,
        created_at: updated.created_at || null
      },
      creator_account: creatorUser ? {
        action: creatorAction,
        id: creatorUser.id,
        handle: creatorUser.handle || "",
        email: creatorUser.email || "",
        role: creatorUser.role || "creator",
        plan: creatorUser.plan || "free",
        temp_password: tempPassword || null,
        sms_result: smsResult || null
      } : null
    }, 200));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiAdminUploadTrack(request, env) {
  try {
    const auth = await requireAdminOrCreator(request, env);
    if (!auth.ok) return withCors(request, bad(auth.error, auth.status));

    const user = auth.user;
    const form = await request.formData();

    const rawAlbum = normalizeAlbumPath(firstNonEmpty(form.get("album"), form.get("prefix")));
    const title = firstNonEmpty(form.get("title"), form.get("filename"), form.get("name"));
    const file = form.get("file");

    const inferredTitle = title
      ? title.replace(/\.[^/.]+$/g, "")
      : trackTitleFromFilename((file && file.name) || "Untitled.mp3");

    const artist = String(firstNonEmpty(form.get("artist"), (user && user.handle) || "SaySay")).trim();
    const subject = String(form.get("subject") || "").trim();
    const genre = String(form.get("genre") || "").trim();
    const grade = String(form.get("grade_level") || "").trim();
    const gradeGroup = String(form.get("grade_group") || "").trim();
    const albumTitle = String(form.get("album_title") || "").trim();
    const explicitTrackIndexRaw = String(form.get("track_index") || "").trim();
    const cover = form.get("cover");

    if (!file) {
      return withCors(request, json({ ok: false, error: "file required" }, 400));
    }

    if (!isAllowedAudioUpload(file)) {
      return withCors(
        request,
        json({ ok: false, error: "Unsupported audio type. Use mp3, wav, m4a, flac, or ogg." }, 400)
      );
    }

    if (cover && typeof cover.name === "string" && !isAllowedCoverUpload(cover)) {
      return withCors(
        request,
        json({ ok: false, error: "Unsupported cover type. Use png, jpg, jpeg, or webp." }, 400)
      );
    }

    const fallbackAlbumTitle = albumTitle || inferredTitle || "Untitled Album";
    const safeAlbumPath = rawAlbum
      ? rawAlbum
      : buildCreatorAlbumPath(user, subject, fallbackAlbumTitle, inferredTitle);

    const cleanTitle = slugifySegment(inferredTitle) || "Untitled";
    const originalExtMatch = String(file.name || "").toLowerCase().match(/\.(mp3|wav|m4a|flac|ogg)$/i);
    const audioExt = originalExtMatch ? originalExtMatch[1].toLowerCase() : "mp3";
    const filename = cleanTitle + "." + audioExt;
    const key = safeAlbumPath + "/" + filename;

    await env.AUDIO_USER.put(key, file.stream(), {
      httpMetadata: { contentType: guessAudioContentType(filename) }
    });

    let coverKey = null;
    if (cover && typeof cover.name === "string" && cover.name.trim()) {
      const coverFileName = preferredCoverFilename(cover.name);
      coverKey = safeAlbumPath + "/" + coverFileName;
      await env.AUDIO_USER.put(coverKey, cover.stream(), {
        httpMetadata: { contentType: guessImageContentType(coverFileName) }
      });
    }

    const trackId = await sha1Hex("track:" + key);
    const uploaderId = user ? user.id : "system";

    const cat = deriveCatalogInfo(key);
    const finalSubject = subject || cat.subject || null;
    const finalGradeLevel = grade || cat.grade_level || null;
    const finalGradeGroup = gradeGroup || cat.grade_group || null;

    const albumInfo = await getOrCreateAlbum(
      env,
      safeAlbumPath,
      artist,
      finalSubject,
      finalGradeLevel,
      finalGradeGroup,
      albumTitle || null,
      coverKey || null,
      uploaderId,
    "pending_review"
    );

    const albumId = albumInfo.album_id;

    await env.DB.prepare(
    "INSERT INTO tracks (id, title, artist, audio_key, user_id, subject, genre, grade_level, grade_group, album_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET " +
      "title=excluded.title, " +
      "artist=excluded.artist, " +
      "audio_key=excluded.audio_key, " +
      "user_id=excluded.user_id, " +
      "subject=COALESCE(excluded.subject, tracks.subject), " +
      "genre=COALESCE(excluded.genre, tracks.genre), " +
      "grade_level=COALESCE(excluded.grade_level, tracks.grade_level), " +
      "grade_group=COALESCE(excluded.grade_group, tracks.grade_group), " +
      "status=COALESCE(excluded.status, tracks.status)"
    ).bind(
      trackId,
      safeTitleFromSegment(inferredTitle),
      artist,
      key,
      uploaderId,
      finalSubject,
      genre || null,
      finalGradeLevel,
      finalGradeGroup,
      albumId,
      "pending_review"
    ).run();

    const existingAlbumTrack = await env.DB.prepare(
      "SELECT track_index FROM album_tracks WHERE album_id = ? AND track_id = ?"
    ).bind(albumId, trackId).first();

    const explicitTrackIndex = clampInt(explicitTrackIndexRaw || "0", 0, 0, 100000);
    let assignedTrackIndex = existingAlbumTrack && existingAlbumTrack.track_index
      ? Number(existingAlbumTrack.track_index)
      : (explicitTrackIndex > 0 ? explicitTrackIndex : await getNextAlbumTrackIndex(env, albumId));

    await env.DB.prepare(
      "INSERT INTO album_tracks (album_id, track_id, track_index) VALUES (?, ?, ?) " +
      "ON CONFLICT(album_id, track_id) DO UPDATE SET track_index = excluded.track_index"
    ).bind(albumId, trackId, assignedTrackIndex).run();

    const finalAlbum = await getAlbumById(env, albumId);

    return withCors(request, json({
      ok: true,
      uploaded: {
        audio_key: key,
        audio_url: buildPublicAudioUrl(key),
        cover_key: coverKey,
        cover_url: coverKey
          ? buildPublicAudioUrl(coverKey)
          : (finalAlbum && finalAlbum.cover_key ? buildPublicAudioUrl(finalAlbum.cover_key) : null)
      },
      track: {
        id: trackId,
        title: safeTitleFromSegment(inferredTitle),
        artist: artist,
        stream_url: "/api/stream/" + encodeURIComponent(trackId),
        track_index: assignedTrackIndex,
        subject: finalSubject,
        grade_level: finalGradeLevel,
        grade_group: finalGradeGroup
      },
      album: {
        id: albumId,
        path: safeAlbumPath,
        title: finalAlbum
          ? finalAlbum.title
          : (albumTitle || safeTitleFromSegment(safeAlbumPath.split("/").pop() || safeAlbumPath)),
        artist: finalAlbum ? finalAlbum.artist : artist,
        created_new: !albumInfo.existed_before,
        reused_existing: albumInfo.existed_before,
        cover_key: finalAlbum ? finalAlbum.cover_key : coverKey,
        cover_url: finalAlbum && finalAlbum.cover_key
          ? buildPublicAudioUrl(finalAlbum.cover_key)
          : (coverKey ? buildPublicAudioUrl(coverKey) : null),
        subject: finalAlbum ? (finalAlbum.subject || null) : finalSubject,
        grade_level: finalAlbum ? (finalAlbum.grade_level || null) : finalGradeLevel,
        grade_group: finalAlbum ? (finalAlbum.grade_group || null) : finalGradeGroup
      }
    }));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiAdminUploadCover(request, env) {
  try {
    const auth = await requireAdminOrCreator(request, env);
    if (!auth.ok) return withCors(request, bad(auth.error, auth.status));

    const user = auth.user;
    const form = await request.formData();

    const rawAlbum = normalizeAlbumPath(firstNonEmpty(form.get("album"), form.get("prefix")));
    const artist = String(firstNonEmpty(form.get("artist"), (user && user.handle) || "SaySay")).trim();
    const subject = String(form.get("subject") || "").trim();
    const grade = String(form.get("grade_level") || "").trim();
    const gradeGroup = String(form.get("grade_group") || "").trim();
    const albumTitle = String(form.get("album_title") || "").trim();
    const cover = form.get("cover") || form.get("file");

    if (!cover) {
      return withCors(request, bad("cover/file required", 400));
    }
    if (!isAllowedCoverUpload(cover)) {
      return withCors(request, bad("Unsupported cover type. Use png, jpg, jpeg, or webp.", 400));
    }

    const safeAlbumPath = rawAlbum
      ? rawAlbum
      : buildCreatorAlbumPath(user, subject, albumTitle || "Untitled Album", "Untitled Album");

    const coverFileName = preferredCoverFilename(cover.name);
    const coverKey = safeAlbumPath + "/" + coverFileName;

    await env.AUDIO_USER.put(coverKey, cover.stream(), {
      httpMetadata: { contentType: guessImageContentType(coverFileName) }
    });

    const cat = deriveCatalogInfo(safeAlbumPath);
    const finalSubject = subject || cat.subject || null;
    const finalGradeLevel = grade || cat.grade_level || null;
    const finalGradeGroup = gradeGroup || cat.grade_group || null;

    const albumInfo = await getOrCreateAlbum(
      env,
      safeAlbumPath,
      artist,
      finalSubject,
      finalGradeLevel,
      finalGradeGroup,
      albumTitle || null,
      coverKey,
      user ? user.id : null,
      "draft"
    );

    return withCors(request, json({
      ok: true,
      album: {
        id: albumInfo.album_id,
        path: safeAlbumPath,
        title: albumInfo.album ? albumInfo.album.title : (albumTitle || safeTitleFromSegment(safeAlbumPath.split("/").pop() || safeAlbumPath)),
        created_new: !albumInfo.existed_before,
        reused_existing: albumInfo.existed_before,
        cover_key: coverKey,
        cover_url: buildPublicAudioUrl(coverKey)
      }
    }));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiAdminRebuildAlbumCover(request, env) {
  try {
    const auth = await requireAdminOrCreator(request, env);
    if (!auth.ok) return withCors(request, bad(auth.error, auth.status));

    const u = new URL(request.url);
    let body = {};
    if (request.method === "POST") {
      try { body = await request.json(); } catch {}
    }

    const album = normalizeAlbumRef(body, u);
    if (!album) return withCors(request, bad("album required", 400));

    const safeAlbumPath = normalizeAlbumPath(album);
    const res = await listAlbumFolderObjects(env, safeAlbumPath, 1000);
    const objects = res.objects || [];

    const imageKeys = [];
    for (let i = 0; i < objects.length; i++) {
      const k = objects[i] && objects[i].key ? objects[i].key : "";
      if (isImageKey(k)) imageKeys.push(k);
    }

    const bestCover = pickCoverKey(imageKeys);
    if (!bestCover) {
      return withCors(request, json({
        ok: false,
        error: "No cover image found in album folder",
        album: safeAlbumPath
      }, 404));
    }

    const cat = deriveCatalogInfo(safeAlbumPath);
     const albumInfo = await getOrCreateAlbum(
      env,
      safeAlbumPath,
      "SaySay",
      cat.subject || null,
      cat.grade_level || null,
      cat.grade_group || null,
      null,
      bestCover,
      auth.user ? auth.user.id : null,
      "published"
    );

    await env.DB.prepare(
      "UPDATE albums SET cover_key = ? WHERE id = ?"
    ).bind(bestCover, albumInfo.album_id).run();

    const albumRow = await getAlbumById(env, albumInfo.album_id);

    return withCors(request, json({
      ok: true,
      album: {
        id: albumInfo.album_id,
        path: safeAlbumPath,
        title: albumRow ? albumRow.title : safeTitleFromSegment(safeAlbumPath.split("/").pop() || safeAlbumPath),
        cover_key: bestCover,
        cover_url: buildPublicAudioUrl(bestCover)
      },
      found_images: imageKeys
    }));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiAdminRelinkAlbumTracks(request, env) {
  try {
    const auth = await requireAdminOrCreator(request, env);
    if (!auth.ok) return withCors(request, bad(auth.error, auth.status));

    let body = {};
    const url = new URL(request.url);
    if (request.method === "POST") {
      try { body = await request.json(); } catch {}
    }

    const album = normalizeAlbumRef(body, url);
    const clearFirst = body.clear_first !== undefined
      ? isTruthyFlag(body.clear_first)
      : (String(url.searchParams.get("clear_first") || "") === "1");

    if (!album) return withCors(request, bad("album required", 400));

    const safeAlbumPath = normalizeAlbumPath(album);
    const albumId = await sha1Hex("album:" + safeAlbumPath);

    const res = await listAlbumFolderObjects(env, safeAlbumPath, 2000);
    const objects = res.objects || [];

    const audioKeys = [];
    const imageKeys = [];
    for (let i = 0; i < objects.length; i++) {
      const k = objects[i] && objects[i].key ? objects[i].key : "";
      if (isAudioKey(k)) audioKeys.push(k);
      if (isImageKey(k)) imageKeys.push(k);
    }

    const bestCover = pickCoverKey(imageKeys);
    const cat = deriveCatalogInfo(safeAlbumPath);

    await getOrCreateAlbum(
      env,
      safeAlbumPath,
      "SaySay",
      cat.subject || null,
      cat.grade_level || null,
      cat.grade_group || null,
      null,
      bestCover || null,
      auth.user ? auth.user.id : null,
      "draft"
    );

    if (clearFirst) {
      await env.DB.prepare("DELETE FROM album_tracks WHERE album_id = ?").bind(albumId).run();
    }

    const existingIdByAudioKey = await fetchExistingTrackIdsByAudioKey(env, audioKeys);

    let createdTracks = 0;
    let linkedTracks = 0;
    const linked = [];

    for (let i = 0; i < audioKeys.length; i++) {
      const audioKey = audioKeys[i];
      const file = basename(audioKey);
      const existingId = existingIdByAudioKey[audioKey];
      const trackId = existingId ? existingId : await sha1Hex("track:" + audioKey);
      const idx = parseTrackIndex(file);
      const trackIndex = idx !== null ? idx : (i + 1);
      const title = trackTitleFromFilename(file);

      if (!existingId) {
        await env.DB.prepare(
          "INSERT INTO tracks (id, title, artist, audio_key, user_id, subject, grade_level, grade_group, album_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          trackId,
          title,
          "SaySay",
          audioKey,
          "system",
          cat.subject || null,
          cat.grade_level || null,
          cat.grade_group || null,
          null,
          "published"
        ).run();
        createdTracks += 1;
      }

      await env.DB.prepare(
        "INSERT INTO album_tracks (album_id, track_id, track_index) VALUES (?, ?, ?) " +
        "ON CONFLICT(album_id, track_id) DO UPDATE SET track_index = excluded.track_index"
      ).bind(albumId, trackId, trackIndex).run();

      linkedTracks += 1;
      linked.push({
        track_id: trackId,
        title: title,
        audio_key: audioKey,
        track_index: trackIndex,
        created_track_row: !existingId
      });
    }

    if (bestCover) {
      await env.DB.prepare("UPDATE albums SET cover_key = ? WHERE id = ?").bind(bestCover, albumId).run();
    }

    const albumRow = await getAlbumById(env, albumId);

    return withCors(request, json({
      ok: true,
      album: {
        id: albumId,
        path: safeAlbumPath,
        title: albumRow ? albumRow.title : safeTitleFromSegment(safeAlbumPath.split("/").pop() || safeAlbumPath),
        cover_key: albumRow ? albumRow.cover_key : bestCover,
        cover_url: albumRow && albumRow.cover_key ? buildPublicAudioUrl(albumRow.cover_key) : (bestCover ? buildPublicAudioUrl(bestCover) : null)
      },
      summary: {
        audio_found: audioKeys.length,
        images_found: imageKeys.length,
        tracks_created: createdTracks,
        tracks_linked: linkedTracks,
        cleared_existing_links_first: clearFirst
      },
      preview: linked.slice(0, 100)
    }));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiAdminAlbumAudit(request, env) {
  try {
    const isAdmin = await requireAdmin(request, env);
    if (!isAdmin) return withCors(request, bad("Admin only", 403));

    const url = new URL(request.url);
    let body = {};
    if (request.method === "POST") {
      try { body = await request.json(); } catch {}
    }

    const album = normalizeAlbumRef(body, url);
    if (!album) return withCors(request, bad("album required", 400));

    const safeAlbumPath = normalizeAlbumPath(album);
    const albumId = await sha1Hex("album:" + safeAlbumPath);

    const albumRow = await getAlbumById(env, albumId);
    const res = await listAlbumFolderObjects(env, safeAlbumPath, 2000);
    const objects = res.objects || [];

    const audioKeys = [];
    const imageKeys = [];
    for (let i = 0; i < objects.length; i++) {
      const k = objects[i] && objects[i].key ? objects[i].key : "";
      if (isAudioKey(k)) audioKeys.push(k);
      if (isImageKey(k)) imageKeys.push(k);
    }

    const linkedRows = await env.DB.prepare(
      "SELECT t.id, t.title, t.audio_key, at.track_index " +
      "FROM album_tracks at JOIN tracks t ON t.id = at.track_id " +
      "WHERE at.album_id = ? " +
      "ORDER BY at.track_index ASC, t.title ASC"
    ).bind(albumId).all();

    const linkedTracks = linkedRows.results || [];
    const linkedAudioMap = {};
    for (let i = 0; i < linkedTracks.length; i++) {
      linkedAudioMap[String(linkedTracks[i].audio_key || "")] = true;
    }

    const unlinkedFolderAudio = [];
    for (let i = 0; i < audioKeys.length; i++) {
      const k = audioKeys[i];
      if (!linkedAudioMap[k]) {
        unlinkedFolderAudio.push({
          audio_key: k,
          inferred_title: trackTitleFromFilename(basename(k)),
          inferred_track_index: parseTrackIndex(basename(k))
        });
      }
    }

    const inferred = deriveCatalogInfo(safeAlbumPath);

    return withCors(request, json({
      ok: true,
      album: {
        path: safeAlbumPath,
        id: albumId,
        exists_in_db: !!albumRow,
        title: albumRow ? albumRow.title : null,
        artist: albumRow ? albumRow.artist : null,
        cover_key: albumRow ? albumRow.cover_key : null,
        cover_url: albumRow && albumRow.cover_key ? buildPublicAudioUrl(albumRow.cover_key) : null,
        subject: albumRow ? (albumRow.subject || null) : null,
        grade_level: albumRow ? (albumRow.grade_level || null) : null,
        grade_group: albumRow ? (albumRow.grade_group || null) : null,
        inferred_subject: inferred.subject || null,
        inferred_grade_level: inferred.grade_level || null,
        inferred_grade_group: inferred.grade_group || null
      },
      folder_scan: {
        objects_seen: objects.length,
        audio_found: audioKeys.length,
        images_found: imageKeys.length,
        best_cover_candidate: pickCoverKey(imageKeys)
      },
      linked_tracks: linkedTracks,
      gaps: {
        linked_track_count: linkedTracks.length,
        unlinked_folder_audio_count: unlinkedFolderAudio.length,
        unlinked_folder_audio: unlinkedFolderAudio
      }
    }));
  } catch (e) {
    return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
  }
}

async function apiAdminSyncR2(request, env) {
  const headerAdmin = await requireAdmin(request, env);
  if (!headerAdmin) {
    const u = await getSessionUser(request, env);
    if (!u) return withCors(request, bad("Login required", 401));
    const role = (u.role || "creator").toLowerCase();
    if (role !== "admin" && role !== "creator") return withCors(request, bad("Admin only", 403));
  }

  if (request.method !== "POST") return withCors(request, bad("POST required", 405));

  const u = new URL(request.url);
  const dryRun = (u.searchParams.get("dry_run") || "") === "1";
  const prefix = (u.searchParams.get("prefix") || "").trim();
  const cursor = (u.searchParams.get("cursor") || "").trim();
  const limitRaw = parseInt(u.searchParams.get("limit") || "1000", 10);
  const limit = isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 1000;
  const maxPreviewRaw = parseInt(u.searchParams.get("max_preview") || "50", 10);
  const maxPreview = isFinite(maxPreviewRaw) ? Math.min(Math.max(maxPreviewRaw, 1), 200) : 50;

  const listRes = await r2ListAll(env, prefix || undefined, limit, cursor || undefined);
  const objects = listRes.objects || [];

  const audioKeys = [];
  const imageKeysByFolder = {};
  let imageCount = 0;

  for (let i = 0; i < objects.length; i++) {
    const k = objects[i].key;
    if (!k) continue;
    if (isAudioKey(k)) audioKeys.push(k);
    if (isImageKey(k)) {
      imageCount += 1;
      const d = dirname(k);
      if (!imageKeysByFolder[d]) imageKeysByFolder[d] = [];
      imageKeysByFolder[d].push(k);
    }
  }

  const existingIdByAudioKey = dryRun ? {} : await fetchExistingTrackIdsByAudioKey(env, audioKeys);

  const albumPlanMap = {};
  const trackPlan = [];

  for (let i = 0; i < audioKeys.length; i++) {
    const audioKey = audioKeys[i];
    const folder = dirname(audioKey);
    const cat = deriveCatalogInfo(audioKey);
    const file = basename(audioKey);

    const albumId = await sha1Hex("album:" + folder);

    if (!albumPlanMap[albumId]) {
      const segs = folder.split("/");
      const albumCat = deriveCatalogInfo(folder);
      const albumTitle = safeTitleFromSegment(segs[segs.length - 1] || folder);
      const imgs = imageKeysByFolder[folder] || [];
      const coverKey = pickCoverKey(imgs);

      albumPlanMap[albumId] = {
        id: albumId,
        folder: folder,
        title: albumTitle,
        artist: "SaySay",
        cover_key: coverKey || null,
        subject: albumCat.subject,
        grade_level: albumCat.grade_level,
        grade_group: albumCat.grade_group
      };
    }

    const existingId = existingIdByAudioKey[audioKey];
    const trackId = existingId ? existingId : await sha1Hex("track:" + audioKey);

    const idx = parseTrackIndex(file);
    const safeIndex = idx !== null ? idx : (trackPlan.length + 1);

    trackPlan.push({
      id: trackId,
      title: trackTitleFromFilename(file),
      artist: "SaySay",
      audio_key: audioKey,
      subject: cat.subject,
      grade_level: cat.grade_level,
      grade_group: cat.grade_group,
      album_id: albumId,
      track_index: safeIndex,
      reused_existing_id: !!existingId,
    });
  }

  const albumsPlanned = Object.keys(albumPlanMap).map((k) => albumPlanMap[k]);
  const albumsWithCover = albumsPlanned.filter((a) => !!a.cover_key).length;
  const albumsWithoutCover = albumsPlanned.length - albumsWithCover;
  const reusedCountPlanned = trackPlan.filter((x) => x.reused_existing_id).length;
  const newIdCountPlanned = trackPlan.length - reusedCountPlanned;
  const subjectSummary = summarizeSubjects(trackPlan, 15);
  const folderPreview = summarizeFolders(albumsPlanned, maxPreview);
  const duplicateRiskPreview = summarizeDuplicateRisk(trackPlan, maxPreview);

  if (dryRun) {
    const albumPreview = albumsPlanned.slice(0, maxPreview).map((a) => ({
      id: a.id,
      title: a.title,
      artist: a.artist,
      cover_key: a.cover_key,
      cover_url: a.cover_key ? buildPublicAudioUrl(a.cover_key) : null,
      folder: a.folder,
      subject: a.subject || null,
      grade_level: a.grade_level || null,
      grade_group: a.grade_group || null,
    }));

    const trackPreview = trackPlan.slice(0, maxPreview).map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      audio_key: t.audio_key,
      album_id: t.album_id,
      track_index: t.track_index,
      reused_existing_id: t.reused_existing_id,
      subject: t.subject || null,
      grade_level: t.grade_level || null,
      grade_group: t.grade_group || null,
    }));

    return withCors(request, json({
      ok: true,
      dry_run: true,
      scan: {
        prefix: prefix || "",
        limit: limit,
        cursor_in: cursor || null,
        cursor_out: listRes.cursor || null,
        truncated: !!listRes.truncated,
        objects_seen: objects.length,
        audio_found: audioKeys.length,
        image_found: imageCount,
        folders_with_images: Object.keys(imageKeysByFolder).length
      },
      plan: {
        albums_planned: albumsPlanned.length,
        tracks_planned: trackPlan.length,
        albums_with_cover: albumsWithCover,
        albums_without_cover: albumsWithoutCover,
        tracks_reused_existing_id: reusedCountPlanned,
        tracks_new_generated_id: newIdCountPlanned,
        top_subjects: subjectSummary,
        folder_preview_count: folderPreview.length,
        duplicate_risk_count: duplicateRiskPreview.length
      },
      diagnostics: {
        missing_cover_folders: folderPreview.filter(function(x) { return !x.has_cover; }),
        folder_preview: folderPreview,
        duplicate_risk_preview: duplicateRiskPreview
      },
      preview: { albums: albumPreview, tracks: trackPreview },
      next: { next_cursor: listRes.cursor || null, has_more: !!listRes.truncated },
    }, 200));
  }

  await env.DB.exec("PRAGMA foreign_keys = OFF;");
  await env.DB.exec("PRAGMA defer_foreign_keys = ON;");

  await env.DB.prepare(
    "INSERT INTO users (id, handle, email, role) VALUES (?, ?, ?, ?) " +
    "ON CONFLICT(id) DO NOTHING"
  ).bind("system", "system", "system@saysaymusic.com", "admin").run();

  const albumStatements = [];
  for (let i = 0; i < albumsPlanned.length; i++) {
    const a = albumsPlanned[i];
    albumStatements.push(
      env.DB.prepare(
        "INSERT INTO albums (id, title, artist, cover_key, subject, grade_level, grade_group) VALUES (?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET " +
        "title=excluded.title, " +
        "artist=excluded.artist, " +
        "cover_key=CASE " +
        "WHEN excluded.cover_key IS NULL THEN albums.cover_key " +
        "WHEN lower(substr(excluded.cover_key, length(excluded.cover_key)-4, 5)) = '1.png' THEN excluded.cover_key " +
        "ELSE COALESCE(albums.cover_key, excluded.cover_key) END, " +
        "subject=COALESCE(excluded.subject, albums.subject), " +
        "grade_level=COALESCE(excluded.grade_level, albums.grade_level), " +
        "grade_group=COALESCE(excluded.grade_group, albums.grade_group)"
      ).bind(a.id, a.title, a.artist, a.cover_key, a.subject, a.grade_level, a.grade_group)
    );
  }
  if (albumStatements.length) await env.DB.batch(albumStatements);

  const trackStatements = [];
  for (let i = 0; i < trackPlan.length; i++) {
    const t = trackPlan[i];
    trackStatements.push(
      env.DB.prepare(
        "INSERT INTO tracks (id, title, artist, audio_key, user_id, subject, grade_level, grade_group) VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET " +
        "title=excluded.title, " +
        "artist=excluded.artist, " +
        "audio_key=excluded.audio_key, " +
        "subject=COALESCE(excluded.subject, tracks.subject), " +
        "genre=COALESCE(excluded.genre, tracks.genre), " +
        "grade_level=COALESCE(excluded.grade_level, tracks.grade_level), " +
        "grade_group=COALESCE(excluded.grade_group, tracks.grade_group)"
      ).bind(t.id, t.title, t.artist, t.audio_key, "system", t.subject, t.grade_level, t.grade_group)
    );
  }
  if (trackStatements.length) await env.DB.batch(trackStatements);

  const albumTrackStatements = [];
  for (let i = 0; i < trackPlan.length; i++) {
    const t = trackPlan[i];
    albumTrackStatements.push(
      env.DB.prepare(
        "INSERT INTO album_tracks (album_id, track_id, track_index) VALUES (?, ?, ?) " +
        "ON CONFLICT(album_id, track_id) DO UPDATE SET track_index=COALESCE(excluded.track_index, album_tracks.track_index)"
      ).bind(t.album_id, t.id, t.track_index)
    );
  }
  if (albumTrackStatements.length) await env.DB.batch(albumTrackStatements);

  const reused = reusedCountPlanned;

  return withCors(request, json({
    ok: true,
    dry_run: false,
    wrote: {
      albums_attempted: albumsPlanned.length,
      tracks_attempted: trackPlan.length,
      albums_with_cover: albumsWithCover,
      albums_without_cover: albumsWithoutCover,
      tracks_reused_existing_id: reused,
      tracks_new_generated_id: newIdCountPlanned,
      top_subjects: subjectSummary
    },
    diagnostics: {
      missing_cover_folders: folderPreview.filter(function(x) { return !x.has_cover; }),
      folder_preview: folderPreview,
      duplicate_risk_preview: duplicateRiskPreview
    },
    scan: {
      prefix: prefix || "",
      limit: limit,
      cursor_in: cursor || null,
      cursor_out: listRes.cursor || null,
      truncated: !!listRes.truncated,
      objects_seen: objects.length,
      audio_found: audioKeys.length,
      image_found: imageCount,
      folders_with_images: Object.keys(imageKeysByFolder).length
    },
    next: { next_cursor: listRes.cursor || null, has_more: !!listRes.truncated },
  }, 200));
}

export default {
  async fetch(request, env, ctx) {
    try {
      await ensureSchema(env);

      if (request.method === "OPTIONS") return handleOptions(request);

      const url = new URL(request.url);
      const path = url.pathname;

      if (path === "/api/health") return apiHealth(request);

      if (path === "/api/me") return apiMe(request, env);
      if (path === "/api/auth/me") return apiMe(request, env);
if (path === "/api/me/daily-usage" && request.method === "POST") {
  try {
    const user = await getSessionUser(request, env);
    if (!user || !user.id) {
      return withCors(request, json({ ok: false, error: "Unauthorized" }, 401));
    }
    
    if (hasUnlimitedAccess(user)) {
      return withCors(request, json({
        ok: true,
        unlimited: true,
        daily_seconds_used: Number(user.daily_seconds_used || 0),
        last_listen_date: String(user.last_listen_date || "")
      }));
    }

    const body = await request.json().catch(() => ({}));
    const daily_seconds_used = Math.max(0, Number(body.daily_seconds_used || 0));
    const last_listen_date = String(body.last_listen_date || "").trim();

    await env.DB.prepare(
      "UPDATE users SET daily_seconds_used = ?, last_listen_date = ? WHERE id = ?"
    ).bind(
      daily_seconds_used,
      last_listen_date,
      user.id
    ).run();

    return withCors(request, json({
      ok: true,
      daily_seconds_used,
      last_listen_date
    }));
  } catch (err) {
    return withCors(request, json({
      ok: false,
      error: err && err.message ? err.message : "Daily usage update failed"
    }, 500));
  }
}
      if (path === "/api/login" && request.method === "POST") return apiLogin(request, env);
      if (path === "/api/auth/register" && request.method === "POST") return apiAuthRegister(request, env);
      if (path === "/api/auth/login" && request.method === "POST") return apiAuthLogin(request, env);

      if (path === "/api/logout" && request.method === "POST") return apiLogout(request, env);
      if (path === "/api/auth/logout" && request.method === "POST") return apiLogout(request, env);

      if (path === "/api/tracks") return apiTracks(request, env);
      if (path === "/api/trending") return apiTrending(request, env);

      if (path === "/api/library/prefixes") return apiLibraryPrefixes(request, env);
      if (path === "/api/library/by-prefix") return apiLibraryByPrefix(request, env);
      if (path === "/api/library/summary") return apiLibrarySummary(request, env);

      if (path === "/api/play" && request.method === "POST") return apiPlay(request, env);
      if (path === "/api/like" && request.method === "POST") return apiLike(request, env);
      if (path === "/api/my/likes") return apiMyLikes(request, env);
      if (path === "/api/my/albums") return apiMyAlbums(request, env);
      if (path === "/api/my/tracks") return apiMyTracks(request, env);
      if (path === "/api/albums") return apiAlbums(request, env);
      if (path.startsWith("/api/albums/")) {
        const albumId = path.slice("/api/albums/".length);
        return apiAlbumById(request, env, albumId);
      }

      if (path === "/api/admin/invite" && request.method === "POST") return apiAdminInvite(request, env);
      if (path === "/api/admin/r2peek") return apiAdminR2Peek(request, env);
      if (path === "/api/admin/catalog-check") return apiAdminCatalogCheck(request, env);
      if (path === "/api/admin/artist-applications") return apiAdminArtistApplications(request, env);
      if (path === "/api/admin/artist-application-decision" && request.method === "POST") return apiAdminArtistApplicationDecision(request, env);
      if (path === "/api/admin/publish-album" && request.method === "POST") return apiAdminPublishAlbum(request, env);
      if (path === "/api/admin/archive-album" && request.method === "POST") return apiAdminArchiveAlbum(request, env);
      if (path === "/api/admin/unarchive-album" && request.method === "POST") return apiAdminUnarchiveAlbum(request, env);
      if (path === "/api/creator/submit-album" && request.method === "POST") return apiCreatorSubmitAlbum(request, env);
      if (path === "/api/admin/maintenance-preview") return apiAdminMaintenancePreview(request, env);
      if (path === "/api/admin/sync-r2" && request.method === "POST") return apiAdminSyncR2(request, env);
      if (path === "/api/admin/bypass-login") return apiAdminBypassLogin(request, env);
      if (path === "/api/private/owner-login") return apiPrivateOwnerLogin(request, env);
      if (path === "/api/private/create-creator-account" && request.method === "POST") return apiPrivateCreateCreatorAccount(request, env);
      if (path === "/api/private/transfer-ownership" && request.method === "POST") return apiPrivateTransferOwnership(request, env);
      if (path === "/api/billing/checkout-premium" && request.method === "POST") return apiBillingPremiumCheckout(request, env);
      if (path === "/api/billing/checkout-artist" && request.method === "POST") return apiBillingArtistCheckout(request, env);
      if (path === "/api/billing/confirm-checkout") return apiBillingConfirmCheckout(request, env);
      if (path === "/api/billing/portal") return apiBillingPortal(request, env);
      if (path === "/api/artist/apply" && request.method === "POST") return apiArtistApply(request, env);
      if (path === "/api/admin/upload-track" && request.method === "POST") return apiAdminUploadTrack(request, env);
      if (path === "/api/admin/upload-cover" && request.method === "POST") return apiAdminUploadCover(request, env);
      if (path === "/api/admin/rebuild-album-cover") return apiAdminRebuildAlbumCover(request, env);
      if (path === "/api/admin/relink-album-tracks") return apiAdminRelinkAlbumTracks(request, env);
      if (path === "/api/admin/album-audit") return apiAdminAlbumAudit(request, env);
      if (path === "/api/admin/update-track-meta" && request.method === "POST") return apiAdminUpdateTrackMeta(request, env);
      if (path === "/api/admin/update-album-meta" && request.method === "POST") return apiAdminUpdateAlbumMeta(request, env);
      if (path === "/api/admin/correct-metadata-by-prefix" && request.method === "POST") return apiAdminCorrectMetadataByPrefix(request, env);
      if (path === "/api/admin/remove-track-catalog" && request.method === "POST") return apiAdminRemoveTrackCatalog(request, env);
      if (path === "/api/admin/remove-album-links" && request.method === "POST") return apiAdminRemoveAlbumLinks(request, env);

      if (path.startsWith("/api/stream/")) {
        const trackId = decodeURIComponent(path.slice("/api/stream/".length));
        return apiStream(request, env, trackId);
      }

      return withCors(request, bad("Not found", 404));
    } catch (e) {
      return withCors(request, json({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
    }
  },
};

