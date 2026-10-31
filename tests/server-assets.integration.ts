import { sessionSigningKey } from "../src/lib/session-secret";
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

loadEnvConfig(process.cwd());

/** Read-only smoke check: HTML, streamed client references, and their JS must agree. */
async function verify() {
  const base = new URL(process.env.APP_SMOKE_URL ?? "http://localhost:3001");
  assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "This check is for the local app only.");
  const db = new PrismaClient();
  try {
    const actor = await db.user.findFirst({ where: { isActive: true, role: { in: ["ADMIN", "STAFF"] } }, select: { id: true, role: true, unitId: true } });
    assert.ok(actor, "An active local staff account is needed for this read-only check.");
    const token = await new SignJWT(actor).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2m")
      .sign(sessionSigningKey());
    for (const route of ["/login", "/intake", "/inventory", "/inventory/generate-qr"]) {
      const response = await fetch(new URL(route, base), { headers: { cookie: `custodia_session=${token}` } });
      assert.equal(response.status, 200, `${route} must load`);
      const html = await response.text();
      // Include RSC references, not just script tags: dashboard chunks are streamed in JSON.
      const chunks = [...new Set([...html.matchAll(/static\/chunks\/[^"\\\s<>]+\.js/g)].map(match => `/_next/${match[0]}`))];
      assert.ok(chunks.length > 0, `${route} must reference client chunks`);
      if (route === "/intake") assert.ok(chunks.some(path => path.includes("/intake/")), "The check must cover the intake-specific chunk.");
      for (const chunk of chunks) {
        const asset = await fetch(new URL(chunk, base));
        assert.equal(asset.status, 200, `${route}: missing or stale client chunk ${chunk}`);
        assert.match(asset.headers.get("content-type") ?? "", /javascript/, `${chunk} must be JavaScript`);
        await asset.arrayBuffer();
      }
      console.log(`PASS ${route}: ${chunks.length} client chunks load as JavaScript`);
    }
  } finally { await db.$disconnect(); }
}
verify().catch(error => { console.error(error); process.exitCode = 1; });
