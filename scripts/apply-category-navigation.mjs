import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.cwd(), "app/prompt-library.tsx");
let source = readFileSync(file, "utf8");

const categoryBlock = `const categoryGroups: CategoryGroup[] = [
  { key: "essentials", label: "Essentials", accent: "#c8a94b", members: ["essentials"] },
  {
    key: "writing",
    label: "Writing & Editing",
    accent: "#a15170",
    members: [
      "writing",
      "writing & editing",
      "editing & rewriting",
      "reports & summaries",
      "thought leadership & executive communications",
      "email & launch copywriting",
    ],
  },
  {
    key: "presentations",
    label: "Presentations",
    accent: "#456f87",
    members: [
      "presentations",
      "presentations & slides",
      "presentation design",
      "presentation strategy & design",
      "presentation design & storytelling",
      "slide design & quality control",
    ],
  },
  {
    key: "image",
    label: "Image & Design",
    accent: "#b46a3b",
    members: [
      "image",
      "image generation & editing",
      "image generation & visualisation",
      "design & visual content",
      "character design & visual consistency",
      "product marketing & infographic design",
      "image editing & enhancement",
    ],
  },
  {
    key: "branding",
    label: "Branding & Creative",
    accent: "#8b6b20",
    members: ["branding", "branding & logo strategy", "creative direction & visual strategy"],
  },
  {
    key: "video",
    label: "Video & Media",
    accent: "#8a4aa5",
    members: [
      "video",
      "video & media production",
      "video & animation",
      "product video & storyboarding",
      "faceless youtube strategy",
    ],
  },
  {
    key: "marketing",
    label: "Marketing & Web",
    accent: "#b23e6b",
    members: [
      "social",
      "social media",
      "website strategy & conversion",
      "research, ux & content strategy",
      "ux, cro & information architecture",
      "content strategy & marketing",
    ],
  },
  {
    key: "business",
    label: "Business & Analysis",
    accent: "#2f688e",
    members: [
      "work",
      "analysis",
      "business",
      "research & analysis",
      "stakeholder analysis",
      "faceless business & ai monetisation",
      "ai monetisation & side hustles",
    ],
  },
  {
    key: "finance",
    label: "Finance",
    accent: "#3f7467",
    members: [
      "finance",
      "personal finance & money management",
      "budgeting & debt",
      "investing & wealth",
    ],
  },
  {
    key: "travel",
    label: "Travel",
    accent: "#447887",
    members: ["travel", "travel planning", "travel & itineraries"],
  },
  {
    key: "home",
    label: "Home & Interiors",
    accent: "#7a7045",
    members: [
      "home",
      "home & interiors",
      "home decorating",
      "interior design & home improvement",
    ],
  },
  {
    key: "tech",
    label: "AI Tools & Development",
    accent: "#b25f43",
    members: [
      "claude cowork & file workflows",
      "claude",
      "gemini",
      "notebooklm",
      "ai tools — chatgpt commands",
      "ai tools - chatgpt commands",
      "software planning & engineering",
      "software engineering & code quality",
      "app building & saas development",
      "coding & development",
      "automation",
      "document analysis & intelligence",
      "personal ai & content systems",
    ],
  },
  {
    key: "productivity",
    label: "Productivity & Organisation",
    accent: "#4d7c46",
    members: [
      "productivity",
      "dashboard",
      "dashboards",
      "file organisation",
      "personal organisation",
    ],
  },
  {
    key: "other",
    label: "More",
    accent: "#77736f",
    members: ["uncategorised"],
  },
];`;

source = source.replace(
  /const categoryGroups: CategoryGroup\[\] = \[[\s\S]*?\n\];\n\nconst groupByCategory/,
  `${categoryBlock}\n\nconst groupByCategory`,
);

