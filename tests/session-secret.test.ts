import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { sessionSigningKey } from "../src/lib/session-secret";

test("session signing fails closed without a deployment-owned secret",t=>{
  const previous=process.env.NEXTAUTH_SECRET;t.after(()=>{if(previous===undefined)delete process.env.NEXTAUTH_SECRET;else process.env.NEXTAUTH_SECRET=previous;});
  delete process.env.NEXTAUTH_SECRET;assert.throws(sessionSigningKey,/NEXTAUTH_SECRET/);
  process.env.NEXTAUTH_SECRET="too-short";assert.throws(sessionSigningKey,/32/);
  process.env.NEXTAUTH_SECRET=randomBytes(32).toString("hex");assert.equal(sessionSigningKey().length,64);
});
