import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

test("repository launcher selects its own application even when run from another directory", { skip: process.platform !== "win32" }, () => {
  const launcher = resolve(__dirname, "../Start-Custodia.ps1");
  const escaped = launcher.replace(/'/g, "''");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `& '${escaped}' -Check | ConvertTo-Json -Compress`], {
    cwd: tmpdir(), encoding: "utf8", windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  const selected = JSON.parse(result.stdout.trim());
  assert.equal(selected.ApplicationPath, resolve(__dirname, ".."));
  assert.equal(selected.NextPath, resolve(__dirname, "../node_modules/next/dist/bin/next"));
  assert.equal(selected.Port, 3000);
});
