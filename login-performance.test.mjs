import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("./API.js", import.meta.url), "utf8");
const loginSource = source.slice(source.indexOf("async function apiAuthLogin("), source.indexOf("async function apiTracks("));

function setup(role = "admin", valid = true) {
  let resolveEvent;
  const event = new Promise(resolve => { resolveEvent = resolve; });
  const pending = [];
  const calls = [];
  const user = { id: "1", handle: "owner", email: "owner@example.test", role, password_hash: "hash", plan: "free" };
  const env = { DB: { prepare(sql) {
    calls.push(sql);
    return { bind() { return this; }, async first() { return user; }, async run() { calls.push("session saved"); } };
  } } };
  const context = vm.createContext({
    Response, Headers, console,
    hashPassword: async () => valid ? "hash" : "wrong",
    getCookie: () => null,
    sha1Hex: async () => "token-hash",
    randomToken: () => "token",
    json: body => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }),
    bad: (error, status) => new Response(JSON.stringify({ error }), { status }),
    setSessionCookie: () => "ss_session=token; HttpOnly; Secure",
    withCors: (_, response) => response,
    fetch: () => { calls.push("event started"); return event; },
    syncMetricsAccount: async () => { calls.push("account sync"); },
    syncAllMusicAccounts: async () => { calls.push("all accounts sync"); }
  });
  vm.runInContext(loginSource, context);
  return { calls, pending, resolveEvent, login: () => context.apiAuthLogin({ json: async () => ({ handle: "owner", password: "password" }) }, env, { waitUntil: p => pending.push(p) }) };
}

test("admin login returns session while activity service remains pending", async () => {
  const state = setup();
  const response = await state.login();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Set-Cookie"), /ss_session=/);
  assert.equal((await response.json()).user.role, "admin");
  assert.equal(state.pending.length, 1);
  assert.ok(state.calls.includes("session saved"));
  assert.ok(!state.calls.includes("all accounts sync"));
  state.resolveEvent(new Response("{}"));
  await Promise.all(state.pending);
  assert.ok(state.calls.includes("account sync"));
  assert.ok(state.calls.includes("all accounts sync"));
});

test("customer reporting completes without running admin-wide synchronization", async () => {
  const state = setup("customer");
  assert.equal((await state.login()).status, 200);
  state.resolveEvent(new Response("{}"));
  await Promise.all(state.pending);
  assert.ok(state.calls.includes("account sync"));
  assert.ok(!state.calls.includes("all accounts sync"));
});

test("incorrect passwords create no session and schedule no reporting", async () => {
  const state = setup("admin", false);
  assert.equal((await state.login()).status, 401);
  assert.equal(state.pending.length, 0);
  assert.ok(!state.calls.includes("session saved"));
});

test("preflight returns without touching the database", async () => {
  const context = vm.createContext({
    handleOptions: () => new Response(null, { status: 204 }),
    ensureSchema: () => { throw new Error("Database must not be called"); }
  });
  vm.runInContext(source.slice(source.indexOf("export default {")).replace("export default", "globalThis.worker ="), context);
  const response = await context.worker.fetch({ method: "OPTIONS" }, {}, {});
  assert.equal(response.status, 204);
});
