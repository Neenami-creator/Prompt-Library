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

console.log("[theme] optional Midnight Aubergine dark mode applied");
