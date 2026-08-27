import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const componentFile = join(process.cwd(), "app/prompt-library.tsx");
let source = readFileSync(componentFile, "utf8");

source = source.replace(
  '  const [savingProfile, setSavingProfile] = useState(false);',
  '  const [savingProfile, setSavingProfile] = useState(false);\n  const [theme, setTheme] = useState<"light" | "dark">("light");',
);

source = source.replace(
  `  useEffect(() => {\n    void loadPrompts();\n    void loadProfile();\n  }, []);`,
  `  useEffect(() => {\n    void loadPrompts();\n    void loadProfile();\n  }, []);\n\n  useEffect(() => {\n    try {\n      const savedTheme = window.localStorage.getItem("promptLibrary:theme");\n      if (savedTheme === "dark") {\n        setTheme("dark");\n        document.documentElement.dataset.theme = "dark";\n      }\n    } catch {}\n  }, []);\n\n  function toggleTheme() {\n    setTheme((current) => {\n      const next = current === "dark" ? "light" : "dark";\n      if (next === "dark") document.documentElement.dataset.theme = "dark";\n      else delete document.documentElement.dataset.theme;\n      try {\n        window.localStorage.setItem("promptLibrary:theme", next);\n      } catch {}\n      return next;\n    });\n  }`,
);

source = source.replace(
  `            <div className="profile-links">\n              <button\n                type="button"\n                className="avatar-change-link"\n                onClick={() => avatarInputRef.current?.click()}\n              >\n                {avatarUploading ? "Uploading…" : "Change photo"}\n              </button>\n              <span aria-hidden="true">·</span>\n              <button type="button" className="avatar-change-link" onClick={openProfileEdit}>\n                Edit name\n              </button>\n            </div>`,
  `            <div className="profile-links">\n              <button\n                type="button"\n                className="avatar-change-link"\n                onClick={() => avatarInputRef.current?.click()}\n              >\n                {avatarUploading ? "Uploading…" : "Change photo"}\n              </button>\n              <span aria-hidden="true">·</span>\n              <button type="button" className="avatar-change-link" onClick={openProfileEdit}>\n                Edit name\n              </button>\n            </div>\n            <button\n              type="button"\n              className="appearance-toggle"\n              onClick={toggleTheme}\n              aria-pressed={theme === "dark"}\n              aria-label={theme === "dark" ? "Turn off dark mode" : "Turn on dark mode"}\n            >\n              <span className="appearance-toggle-label">Dark mode</span>\n              <span className="appearance-switch" aria-hidden="true">\n                <span />\n              </span>\n            </button>`,
);

if (!source.includes('promptLibrary:theme') || !source.includes('className="appearance-toggle"')) {
  throw new Error("Dark mode component transform did not apply cleanly.");
}

writeFileSync(componentFile, source);

