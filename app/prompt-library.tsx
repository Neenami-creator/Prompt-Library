"use client";

import {
  ChangeEvent,
  CSSProperties,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildMatcher,
  DUPLICATE_THRESHOLD,
  REVIEW_THRESHOLD,
  type OverlapMatch,
} from "@/lib/similarity";

type Prompt = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  description: string;
  promptText: string;
  source: string;
  recoveryStatus: string;
  aliases: string[];
  featured: boolean;
  favorite: boolean;
  archived: boolean;
  copyCount: number;
  lastCopiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Audit = {
  seedCount: number;
  recoveredFromPrototype: number;
  rebuiltBodies: number;
};

type PromptForm = {
  id?: string;
  title: string;
  category: string;
  tags: string;
  description: string;
  promptText: string;
};

type LibraryView = "prompts" | "categories" | "featured";

type IncomingPrompt = {
  title: string;
  category: string;
  tags: string[];
  description: string;
  promptText: string;
  aliases: string[];
  favorite: boolean;
};

type ReviewDecision = "add" | "update" | "skip";

/**
 * One incoming prompt, paired with whatever it looks like in the existing
 * library and what will happen to it if the import is confirmed as-is.
 */
type ReviewItem = {
  key: number;
  incoming: IncomingPrompt;
  matches: OverlapMatch[];
  decision: ReviewDecision;
  targetId: string | null;
  /** True when an existing prompt carries this exact title. */
  titleClash: boolean;
};

const emptyForm: PromptForm = {
  title: "",
  category: "work",
  tags: "",
  description: "",
  promptText: "",
};

const categoryOrder = [
  "essentials",
  "work",
  "analysis",
  "writing",
  "dashboard",
  "image",
  "video",
  "branding",
  "social",
  "claude",
  "productivity",
  "automation",
  "uncategorised",
];

const labels: Record<string, string> = {
  all: "All prompts",
  favorites: "Favourites",
  essentials: "Essentials",
  work: "Work",
  analysis: "Analysis",
  writing: "Writing",
  dashboard: "Dashboards",
  image: "Image",
  video: "Video",
  branding: "Branding",
  social: "Social Media",
  claude: "Claude",
  productivity: "Productivity",
  automation: "Automation",
  uncategorised: "Uncategorised",
};

/**
 * The library's ~40 raw category values are grouped into a small set of
 * main categories, each expandable into its real subcategories. This is a
 * purely presentational grouping — the underlying `prompt.category` value
 * is never rewritten, so nothing about the data changes, only how it is
 * browsed.
 */
type CategoryGroup = {
  key: string;
  label: string;
  accent: string;
  members: string[];
};

const categoryGroups: CategoryGroup[] = [
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
    key: "image",
    label: "Image & Design",
    accent: "#b46a3b",
    members: [
      "image",
      "image generation & editing",
      "design & visual content",
      "character design & visual consistency",
      "product marketing & infographic design",
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
    key: "business",
    label: "Business & Analysis",
    accent: "#2f688e",
    members: [
      "work",
      "analysis",
      "personal finance & money management",
      "faceless business & ai monetisation",
      "ai monetisation & side hustles",
    ],
  },
  {
    key: "marketing",
    label: "Marketing & Web",
    accent: "#b23e6b",
    members: [
      "social",
      "website strategy & conversion",
      "research, ux & content strategy",
      "ux, cro & information architecture",
    ],
  },
  {
    key: "tech",
    label: "Tech & AI Tools",
    accent: "#b25f43",
    members: [
      "claude cowork & file workflows",
      "claude",
      "software planning & engineering",
      "software engineering & code quality",
      "app building & saas development",
      "automation",
      "document analysis & intelligence",
      "personal ai & content systems",
    ],
  },
  {
    key: "productivity",
    label: "Productivity & Home",
    accent: "#4d7c46",
    members: ["productivity", "dashboard", "home"],
  },
];

const groupByCategory: Record<string, string> = {};
for (const group of categoryGroups) {
  for (const member of group.members) groupByCategory[member] = group.key;
}

function groupKeyFor(rawCategory: string) {
  return groupByCategory[rawCategory] ?? "other";
}

function groupFor(groupKey: string) {
  return categoryGroups.find((group) => group.key === groupKey);
}

const categoryAccents: Record<string, string> = {
  essentials: "#c8a94b",
  work: "#6a3b9a",
  analysis: "#2f688e",
  writing: "#a15170",
  dashboard: "#357966",
  image: "#b46a3b",
  video: "#8a4aa5",
  branding: "#8b6b20",
  social: "#b23e6b",
  claude: "#b25f43",
  productivity: "#4d7c46",
  automation: "#42727d",
};

function accentFor(category: string) {
  return categoryAccents[category] ?? "#7140a6";
}

