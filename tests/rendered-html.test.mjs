import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function request(path = "/", headers = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html", ...headers } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders Little Lunchbox", async () => {
  const response = await request();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Little Lunchbox<\/title>/i);
  assert.match(html, /What are we eating\?/i);
  assert.match(html, /my kitchen/i);
  assert.match(html, /grocery list/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("contains no disposable starter preview", async () => {
  await assert.rejects(access(new URL("app/_sites-preview", projectRoot)));
});

test("protects the database API until Cloudflare Access authenticates the user", async () => {
  const forgedOwner = await request("/api/state", { "x-little-lunchbox-owner": "attacker@example.com" });
  assert.equal(forgedOwner.status, 401);

  const unsignedEmail = await request("/api/state", {
    "cf-access-authenticated-user-email": "attacker@example.com",
  });
  assert.equal(unsignedEmail.status, 401);
});