const cssFile = join(process.cwd(), "app/globals.css");
let css = readFileSync(cssFile, "utf8");
const marker = "/* Optional Midnight Aubergine dark mode */";
if (!css.includes(marker)) {
  css += `\n\n${marker}\n
.appearance-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  margin-top: 10px;
  border: 0;
  padding: 6px 0 0;
  background: transparent;
  color: #c7bfd1;
  font-size: 10.5px;
  font-weight: 650;
  text-align: left;
}

.appearance-toggle:hover {
  color: #fff;
}

.appearance-switch {
  position: relative;
  width: 34px;
  height: 18px;
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  transition: background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
}

.appearance-switch span {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ddd7e6;
  transition: transform var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}

.appearance-toggle[aria-pressed="true"] .appearance-switch {
  border-color: rgba(226, 196, 111, 0.68);
  background: rgba(200, 169, 75, 0.2);
}

.appearance-toggle[aria-pressed="true"] .appearance-switch span {
  transform: translateX(16px);
  background: var(--gold-2);
}

html[data-theme="dark"] {
  background: #140a1b;
  color-scheme: dark;
}

html[data-theme="dark"] body {
  background:
    radial-gradient(circle at 82% -8%, rgba(111, 49, 158, 0.28), transparent 34rem),
    radial-gradient(circle at -8% 42%, rgba(200, 169, 75, 0.08), transparent 30rem),
    linear-gradient(180deg, #140a1b 0%, #180c21 42%, #110817 100%);
  color: #f5eff8;
}

html[data-theme="dark"] .main-content,
html[data-theme="dark"] .app-shell {
  background: transparent;
}

html[data-theme="dark"] .topbar {
  border-bottom-color: rgba(226, 196, 111, 0.12);
  background: rgba(20, 10, 27, 0.9);
  color: #f5eff8;
  box-shadow: 0 8px 30px rgba(7, 3, 12, 0.28);
  backdrop-filter: blur(18px);
}

html[data-theme="dark"] .topbar-context,
html[data-theme="dark"] .topbar-context strong,
html[data-theme="dark"] .top-actions .text-button,
html[data-theme="dark"] .command-trigger,
html[data-theme="dark"] .export-menu > button {
  color: #efe7f4;
}

html[data-theme="dark"] .command-trigger {
  border-color: #49365a;
  background: #21122c;
}

html[data-theme="dark"] .command-trigger:hover,
html[data-theme="dark"] .top-actions .text-button:hover,
html[data-theme="dark"] .export-menu > button:hover {
  color: var(--gold-2);
}

html[data-theme="dark"] .mission-hero {
  border-color: rgba(200, 169, 75, 0.14);
  background:
    radial-gradient(circle at 82% 18%, rgba(117, 66, 164, 0.34), transparent 20rem),
    linear-gradient(135deg, #21102d 0%, #180c22 60%, #100716 100%);
  box-shadow: 0 26px 70px rgba(4, 1, 8, 0.34);
}

html[data-theme="dark"] .hero-greeting,
html[data-theme="dark"] .mission-hero h1,
html[data-theme="dark"] .mission-hero h1 span {
  color: #f3cf67;
}

html[data-theme="dark"] .mission-hero p:not(.hero-greeting) {
  color: #cbbfd2;
}

html[data-theme="dark"] .category-links,
html[data-theme="dark"] .library-toolbar,
html[data-theme="dark"] .browse-header,
html[data-theme="dark"] .prompt-card,
html[data-theme="dark"] .category-card,
html[data-theme="dark"] .featured-card,
html[data-theme="dark"] .empty-state,
html[data-theme="dark"] .detail-modal,
html[data-theme="dark"] .form-modal,
html[data-theme="dark"] .review-modal,
html[data-theme="dark"] .command-modal,
html[data-theme="dark"] .audit-drawer {
  border-color: rgba(125, 90, 151, 0.35);
  background: #21112c;
  color: #f4eef7;
  box-shadow: 0 16px 46px rgba(5, 2, 9, 0.26);
}

html[data-theme="dark"] .category-links button {
  border-color: #3b2948;
  background: #21112c;
  color: #eee5f3;
}

html[data-theme="dark"] .category-links button:hover,
html[data-theme="dark"] .category-links button.active {
  border-color: rgba(226, 196, 111, 0.52);
  background: #2a1638;
}

html[data-theme="dark"] .prompt-card:hover,
html[data-theme="dark"] .category-card:hover,
html[data-theme="dark"] .featured-card:hover {
  border-color: rgba(226, 196, 111, 0.34);
  background: #281534;
}

html[data-theme="dark"] .prompt-card h3,
html[data-theme="dark"] .category-card h3,
html[data-theme="dark"] .featured-card h3,
html[data-theme="dark"] .browse-header h2,
html[data-theme="dark"] .detail-modal h2,
html[data-theme="dark"] .form-modal h2,
html[data-theme="dark"] .review-modal h2 {
  color: #f7f0fa;
}

html[data-theme="dark"] .prompt-card p,
html[data-theme="dark"] .category-card p,
html[data-theme="dark"] .featured-card p,
html[data-theme="dark"] .browse-header p,
html[data-theme="dark"] .detail-modal p,
html[data-theme="dark"] .form-modal p,
html[data-theme="dark"] .review-modal p,
html[data-theme="dark"] .card-footer,
html[data-theme="dark"] .provenance {
  color: #bcaec6;
}

html[data-theme="dark"] input,
html[data-theme="dark"] select,
html[data-theme="dark"] textarea {
  border-color: #49365a;
  background: #160b1e;
  color: #f5eff8;
}

html[data-theme="dark"] input::placeholder,
html[data-theme="dark"] textarea::placeholder {
  color: #8f7f9a;
}

html[data-theme="dark"] .search-shell,
html[data-theme="dark"] .sort-control,
html[data-theme="dark"] .prompt-text,
html[data-theme="dark"] .review-item,
html[data-theme="dark"] .stats-card,
html[data-theme="dark"] .usage-card {
  border-color: #3d2b49;
  background: #190d22;
  color: #eee6f3;
}

html[data-theme="dark"] .prompt-text pre {
  color: #eee7f2;
}

html[data-theme="dark"] .category-pill,
html[data-theme="dark"] .detail-tags span,
html[data-theme="dark"] .card-tags span,
html[data-theme="dark"] .review-category {
  background: rgba(133, 83, 173, 0.18);
  color: #ddc9eb;
}

html[data-theme="dark"] .site-footer {
  border-top-color: rgba(226, 196, 111, 0.12);
  color: #9f90a9;
}

html[data-theme="dark"] .export-popover {
  border-color: #473356;
  background: #21112c;
  box-shadow: 0 18px 46px rgba(4, 1, 8, 0.38);
}

html[data-theme="dark"] .export-popover button {
  color: #eee6f3;
}

html[data-theme="dark"] .export-popover button:hover {
  background: #2b1838;
  color: var(--gold-2);
}

@media (prefers-reduced-motion: reduce) {
  .appearance-switch,
  .appearance-switch span {
    transition: none;
  }
}
`;
  writeFileSync(cssFile, css);
}


