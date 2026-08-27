import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const componentFile = join(process.cwd(), "app/prompt-library.tsx");
let source = readFileSync(componentFile, "utf8");

if (!source.includes('import SyncPanel from "@/app/sync-panel";')) {
  source = source.replace(
    'import {\n  buildMatcher,',
    'import SyncPanel from "@/app/sync-panel";\nimport {\n  buildMatcher,',
  );
}

if (!source.includes("<SyncPanel />")) {
  source = source.replace(
    '        <input\n          ref={avatarInputRef}',
    '        <SyncPanel />\n        <input\n          ref={avatarInputRef}',
  );
}

if (!source.includes("<SyncPanel />")) {
  throw new Error("Sync panel transform did not apply cleanly.");
}

writeFileSync(componentFile, source);

const cssFile = join(process.cwd(), "app/globals.css");
let css = readFileSync(cssFile, "utf8");
const marker = "/* Optional cross-device sync */";
if (!css.includes(marker)) {
  css += `

${marker}
.sync-library-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: calc(100% - 28px);
  margin: 10px 14px 14px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.045);
  color: #d8cfdf;
  font-size: 11px;
  font-weight: 700;
  text-align: left;
}

.sync-library-button:hover {
  border-color: rgba(226, 196, 111, 0.36);
  color: #fff3c7;
}

.sync-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #786f80;
  box-shadow: 0 0 0 3px rgba(120, 111, 128, 0.12);
}

.sync-dot.is-on {
  background: #65b981;
  box-shadow: 0 0 0 3px rgba(101, 185, 129, 0.14);
}

.sync-layer {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(13, 7, 18, 0.64);
  backdrop-filter: blur(10px);
}

.sync-modal {
  width: min(480px, 100%);
  overflow: hidden;
  border: 1px solid #ded4e6;
  border-radius: 18px;
  background: #fff;
  color: #24172b;
  box-shadow: 0 30px 90px rgba(12, 6, 18, 0.28);
}

.sync-modal > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 24px 26px 18px;
  border-bottom: 1px solid #eee8f2;
}

.sync-modal > header p {
  margin: 0 0 4px;
  color: #8b5ca9;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.sync-modal > header h2 {
  margin: 0;
  font-size: 24px;
  letter-spacing: -0.02em;
}

.sync-modal > header button {
  border: 0;
  background: transparent;
  color: #685b70;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
}

.sync-content {
  display: grid;
  gap: 14px;
  padding: 24px 26px 28px;
}

.sync-content p {
  margin: 0;
  color: #6d6074;
  font-size: 14px;
  line-height: 1.55;
}

.sync-content label {
  display: grid;
  gap: 7px;
}

.sync-content label > span,
.sync-content > strong {
  color: #34223c;
  font-size: 12px;
  font-weight: 750;
}

.sync-content input {
  min-height: 44px;
  border: 1px solid #d9cfdf;
  border-radius: 10px;
  padding: 0 12px;
  background: #fff;
  color: #24172b;
  font: inherit;
}

.sync-content small,
.sync-status,
.sync-content > span {
  color: #817389;
  font-size: 11px;
}

html[data-theme="dark"] .sync-modal {
  border-color: #4a365a;
  background: #180c21;
  color: #f4edf7;
}

html[data-theme="dark"] .sync-modal > header {
  border-bottom-color: #432f50;
  background: #21112c;
}

html[data-theme="dark"] .sync-modal > header h2,
html[data-theme="dark"] .sync-content label > span,
html[data-theme="dark"] .sync-content > strong {
  color: #f5eaf9;
}

html[data-theme="dark"] .sync-content p,
html[data-theme="dark"] .sync-content small,
html[data-theme="dark"] .sync-status,
html[data-theme="dark"] .sync-content > span {
  color: #c2b4ca;
}

html[data-theme="dark"] .sync-content input {
  border-color: #49345a;
  background: #130919;
  color: #f5eff8;
}

@media (max-width: 720px) {
  .sync-layer {
    align-items: end;
    padding: 12px;
  }

  .sync-modal {
    border-radius: 18px 18px 12px 12px;
  }
}
`;
  writeFileSync(cssFile, css);
}

console.log("[sync] optional magic-link sync UI applied");
