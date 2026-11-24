import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { uploadFile } from "./upload-path.mjs";

test("upload server confines files to its root, including symlinks", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "sunbird-upload-test-"));
  try {
    const root = path.join(dir, "upload");
    mkdirSync(root);
    mkdirSync(path.join(dir, "upload-secret"));
    writeFileSync(path.join(root, "index.html"), "ok");
    writeFileSync(path.join(dir, "upload-secret", "secret.txt"), "secret");
    symlinkSync(path.join(dir, "upload-secret", "secret.txt"), path.join(root, "escape"));
    assert.equal(uploadFile(root, "/index.html"), path.join(root, "index.html"));
    for (const bad of ["/../upload-secret/secret.txt", "/escape", "/missing", "/", "/\0"]) {
      assert.equal(uploadFile(root, bad), null, bad);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