source = source.replace(
  /function groupKeyFor\(rawCategory: string\) \{[\s\S]*?\n\}/,
  `function groupKeyFor(rawCategory: string) {
  const category = rawCategory.trim().toLowerCase();
  const direct = groupByCategory[category];
  if (direct) return direct;

  // Semantic fallbacks keep newly added subcategories in the right parent
  // without requiring a code change every time the library grows.
  if (/finance|financial|money|budget|debt|tax|invest|wealth|superannuation/.test(category)) return "finance";
  if (/travel|trip|itinerar|packing|destination|hotel|flight/.test(category)) return "travel";
  if (/home|interior|decor|room|renovat|garden|household/.test(category)) return "home";
  if (/presentation|slide|powerpoint|speaker notes/.test(category)) return "presentations";
  if (/writing|editing|rewrit|report|summary|summar|thought leadership|email copy|copywriting/.test(category)) return "writing";
  if (/image|visual|photo|illustrat|infographic|character design|render|diagram|blueprint|x-ray|cutaway|cross-section|exploded view/.test(category)) return "image";
  if (/brand|logo|creative direction|identity/.test(category)) return "branding";
  if (/video|youtube|animation|media production|storyboard/.test(category)) return "video";
  if (/marketing|social|content strategy|website|\bux\b|\bcro\b|seo|launch campaign/.test(category)) return "marketing";
  if (/claude|gemini|notebooklm|chatgpt|ai tool|software|engineer|coding|development|\bapp\b|saas|automation|github|code quality|document intelligence/.test(category)) return "tech";
  if (/productivity|dashboard|organis|workflow|planning|task|file management/.test(category)) return "productivity";
  if (/business|analysis|research|stakeholder|executive|decision|strategy|work/.test(category)) return "business";
  return "other";
}`,
);

source = source.replace('work: "Work",', 'work: "General Business",');
source = source.replace(
  'return categoryAccents[category] ?? "#7140a6";',
  'return categoryAccents[category] ?? groupFor(groupKeyFor(category))?.accent ?? "#7140a6";',
);

// Keep the top quick links curated even though the full sidebar has every parent.
source = source.replace(
  /(<section className="category-links"[\s\S]*?<button[\s\S]*?Favourites[\s\S]*?<\/button>\s*)\{categoryGroups\.map\(\(group\) => \{/,
  `$1{categoryGroups
            .filter((group) => ["writing", "image", "tech", "business", "finance", "travel", "home"].includes(group.key))
            .map((group) => {`,
);

// Personalise the gold sidebar title with the saved user name.
source = source.replace(
  '<div className="brand-title">Prompt Library</div>',
  '<div className="brand-title">{profileName}&apos;s Prompt Library</div>',
);

// Simplify the top breadcrumb to a single location label.
source = source.replace(
  /<div className="topbar-context" aria-label="Current location">[\s\S]*?<\/div>\s*<div className="top-actions">/,
  `<div className="topbar-context" aria-label="Current location">
            <strong>Prompt Library</strong>
          </div>
          <div className="top-actions">`,
);

if (!source.includes('label: "Finance"') || !source.includes('label: "Travel"') || !source.includes('label: "Home & Interiors"')) {
  throw new Error("Category navigation refresh did not apply cleanly.");
}
if (!source.includes("{profileName}&apos;s Prompt Library") || !source.includes('<strong>Prompt Library</strong>')) {
  throw new Error("Personalised chrome refresh did not apply cleanly.");
}

writeFileSync(file, source);

const cssFile = join(process.cwd(), "app/globals.css");
let css = readFileSync(cssFile, "utf8");
const marker = "/* Personalised navigation alignment refresh */";
if (!css.includes(marker)) {
  css += `\n\n${marker}\n
/* Reserve identical columns for every parent category so counts and
   dropdown chevrons form clean vertical lines. */
.category-nav .nav-group-header,
.category-nav button.nav-solo-group {
  grid-template-columns: 8px minmax(0, 1fr) 38px 22px;
  column-gap: 9px;
}

.category-nav button.nav-solo-group::after {
  content: "";
  display: block;
  width: 22px;
  height: 22px;
}

.category-nav .nav-group-header b,
.category-nav button.nav-solo-group b {
  width: 38px;
  min-width: 38px;
  justify-self: end;
}

.brand-title {
  max-width: 164px;
  font-size: 16.5px;
  line-height: 1.12;
}

.hero-greeting {
  font-size: clamp(18px, 1.45vw, 24px) !important;
  line-height: 1.2 !important;
  font-weight: 650 !important;
  letter-spacing: -0.015em !important;
  text-transform: none !important;
}

.topbar-context strong {
  font-weight: 700;
}
`;
  writeFileSync(cssFile, css);
}

console.log("[navigation] category architecture and personalised chrome refreshed");
