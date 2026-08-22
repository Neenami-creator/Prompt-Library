/**
 * Regenerates integrity.json from the files currently on disk.
 * Run this after deliberately editing any sealed file.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "integrity.json"), "utf8"));

for (const file of Object.keys(manifest.files)) {
  manifest.files[file] = createHash("sha256")
    .update(readFileSync(join(root, file)))
    .digest("hex");
}

writeFileSync(join(root, "integrity.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[integrity] resealed ${Object.keys(manifest.files).length} files.`);