function titleCaseCategory(value: string) {
  return labels[value] ?? value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function listFromText(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getAdelaideGreeting(date: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-AU", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Australia/Adelaide",
    }).format(date),
  );

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function PromptLibrary() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [directoryGroup, setDirectoryGroup] = useState<string | null>(null);
  const [libraryView, setLibraryView] = useState<LibraryView>("prompts");
  const [sort, setSort] = useState("featured");
  const [selected, setSelected] = useState<Prompt | null>(null);
  const [form, setForm] = useState<PromptForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [greeting, setGreeting] = useState(() => getAdelaideGreeting(new Date()));
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [review, setReview] = useState<ReviewItem[] | null>(null);
  const [applying, setApplying] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLElement>(null);

  useEffect(() => {
    void loadPrompts();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const refreshGreeting = () => setGreeting(getAdelaideGreeting(new Date()));
    refreshGreeting();
    const timer = window.setInterval(refreshGreeting, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadPrompts() {
    try {
      setLoading(true);
      const response = await fetch("/api/prompts");
      const data = (await response.json()) as {
        prompts?: Prompt[];
        audit?: Audit;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "The library could not load.");
      setPrompts(data.prompts ?? []);
      setAudit(data.audit ?? null);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The library could not load.");
    } finally {
      setLoading(false);
    }
  }

  const categories = useMemo(() => {
    const values = [...new Set(prompts.map((prompt) => prompt.category))];
    return values.sort((a, b) => {
      const ai = categoryOrder.indexOf(a);
      const bi = categoryOrder.indexOf(b);
      if (ai < 0 && bi < 0) return a.localeCompare(b);
      if (ai < 0) return 1;
      if (bi < 0) return -1;
      return ai - bi;
    });
  }, [prompts]);

  const activeGroupCount = useMemo(
    () => categoryGroups.filter((group) => categories.some((item) => groupKeyFor(item) === group.key))
      .length,
    [categories],
  );

  const counts = useMemo(() => {
    const result: Record<string, number> = {
      all: prompts.length,
      favorites: prompts.filter((prompt) => prompt.favorite).length,
    };
    for (const prompt of prompts) {
      result[prompt.category] = (result[prompt.category] ?? 0) + 1;
    }
    return result;
  }, [prompts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const result = prompts.filter((prompt) => {
      const matchesCategory =
        category === "all" ||
        (category === "favorites" && prompt.favorite) ||
        (category.startsWith("group:")
          ? groupKeyFor(prompt.category) === category.slice(6)
          : prompt.category === category);
      if (!matchesCategory) return false;
      if (libraryView === "featured" && !prompt.featured) return false;
      if (!term) return true;
      return [
        prompt.title,
        prompt.description,
        prompt.promptText,
        prompt.category,
        prompt.source,
        ...prompt.tags,
        ...prompt.aliases,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });

    return result.sort((a, b) => {
      if (sort === "az") return a.title.localeCompare(b.title, "en-AU");
      if (sort === "recent")
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (sort === "copied") return b.copyCount - a.copyCount;
      return Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title);
    });
  }, [prompts, category, search, sort, libraryView]);

  const featuredCount = prompts.filter((prompt) => prompt.featured).length;
  const recoveredCount = prompts.filter(
    (prompt) => prompt.recoveryStatus === "recovered",
  ).length;
  const spotlightPrompt =
    prompts.find((prompt) =>
      prompt.title.toLowerCase().includes("guided prompt builder"),
    ) ?? prompts.find((prompt) => prompt.featured);

  function selectCategory(nextCategory: string) {
    setCategory(nextCategory);
    setLibraryView("prompts");
    setMobileNav(false);
    window.requestAnimationFrame(() =>
      browseRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function toggleGroup(groupKey: string) {
    setExpandedGroup((current) => (current === groupKey ? null : groupKey));
  }

  function resizeImageToDataUrl(file: File, maxEdge: number, quality: number) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("That photo could not be read."));
      reader.onload = () => {
        const img = new window.Image();
        img.onerror = () => reject(new Error("That file is not a readable image."));
        img.onload = () => {
          const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("Image processing is not available in this browser."));
            return;
          }
          context.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToast("Choose an image file.");
      return;
    }
    setAvatarUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 720, 0.9);
      const response = await fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "The photo could not be saved.");
      setAvatarVersion((value) => value + 1);
      setToast("Photo updated");
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "The photo could not be saved.");
    } finally {
      setAvatarUploading(false);
    }
  }

  function openAllPrompts() {
    setCategory("all");
    setSearch("");
    setLibraryView("prompts");
    window.requestAnimationFrame(() =>
      browseRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function openCategoryDirectory() {
    setLibraryView("categories");
    setDirectoryGroup(null);
    window.requestAnimationFrame(() =>
      browseRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function openFeaturedPrompts() {
    setCategory("all");
    setSearch("");
    setLibraryView("featured");
    window.requestAnimationFrame(() =>
      browseRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  async function copyPrompt(prompt: Prompt) {
    try {
      await navigator.clipboard.writeText(prompt.promptText);
      setToast(`Copied “${prompt.title}”`);
      setPrompts((items) =>
        items.map((item) =>
          item.id === prompt.id
            ? {
                ...item,
                copyCount: item.copyCount + 1,
                lastCopiedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      void fetch("/api/prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prompt.id, incrementCopy: true }),
      });
    } catch {
      setToast("Copy failed — select and copy the text manually.");
    }
  }

  async function toggleFavourite(prompt: Prompt) {
    const next = !prompt.favorite;
    setPrompts((items) =>
      items.map((item) => (item.id === prompt.id ? { ...item, favorite: next } : item)),
    );
    if (selected?.id === prompt.id) setSelected({ ...prompt, favorite: next });
    const response = await fetch("/api/prompts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: prompt.id, favorite: next }),
    });
    if (!response.ok) {
      setToast("That favourite could not be saved.");
      void loadPrompts();
    }
  }

  function openEdit(prompt: Prompt) {
    setSelected(null);
    setForm({
      id: prompt.id,
      title: prompt.title,
      category: prompt.category,
      tags: prompt.tags.join(", "),
      description: prompt.description,
      promptText: prompt.promptText,
    });
  }

  async function savePrompt(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    if (!form.title.trim() || !form.promptText.trim()) {
      setToast("Add a title and full prompt first.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: form.id,
        title: form.title,
        category: form.category,
        tags: listFromText(form.tags),
        description: form.description,
        promptText: form.promptText,
      };
      const response = await fetch("/api/prompts", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { prompt?: Prompt; error?: string };
      if (!response.ok || !data.prompt) {
        throw new Error(data.error || "The prompt could not be saved.");
      }
      setPrompts((items) =>
        form.id
          ? items.map((item) => (item.id === data.prompt?.id ? data.prompt : item))
          : [...items, data.prompt as Prompt],
      );
      setForm(null);
      setToast(form.id ? "Prompt updated" : "Prompt added to the library");
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "The prompt could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function archivePrompt(prompt: Prompt) {
    const response = await fetch("/api/prompts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: prompt.id, archived: true }),
    });
    if (!response.ok) {
      setToast("The prompt could not be archived.");
      return;
    }
    setPrompts((items) => items.filter((item) => item.id !== prompt.id));
    setSelected(null);
    setToast("Prompt archived");
  }

  function exportJson() {
    const content = JSON.stringify(
      prompts.map(
        ({
          id,
          title,
          category: promptCategory,
          tags,
          description,
          promptText,
          aliases,
          favorite,
        }) => ({
          id,
          title,
          category: promptCategory,
          tags,
          description,
          promptText,
          aliases,
          favorite,
        }),
      ),
      null,
      2,
    );
    download("Custom-Prompt-Library.json", content, "application/json");
    setToast("JSON export downloaded");
  }

  function exportMarkdown() {
    const content = [...prompts]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(
        (prompt) =>
          `## ${prompt.title}\n\n**Category:** ${titleCaseCategory(prompt.category)}  \n**Tags:** ${prompt.tags.join(", ")}\n\n${prompt.description}\n\n### Prompt\n\n${prompt.promptText}`,
      )
      .join("\n\n---\n\n");
    download("Custom-Prompt-Library.md", `# Custom Prompt Library\n\n${content}`, "text/markdown");
    setToast("Markdown export downloaded");
  }

  /**
   * Reads an import file and checks every prompt in it against the library
   * before anything is written. Nothing is saved here — the result is a review
   * list the user confirms, so a near-duplicate can be merged into the prompt
   * it duplicates instead of quietly becoming a second copy of it.
   */
  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<Prompt>[];
      if (!Array.isArray(parsed)) throw new Error("The JSON must contain a prompt array.");

      const match = buildMatcher(
        prompts.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          description: item.description,
          promptText: item.promptText,
        })),
      );
      const byTitle = new Map(
        prompts.map((item) => [item.title.trim().toLowerCase(), item.id]),
      );

      const items: ReviewItem[] = [];
      let skipped = 0;
      for (const entry of parsed.slice(0, 200)) {
        if (!entry.title?.trim() || !entry.promptText?.trim()) {
          skipped += 1;
          continue;
        }
        const incoming: IncomingPrompt = {
          title: entry.title.trim(),
          category: entry.category?.trim().toLowerCase() || "uncategorised",
          tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
          description: entry.description?.trim() || "",
          promptText: entry.promptText.trim(),
          aliases: Array.isArray(entry.aliases) ? entry.aliases.map(String) : [],
          favorite: Boolean(entry.favorite),
        };

        const matches = match(incoming);
        const clashId = byTitle.get(incoming.title.toLowerCase()) ?? null;
        const best = matches[0];

        // A shared title, or a body close enough to be a rewrite, both point at
        // the same prompt already being filed — default those to an update so a
        // confirmed import can never silently fork one prompt into two.
        const shouldUpdate = Boolean(clashId) || (best && best.score >= DUPLICATE_THRESHOLD);
        items.push({
          key: items.length,
          incoming,
          matches,
          decision: shouldUpdate ? "update" : "add",
          targetId: clashId ?? (shouldUpdate && best ? best.id : best?.id ?? null),
          titleClash: Boolean(clashId),
        });
      }

      if (!items.length) {
        setToast(
          skipped
            ? "Every entry was missing a title or prompt text."
            : "That file contained no prompts.",
        );
        return;
      }
      setReview(items);
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "The import could not be read.");
    }
  }

  function setReviewDecision(key: number, decision: ReviewDecision) {
    setReview((items) =>
      items?.map((item) =>
        item.key === key
          ? {
              ...item,
              decision,
              targetId:
                decision === "update"
                  ? item.targetId ?? item.matches[0]?.id ?? null
                  : item.targetId,
            }
          : item,
      ) ?? null,
    );
  }

  function setReviewTarget(key: number, targetId: string) {
    setReview((items) =>
      items?.map((item) => (item.key === key ? { ...item, targetId } : item)) ?? null,
    );
  }

  /** Writes the confirmed decisions: new prompts created, merges applied over the prompt they matched. */
  async function applyReview() {
    if (!review) return;
    setApplying(true);
    let added = 0;
    let updated = 0;
    let failed = 0;
    try {
      for (const item of review) {
        if (item.decision === "skip") continue;
        const isUpdate = item.decision === "update" && item.targetId;
        const response = await fetch("/api/prompts", {
          method: isUpdate ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(isUpdate ? { id: item.targetId } : {}),
            title: item.incoming.title,
            category: item.incoming.category,
            tags: item.incoming.tags,
            description: item.incoming.description,
            promptText: item.incoming.promptText,
            ...(isUpdate
              ? { source: "Revised through import review" }
              : {
                  aliases: item.incoming.aliases,
                  favorite: item.incoming.favorite,
                  source: "Imported into prompt library",
                }),
          }),
        });
        if (!response.ok) failed += 1;
        else if (isUpdate) updated += 1;
        else added += 1;
      }
      await loadPrompts();
      setReview(null);
      const parts = [];
      if (added) parts.push(`${added} added`);
      if (updated) parts.push(`${updated} updated`);
      if (failed) parts.push(`${failed} failed`);
      setToast(parts.length ? parts.join(" · ") : "Nothing was changed");
    } catch {
      setToast("The import could not be completed.");
    } finally {
      setApplying(false);
    }
  }

  function handleCardKey(event: KeyboardEvent<HTMLElement>, prompt: Prompt) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelected(prompt);
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <div className="brand-title">MISSION CONTROL</div>
            <div className="brand-subtitle">POWERED BY NEENOS</div>
          </div>
          <button
            className="sidebar-close"
            onClick={() => setMobileNav(false)}
            aria-label="Close categories"
          >
            ×
          </button>
        </div>

        <nav className="category-nav" aria-label="Prompt categories">
          <div className="nav-label">LIBRARY</div>
          <button
            className={category === "all" ? "active" : ""}
            onClick={() => selectCategory("all")}
          >
            <span>All prompts</span>
            <b>{counts.all ?? 0}</b>
          </button>
          <button
            className={category === "favorites" ? "active" : ""}
            onClick={() => selectCategory("favorites")}
          >
            <span>Favourites</span>
            <b>{counts.favorites ?? 0}</b>
          </button>

          <div className="nav-label nav-label-groups">CATEGORIES</div>
          {categoryGroups.map((group) => {
            const groupCategories = categories.filter((item) => groupKeyFor(item) === group.key);
            if (!groupCategories.length) return null;
            const groupCount = groupCategories.reduce((sum, item) => sum + (counts[item] ?? 0), 0);

            if (groupCategories.length === 1) {
              const only = groupCategories[0];
              return (
                <button
                  key={group.key}
                  className={`nav-solo-group ${category === only ? "active" : ""}`}
                  style={{ "--accent": group.accent } as CSSProperties}
                  onClick={() => selectCategory(only)}
                >
                  <span className="nav-group-dot" aria-hidden="true" />
                  <span>{group.label}</span>
                  <b>{groupCount}</b>
                </button>
              );
            }

            const isExpanded = expandedGroup === group.key;
            return (
              <div className={`nav-group ${isExpanded ? "is-expanded" : ""}`} key={group.key}>
                <button
                  className="nav-group-header"
                  style={{ "--accent": group.accent } as CSSProperties}
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={isExpanded}
                >
                  <span className="nav-group-dot" aria-hidden="true" />
                  <span>{group.label}</span>
                  <b>{groupCount}</b>
                  <span className="nav-chevron" aria-hidden="true">⌄</span>
                </button>
                {isExpanded && (
                  <div className="nav-subcategories">
                    {groupCategories.map((item) => (
                      <button
                        key={item}
                        className={category === item ? "active" : ""}
                        onClick={() => selectCategory(item)}
                      >
                        <span>{titleCaseCategory(item)}</span>
                        <b>{counts[item] ?? 0}</b>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-audit">
          <div className="nav-label">LIBRARY STATUS</div>
          <button onClick={() => setAuditOpen(true)} className="audit-summary">
            <span className="status-dot" />
            <span>
              <strong>{prompts.length} prompts secured</strong>
              <small>View consolidation audit</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        </div>

        <div className="profile">
          <button
            type="button"
            className="profile-avatar avatar-crop"
            onClick={() => avatarInputRef.current?.click()}
            aria-label="Change profile photo"
          >
            <img src={`/api/icon/neen-avatar.jpg?v=${avatarVersion}`} alt="" />
          </button>
          <div>
            <strong>Nina</strong>
            <small>Mission Commander</small>
            <button
              type="button"
              className="avatar-change-link"
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarUploading ? "Uploading…" : "Change photo"}
            </button>
          </div>
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={uploadAvatar}
        />
      </aside>

      {mobileNav && (
        <button
          className="nav-scrim"
          onClick={() => setMobileNav(false)}
          aria-label="Close categories"
        />
      )}

      <main className="main-content">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMobileNav(true)}
            aria-label="Open categories"
          >
            ☰
          </button>
          <div className="mobile-brand">
            <span className="mini-mark" />
            <span>NEENOS</span>
          </div>
          <div className="topbar-context" aria-label="Current location">
            <span>MISSION CONTROL</span>
            <b>/</b>
            <strong>CUSTOM PROMPT LIBRARY</strong>
          </div>
          <div className="top-actions">
            <button className="text-button" onClick={() => setAuditOpen(true)}>
              Consolidation audit
            </button>
            <div className="export-menu">
              <button className="text-button">Export⌄</button>
              <div className="export-popover">
                <button onClick={exportJson}>Export JSON</button>
                <button onClick={exportMarkdown}>Export Markdown</button>
                <button onClick={() => importRef.current?.click()}>Import JSON</button>
              </div>
            </div>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={importJson}
            />
            <button className="primary-button" onClick={() => setForm(emptyForm)}>
              <span aria-hidden="true">＋</span> Add prompt
            </button>
          </div>
        </header>

        <section className="mission-hero">
          <div className="hero-copy">
            <p className="hero-greeting">{greeting}, Nina.</p>
            <h1>
              Your best thinking,
              <span>ready when you are.</span>
            </h1>
            <p>
              One beautiful home for every prompt you have collected.
            </p>
          </div>
          <div className="hero-avatar avatar-crop" aria-hidden="true">
            <img src={`/api/icon/neen-avatar.jpg?v=${avatarVersion}`} alt="" />
          </div>
          <div className="hero-orbit orbit-one" aria-hidden="true" />
          <div className="hero-orbit orbit-two" aria-hidden="true" />
        </section>

        <section className="category-links" aria-label="Quick category links">
          <button
            className={category === "all" ? "active" : ""}
            onClick={() => selectCategory("all")}
          >
            <strong>All prompts</strong>
            <small>{counts.all ?? 0}</small>
          </button>
          <button
            className={category === "favorites" ? "active" : ""}
            onClick={() => selectCategory("favorites")}
          >
            <strong>Favourites</strong>
            <small>{counts.favorites ?? 0}</small>
          </button>
          {categoryGroups.map((group) => {
            const groupCategories = categories.filter((item) => groupKeyFor(item) === group.key);
            if (!groupCategories.length) return null;
            const groupCount = groupCategories.reduce((sum, item) => sum + (counts[item] ?? 0), 0);
            return (
              <button
                key={group.key}
                className={category === `group:${group.key}` ? "active" : ""}
                onClick={() => selectCategory(`group:${group.key}`)}
                style={{ "--accent": group.accent } as CSSProperties}
              >
                <strong>{group.label}</strong>
                <small>{groupCount}</small>
              </button>
            );
          })}
        </section>

        <section className="library-heading">
          <div>
            <p className="eyebrow">YOUR SINGLE SOURCE OF TRUTH</p>
            <h2>Custom Prompt Library</h2>
            <p className="intro">
              Search the full text, save favourites and copy exactly what you need.
            </p>
          </div>
          <div className="heading-stats" aria-label="Open a library view">
            <button
              type="button"
              className={libraryView === "prompts" && category === "all" ? "active" : ""}
              onClick={openAllPrompts}
              aria-label={`Open all ${prompts.length} prompts`}
            >
              <strong>{prompts.length}</strong>
              <span>prompts</span>
              <small>View all ›</small>
            </button>
            <button
              type="button"
              className={libraryView === "categories" ? "active" : ""}
              onClick={openCategoryDirectory}
              aria-label={`Open the clickable list of ${activeGroupCount} categories`}
            >
              <strong>{activeGroupCount}</strong>
              <span>categories</span>
              <small>Browse ›</small>
            </button>
            <button
              type="button"
              className={libraryView === "featured" ? "active" : ""}
              onClick={openFeaturedPrompts}
              aria-label={`Open ${featuredCount} featured prompts`}
            >
              <strong>{featuredCount}</strong>
              <span>featured</span>
              <small>View picks ›</small>
            </button>
          </div>
        </section>

        <section ref={browseRef} className="browse-content" aria-live="polite">
          {libraryView === "categories" ? (
            <section className="category-directory" aria-labelledby="category-directory-title">
              <div className="directory-heading">
                <div>
                  <p className="eyebrow">BROWSE YOUR LIBRARY</p>
                  <h2 id="category-directory-title">
                    {directoryGroup ? groupFor(directoryGroup)?.label ?? "Categories" : "Categories"}
                  </h2>
                  <p>
                    {directoryGroup
                      ? "Choose a subcategory to see every prompt filed inside it."
                      : "Choose a category to see every prompt filed inside it."}
                  </p>
                </div>
                {directoryGroup ? (
                  <button className="secondary-button" onClick={() => setDirectoryGroup(null)}>
                    ‹ All categories
                  </button>
                ) : (
                  <button className="secondary-button" onClick={openAllPrompts}>
                    View all prompts
                  </button>
                )}
              </div>
              <div className="category-directory-grid">
                {directoryGroup
                  ? categories
                      .filter((item) => groupKeyFor(item) === directoryGroup)
                      .map((item) => (
                        <button
                          key={item}
                          onClick={() => selectCategory(item)}
                          style={{ "--accent": accentFor(item) } as CSSProperties}
                        >
                          <span>
                            <strong>{titleCaseCategory(item)}</strong>
                            <small>
                              {counts[item] ?? 0} {(counts[item] ?? 0) === 1 ? "prompt" : "prompts"}
                            </small>
                          </span>
                          <b aria-hidden="true">›</b>
                        </button>
                      ))
                  : categoryGroups
                      .filter((group) => categories.some((item) => groupKeyFor(item) === group.key))
                      .map((group) => {
                        const groupCategories = categories.filter(
                          (item) => groupKeyFor(item) === group.key,
                        );
                        const groupCount = groupCategories.reduce(
                          (sum, item) => sum + (counts[item] ?? 0),
                          0,
                        );
                        return (
                          <button
                            key={group.key}
                            onClick={() => setDirectoryGroup(group.key)}
                            style={{ "--accent": group.accent } as CSSProperties}
                          >
                            <span>
                              <strong>{group.label}</strong>
                              <small>
                                {groupCount} {groupCount === 1 ? "prompt" : "prompts"} ·{" "}
                                {groupCategories.length}{" "}
                                {groupCategories.length === 1 ? "subcategory" : "subcategories"}
                              </small>
                            </span>
                            <b aria-hidden="true">›</b>
                          </button>
                        );
                      })}
              </div>
            </section>
          ) : (
            <>
              {libraryView === "prompts" && category === "all" && !search && (
                <button
                  className="mission-band"
                  onClick={() => spotlightPrompt && setSelected(spotlightPrompt)}
                  disabled={!spotlightPrompt}
                >
                  <span className="mission-band-star" aria-hidden="true">★</span>
                  <span>
                    <small>NEEN&apos;S PICK</small>
                    <strong>{spotlightPrompt?.title ?? "Guided Prompt Builder"}</strong>
                  </span>
                  <b>{spotlightPrompt ? "Open prompt ›" : "Loading…"}</b>
                </button>
              )}

              {libraryView === "featured" && (
                <div className="view-heading">
                  <div>
                    <p className="eyebrow">CURATED FOR QUICK ACCESS</p>
                    <h2>Featured Prompts</h2>
                    <p>Your hand-picked prompts, gathered in one place.</p>
                  </div>
                  <button className="secondary-button" onClick={openAllPrompts}>
                    View all prompts
                  </button>
                </div>
              )}

              <section className="control-panel" aria-label="Search and sort prompts">
                <label className="search-box">
                  <span aria-hidden="true">⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search titles, prompt text, tags or aliases…"
                    aria-label="Search prompt library"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} aria-label="Clear search">
                      ×
                    </button>
                  )}
                </label>
                <div className="filter-chip">
                  {libraryView === "featured"
                    ? "Featured prompts"
                    : category === "all"
                      ? "Every category"
                      : labels[category] ?? category}
                  <strong>{filtered.length}</strong>
                </div>
                <label className="sort-control">
                  <span>Sort</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value)}>
                    <option value="featured">Featured first</option>
                    <option value="az">A–Z</option>
                    <option value="recent">Recently updated</option>
                    <option value="copied">Most copied</option>
                  </select>
                </label>
              </section>

              {error && (
                <section className="error-panel">
                  <div>
                    <strong>The library needs another try.</strong>
                    <p>{error}</p>
                  </div>
                  <button className="secondary-button" onClick={() => void loadPrompts()}>
                    Reload
                  </button>
                </section>
              )}

              {loading ? (
                <section className="prompt-grid" aria-label="Loading prompts">
                  {Array.from({ length: 8 }, (_, index) => (
                    <div className="skeleton-card" key={index}>
                      <div className="skeleton-art" />
                      <div className="skeleton-body">
                        <div className="skeleton-line w-50" />
                        <div className="skeleton-line w-90" />
                        <div className="skeleton-line w-70" />
                      </div>
                    </div>
                  ))}
                </section>
              ) : filtered.length ? (
                <section className="prompt-grid" aria-label="Prompt results">
                  {filtered.map((prompt) => (
                    <article
                      className={`prompt-card ${prompt.featured ? "featured" : ""}`}
                      data-category={prompt.category}
                      key={prompt.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(prompt)}
                      onKeyDown={(event) => handleCardKey(event, prompt)}
                    >
                      <div
                        className="card-art"
                        aria-hidden="true"
                        style={{ "--accent": accentFor(prompt.category) } as CSSProperties}
                      >
                        {prompt.featured && <span className="card-featured-flag">★ Featured</span>}
                      </div>
                      <div className="card-body">
                        <div className="card-topline">
                          <span
                            className="category-pill"
                            style={{ "--accent": accentFor(prompt.category) } as CSSProperties}
                          >
                            {titleCaseCategory(prompt.category)}
                          </span>
                          <button
                            className={`star-button ${prompt.favorite ? "is-favourite" : ""}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleFavourite(prompt);
                            }}
                            aria-label={
                              prompt.favorite ? "Remove from favourites" : "Add to favourites"
                            }
                          >
                            {prompt.favorite ? "★" : "☆"}
                          </button>
                        </div>
                        <h2>{prompt.title}</h2>
                        <p>{prompt.description}</p>
                        <div className="tag-row">
                          {prompt.tags.slice(0, 3).map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                          {prompt.tags.length > 3 && <span>+{prompt.tags.length - 3}</span>}
                        </div>
                        <div className="card-footer">
                          <span>
                            {prompt.copyCount ? `${prompt.copyCount} copies` : "Ready to use"}
                          </span>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void copyPrompt(prompt);
                            }}
                          >
                            Copy prompt <span aria-hidden="true">↗</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </section>
              ) : (
                <section className="empty-state">
                  <span className="empty-state-mark" aria-hidden="true">⌕</span>
                  <h2>No prompts match that search</h2>
                  <p>Try a broader phrase or choose another category.</p>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setSearch("");
                      setCategory("all");
                    }}
                  >
                    Clear filters
                  </button>
                </section>
              )}
            </>
          )}
        </section>

        <footer className="site-footer">
          <span>Mission Control · powered by NeenOS</span>
          <span>
            {recoveredCount} recovered · {prompts.length - recoveredCount} rebuilt or added
          </span>
        </footer>
      </main>

      {selected && (
        <div className="modal-layer" role="presentation" onMouseDown={() => setSelected(null)}>
          <section
            className="detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prompt-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span
                  className="category-pill"
                  style={{ "--accent": accentFor(selected.category) } as CSSProperties}
                >
                  {titleCaseCategory(selected.category)}
                </span>
                <h2 id="prompt-detail-title">{selected.title}</h2>
                <p>{selected.description}</p>
              </div>
              <button className="close-button" onClick={() => setSelected(null)} aria-label="Close">
                ×
              </button>
            </header>
            <div className="detail-tags">
              {selected.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="prompt-text">
              <div className="prompt-label">
                <span>FULL PROMPT</span>
                <span>{selected.promptText.split(/\s+/).length} words</span>
              </div>
              <pre>{selected.promptText}</pre>
            </div>
            <div className="provenance">
              <span className={`recovery-badge ${selected.recoveryStatus}`}>
                {selected.recoveryStatus === "recovered"
                  ? "Recovered source"
                  : selected.recoveryStatus === "rebuilt"
                    ? "Rebuilt from saved entry"
                    : "Added here"}
              </span>
              <span>{selected.source}</span>
            </div>
            <footer>
              <div>
                <button className="subtle-button" onClick={() => openEdit(selected)}>
                  Edit
                </button>
                <button className="subtle-button danger" onClick={() => void archivePrompt(selected)}>
                  Archive
                </button>
              </div>
              <div>
                <button
                  className="secondary-button"
                  onClick={() => void toggleFavourite(selected)}
                >
                  {selected.favorite ? "★ Favourited" : "☆ Favourite"}
                </button>
                <button className="primary-button" onClick={() => void copyPrompt(selected)}>
                  Copy full prompt
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {form && (
        <div className="modal-layer" role="presentation" onMouseDown={() => setForm(null)}>
          <form
            className="form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prompt-form-title"
            onSubmit={savePrompt}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">{form.id ? "UPDATE ENTRY" : "NEW LIBRARY ENTRY"}</p>
                <h2 id="prompt-form-title">{form.id ? "Edit prompt" : "Add a prompt"}</h2>
              </div>
              <button
                type="button"
                className="close-button"
                aria-label="Close"
                onClick={() => setForm(null)}
              >
                ×
              </button>
            </header>
            <div className="form-grid">
              <label className="wide">
                <span>Title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="A clear, memorable prompt name"
                  autoFocus
                />
              </label>
              <label>
                <span>Category</span>
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                >
                  {categoryGroups.map((group) => (
                    <optgroup label={group.label} key={group.key}>
                      {group.members.map((item) => (
                        <option value={item} key={item}>
                          {titleCaseCategory(item)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label>
                <span>Tags</span>
                <input
                  value={form.tags}
                  onChange={(event) => setForm({ ...form, tags: event.target.value })}
                  placeholder="Writing, Briefing, Analysis"
                />
              </label>
              <label className="wide">
                <span>Short description</span>
                <input
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="When should you use this prompt?"
                />
              </label>
              <label className="wide">
                <span>Full prompt</span>
                <textarea
                  value={form.promptText}
                  onChange={(event) =>
                    setForm({ ...form, promptText: event.target.value })
                  }
                  placeholder="Paste the complete, copy-ready prompt…"
                  rows={14}
                />
              </label>
            </div>
            <footer>
              <button type="button" className="secondary-button" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button className="primary-button" disabled={saving}>
                {saving ? "Saving…" : form.id ? "Save changes" : "Add to library"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {review && (
        <div className="modal-layer" role="presentation" onMouseDown={() => setReview(null)}>
          <section
            className="review-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">QUALITY CHECK</p>
                <h2 id="review-title">Review before importing</h2>
              </div>
              <button
                type="button"
                className="close-button"
                aria-label="Close"
                onClick={() => setReview(null)}
              >
                ×
              </button>
            </header>

            <p className="review-intro">
              Each prompt below was compared against all {prompts.length} already in
              your library. Nothing is saved until you confirm.
            </p>

            <div className="review-summary">
              <span className="review-chip review-chip--add">
                {review.filter((item) => item.decision === "add").length} to add
              </span>
              <span className="review-chip review-chip--update">
                {review.filter((item) => item.decision === "update").length} to update
              </span>
              <span className="review-chip review-chip--skip">
                {review.filter((item) => item.decision === "skip").length} skipped
              </span>
            </div>

            <div className="review-list">
              {review.map((item) => {
                const best = item.matches[0];
                const flagged = item.titleClash || (best && best.score >= REVIEW_THRESHOLD);
                return (
                  <article
                    key={item.key}
                    className={`review-item ${flagged ? "is-flagged" : ""} decision-${item.decision}`}
                  >
                    <div className="review-item-head">
                      <strong>{item.incoming.title}</strong>
                      <span className="review-category">
                        {titleCaseCategory(item.incoming.category)}
                      </span>
                    </div>

                    {item.incoming.description && (
                      <p className="review-description">{item.incoming.description}</p>
                    )}

                    {item.titleClash ? (
                      <p className="review-flag">
                        A prompt with this exact title is already in your library.
                      </p>
                    ) : best ? (
                      <p className="review-flag">
                        {Math.round(best.score * 100)}% similar to{" "}
                        <b>{best.title}</b>{" "}
                        <span className="review-muted">
                          ({titleCaseCategory(best.category)})
                        </span>
                      </p>
                    ) : (
                      <p className="review-flag review-flag--clear">
                        No overlap found — this looks new.
                      </p>
                    )}

                    <div className="review-actions">
                      <button
                        type="button"
                        className={item.decision === "add" ? "active" : ""}
                        onClick={() => setReviewDecision(item.key, "add")}
                      >
                        Add as new
                      </button>
                      <button
                        type="button"
                        className={item.decision === "update" ? "active" : ""}
                        disabled={!item.matches.length}
                        onClick={() => setReviewDecision(item.key, "update")}
                      >
                        Update existing
                      </button>
                      <button
                        type="button"
                        className={item.decision === "skip" ? "active" : ""}
                        onClick={() => setReviewDecision(item.key, "skip")}
                      >
                        Skip
                      </button>
                    </div>

                    {item.decision === "update" && item.matches.length > 1 && (
                      <label className="review-target">
                        <span>Replace</span>
                        <select
                          value={item.targetId ?? ""}
                          onChange={(event) => setReviewTarget(item.key, event.target.value)}
                        >
                          {item.matches.map((option) => (
                            <option value={option.id} key={option.id}>
                              {option.title} — {Math.round(option.score * 100)}%
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {item.decision === "update" && (
                      <p className="review-note">
                        The matched prompt&apos;s title, text, category and tags will be
                        replaced with this version.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>

            <footer>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setReview(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={applying}
                onClick={() => void applyReview()}
              >
                {applying ? "Applying…" : "Confirm import"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {auditOpen && (
        <div className="modal-layer audit-layer" role="presentation" onMouseDown={() => setAuditOpen(false)}>
          <aside
            className="audit-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">CONSOLIDATION RECORD</p>
                <h2 id="audit-title">One true library</h2>
              </div>
              <button className="close-button" onClick={() => setAuditOpen(false)}>
                ×
              </button>
            </header>
            <p className="audit-intro">
              This standalone library combines the latest Mission Control catalogue
              with prompt additions recovered from earlier chats, screenshots and saved files.
            </p>
            <div className="audit-score">
              <strong>{prompts.length}</strong>
              <span>complete, searchable prompts</span>
            </div>
            <div className="audit-list">
              <div>
                <span className="check">✓</span>
                <span>
                  <strong>{audit?.recoveredFromPrototype ?? 74} prompts</strong>
                  <small>Recovered from the latest Mission Control prototype</small>
                </span>
              </div>
              <div>
                <span className="check">✓</span>
                <span>
                  <strong>{prompts.length - (audit?.recoveredFromPrototype ?? 74)} earlier additions</strong>
                  <small>Restored from earlier prompt-collection requests</small>
                </span>
              </div>
              <div>
                <span className="check amber">↻</span>
                <span>
                  <strong>{audit?.rebuiltBodies ?? 15} prompt bodies rebuilt</strong>
                  <small>
                    The saved title or description survived, so a polished copy-ready body was reconstructed
                  </small>
                </span>
              </div>
              <div>
                <span className="check">✓</span>
                <span>
                  <strong>Duplicates consolidated</strong>
                  <small>
                    Data Analyst was merged into the senior data-analysis prompt; the strongest Morning Brief version was retained
                  </small>
                </span>
              </div>
              <div>
                <span className="check">✓</span>
                <span>
                  <strong>Future changes persist here</strong>
                  <small>New prompts, edits, favourites and usage counts are saved to this prompt library</small>
                </span>
              </div>
            </div>
            <section className="source-groups">
              <h3>Recovered collections</h3>
              <div className="source-chip-grid">
                {[
                  "Core Mission Control",
                  "Dashboard prompts",
                  "ChatGPT image library",
                  "Claude skills",
                  "Humanize",
                  "Critical thinking",
                  "YouTube strategy",
                  "Brand & presentation",
                  "Dog image prompts",
                ].map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </section>
            <button className="primary-button full" onClick={exportJson}>
              Download prompt backup
            </button>
          </aside>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <span className="toast-dot" aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  );
}
