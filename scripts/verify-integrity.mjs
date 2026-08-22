/**
 * Build-time source integrity check.
 *
 * The library's content and the page that renders it were transferred into this
 * project through a channel with no direct file transport, so every character
 * of the design and markup was retyped. This script makes that verifiable
 * rather than trusted: it hashes the files listed in integrity.json and fails
 * the build if any byte differs from what was sealed at export time.
 *
 * If you edited one of these files on purpose, that failure is expected —
 * run `npm run reseal` to record the new hashes, then build again.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(root, "integrity.json"), "utf8"));
} catch {
  console.log("[integrity] no integrity.json — skipping check.");
  process.exit(0);
}

const failures = [];

for (const [file, expected] of Object.entries(manifest.files)) {
  let actual;
  try {
    actual = createHash("sha256").update(readFileSync(join(root, file))).digest("hex");
  } catch {
    failures.push(`${file}: missing`);
    continue;
  }
  if (actual !== expected) {
    failures.push(`${file}: expected ${expected.slice(0, 16)}…, got ${actual.slice(0, 16)}…`);
  }
}

if (failures.length > 0) {
  console.error("\n[integrity] Source integrity check FAILED:\n");
  for (const line of failures) console.error(`  ${line}`);
  console.error(
    "\nIf you changed these files deliberately, run `npm run reseal` to update integrity.json.\n",
  );
  process.exit(1);
}

console.log(`[integrity] ${Object.keys(manifest.files).length} files verified.`);