/* Dark mode repair: comprehensive component coverage */
const repairMarker = "/* Midnight Aubergine repair pass */";
if (!css.includes(repairMarker)) {
  css += `\n\n${repairMarker}

/* Re-map the core design tokens only while dark mode is active. Light mode
   remains exactly as authored above. */
html[data-theme="dark"] {
  --ink: #f6eff8;
  --ink-soft: #c6b8cf;
  --ink-faint: #9f90aa;
  --paper: #160b1e;
  --line: #432f50;
  --line-strong: #5a406a;
  --purple-50: #251330;
  --purple-100: #30183e;
  --purple-800: #f2e7f7;
  --purple-700: #d4afe9;
  --purple-600: #ba7dde;
  --white: #21112c;
}

/* Search / filter toolbar */
html[data-theme="dark"] .control-panel {
  border-color: #49345a;
  background: rgba(33, 17, 44, 0.94);
  box-shadow: 0 10px 32px rgba(5, 2, 9, 0.28);
}

html[data-theme="dark"] .search-box {
  border-color: #49345a;
  background: #190d22;
}

html[data-theme="dark"] .search-box:focus-within {
  border-color: #9c63c5;
  background: #1d1027;
}

html[data-theme="dark"] .search-box input {
  border: 0 !important;
  outline: 0;
  background: transparent !important;
  color: #f6eff8;
  caret-color: #e2c46f;
}

html[data-theme="dark"] .search-box input::placeholder {
  color: #9f90aa;
}

html[data-theme="dark"] .search-box > span {
  color: #c58ae6;
}

html[data-theme="dark"] .filter-chip {
  background: #311a40;
  color: #eadcf2;
}

html[data-theme="dark"] .filter-chip strong {
  background: #4a2760;
  color: #fff6d8;
}

html[data-theme="dark"] .sort-control {
  color: #c6b8cf;
}

html[data-theme="dark"] .sort-control select,
html[data-theme="dark"] .select-toggle {
  border-color: #4a365a;
  background: #190d22;
  color: #f4edf7;
}

html[data-theme="dark"] .select-toggle:hover {
  border-color: #a36bc8;
}

/* Main headings and statistics */
html[data-theme="dark"] .library-heading h2,
html[data-theme="dark"] .directory-heading h2,
html[data-theme="dark"] .category-directory h2,
html[data-theme="dark"] .empty-state h2,
html[data-theme="dark"] .view-heading h2 {
  color: #f4eaf8;
}

html[data-theme="dark"] .intro,
html[data-theme="dark"] .directory-heading p:last-child,
html[data-theme="dark"] .view-heading p:last-child,
html[data-theme="dark"] .fuzzy-hint {
  color: #c6b8cf;
}

html[data-theme="dark"] .heading-stats button {
  border-color: #432f50;
  background: #21112c;
  color: #f4edf7;
}

html[data-theme="dark"] .heading-stats button:hover,
html[data-theme="dark"] .heading-stats button.active {
  border-color: #735087;
  background: #2a1638;
}

html[data-theme="dark"] .heading-stats strong {
  color: #f5e8fa;
}

html[data-theme="dark"] .heading-stats span {
  color: #bdaec6;
}

html[data-theme="dark"] .heading-stats small,
html[data-theme="dark"] .eyebrow {
  color: #d3a8e8;
}

/* Category directory */
html[data-theme="dark"] .category-directory {
  border-color: #432f50;
  background: rgba(29, 15, 39, 0.92);
}

html[data-theme="dark"] .category-directory-grid button {
  border-color: #49345a;
  background: linear-gradient(120deg, #24122f, #1c0f25 68%);
  color: #f4edf7;
}

html[data-theme="dark"] .category-directory-grid small {
  color: #b8a9c2;
}

html[data-theme="dark"] .category-directory-grid b {
  color: #d7afe9;
}

/* Prompt cards — titles are H2, not H3. */
html[data-theme="dark"] .prompt-card {
  border-color: #432f50;
  background: #21112c;
}

html[data-theme="dark"] .prompt-card h2 {
  color: #f7f0fa;
}

html[data-theme="dark"] .card-body > p {
  color: #c4b6cc;
}

html[data-theme="dark"] .category-pill {
  background: #2c1739;
  color: #eadcf2;
  box-shadow: 0 4px 12px rgba(4, 1, 8, 0.34);
}

html[data-theme="dark"] .star-button {
  background: #2b1737;
  color: #c5b4ce;
  box-shadow: 0 4px 12px rgba(4, 1, 8, 0.34);
}

html[data-theme="dark"] .star-button:hover {
  background: #3a2148;
  color: var(--gold-2);
}

html[data-theme="dark"] .tag-row span,
html[data-theme="dark"] .detail-tags span,
html[data-theme="dark"] .source-chip-grid span {
  border-color: #4a365a;
  background: #291634;
  color: #cdbfd5;
}

html[data-theme="dark"] .card-footer {
  border-top-color: #432f50;
}

html[data-theme="dark"] .card-footer > span {
  color: #9f90aa;
}

html[data-theme="dark"] .card-footer button {
  color: #d5afe9;
}

/* Skeletons and feedback states */
html[data-theme="dark"] .skeleton-card,
html[data-theme="dark"] .empty-state,
html[data-theme="dark"] .error-panel {
  border-color: #432f50;
  background: #21112c;
}

html[data-theme="dark"] .skeleton-art {
  background: linear-gradient(100deg, #2b1737 20%, #3a2148 40%, #2b1737 60%) 0 0 / 220% 100%;
}

html[data-theme="dark"] .skeleton-line {
  background: linear-gradient(100deg, #2a1835 20%, #3b2448 40%, #2a1835 60%) 0 0 / 220% 100%;
}

html[data-theme="dark"] .empty-state p {
  color: #bdaec6;
}

/* Prompt detail and all modal surfaces */
html[data-theme="dark"] .detail-modal,
html[data-theme="dark"] .form-modal,
html[data-theme="dark"] .review-modal {
  border-color: #4c365c;
  background: #180c21;
  color: #f4edf7;
}

html[data-theme="dark"] .detail-modal > header,
html[data-theme="dark"] .form-modal > header,
html[data-theme="dark"] .review-modal > header,
html[data-theme="dark"] .audit-drawer > header {
  border-bottom-color: #432f50;
  background: radial-gradient(circle at 96% -10%, rgba(135, 73, 177, 0.2), transparent 18rem), #21112c;
}

html[data-theme="dark"] .detail-modal h2,
html[data-theme="dark"] .form-modal h2,
html[data-theme="dark"] .review-modal h2,
html[data-theme="dark"] .audit-drawer h2 {
  color: #f5eaf9;
}

html[data-theme="dark"] .detail-modal header p,
html[data-theme="dark"] .review-intro,
html[data-theme="dark"] .profile-form-note {
  color: #c3b5cb;
}

html[data-theme="dark"] .close-button,
html[data-theme="dark"] .secondary-button,
html[data-theme="dark"] .subtle-button {
  border-color: #4a365a;
  background: #25132f;
  color: #e9ddf0;
}

html[data-theme="dark"] .close-button:hover,
html[data-theme="dark"] .secondary-button:hover,
html[data-theme="dark"] .subtle-button:hover {
  border-color: #9b64c2;
  color: #fff6d8;
}

html[data-theme="dark"] .prompt-text {
  border-color: #49345a;
  background: #130919;
}

html[data-theme="dark"] .prompt-label {
  border-bottom-color: #432f50;
  background: linear-gradient(90deg, #2b1737, #21112c);
  color: #d5afe9;
}

html[data-theme="dark"] .prompt-text pre {
  background: #130919;
  color: #f0e8f4;
}

html[data-theme="dark"] .detail-modal footer,
html[data-theme="dark"] .form-modal footer,
html[data-theme="dark"] .review-modal footer {
  border-top-color: #432f50;
}

/* Forms, reviews, audit and stats */
html[data-theme="dark"] .form-grid label > span,
html[data-theme="dark"] .review-item strong,
html[data-theme="dark"] .stats-card strong,
html[data-theme="dark"] .usage-card strong {
  color: #f2e9f6;
}

html[data-theme="dark"] .review-item,
html[data-theme="dark"] .stats-card,
html[data-theme="dark"] .usage-card {
  border-color: #432f50;
  background: #21112c;
}

html[data-theme="dark"] .review-description,
html[data-theme="dark"] .review-item p,
html[data-theme="dark"] .stats-card p,
html[data-theme="dark"] .usage-card p {
  color: #c2b4ca;
}

html[data-theme="dark"] .audit-drawer {
  background: #180c21;
}

/* Top quick links and general small text */
html[data-theme="dark"] .category-links button small {
  color: #a998b4;
}

html[data-theme="dark"] .site-footer {
  color: #9f90aa;
}

/* Avoid a bright flash when changing theme and keep native widgets legible. */
html[data-theme="dark"] input,
html[data-theme="dark"] select,
html[data-theme="dark"] textarea,
html[data-theme="dark"] button {
  color-scheme: dark;
}
`;
  writeFileSync(cssFile, css);
}

console.log("[theme] optional Midnight Aubergine dark mode applied");
