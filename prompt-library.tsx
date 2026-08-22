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

const glyphs: Record<string, string> = {
  all: "✦",
  favorites: "★",
  essentials: "⚡",
  work: "▣",
  analysis: "◫",
  writing: "✎",
  dashboard: "⌁",
  image: "◇",
  video: "▶",
  branding: "◉",
  social: "◎",
  claude: "C",
  productivity: "✓",
  automation: "↻",
  uncategorised: "·",
};

/**
 * Illustrated icon art (from /public/icons) used purely for decoration
 * throughout the UI. Every place these render is already accompanied by
 * visible text or is wrapped in aria-hidden markup, so this mapping never
 * changes what a screen reader announces — it only adds a visual identity
 * on top of the existing labels.
 */
const categoryIconArt: Record<string, string> = {
  all: "/icons/my-library.webp",
  favorites: "/icons/favourites.webp",
  essentials: "/icons/essentials.webp",
  work: "/icons/work.webp",
  analysis: "/icons/ai-tools.webp",
  writing: "/icons/writing.webp",
  dashboard: "/icons/categories.webp",
  image: "/icons/images.webp",
  video: "/icons/video.webp",
  branding: "/icons/ai-settings.webp",
  social: "/icons/personal.webp",
  claude: "/icons/coding.webp",
  productivity: "/icons/productivity.webp",
  automation: "/icons/recently-added.webp",
  uncategorised: "/icons/constellation.webp",
};

function iconFor(category: string) {
  return categoryIconArt[category] ?? "/icons/constellation.webp";
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
  const [libraryView, setLibraryView] = useState<LibraryView>("prompts");
  const [sort, setSort] = useState("featured");
  const [selected, setSelected] = useState<Prompt | null>(null);
  const [form, setForm] = useState<PromptForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [greeting, setGreeting] = useState(() => getAdelaideGreeting(new Date()));
  const importRef = useRef<HTMLInputElement>(null);
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
        prompt.category === category;
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

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<Prompt>[];
      if (!Array.isArray(parsed)) throw new Error("The JSON must contain a prompt array.");
      let imported = 0;
      for (const item of parsed.slice(0, 200)) {
        if (!item.title?.trim() || !item.promptText?.trim()) continue;
        const response = await fetch("/api/prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            category: item.category || "uncategorised",
            tags: item.tags || [],
            description: item.description || "",
            promptText: item.promptText,
            aliases: item.aliases || [],
            favorite: Boolean(item.favorite),
            source: "Imported into prompt library",
          }),
        });
        if (response.ok) imported += 1;
      }
      await loadPrompts();
      setToast(`${imported} prompt${imported === 1 ? "" : "s"} imported`);
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "The import could not be read.");
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
          {["all", "favorites", ...categories].map((item) => (
            <button
              key={item}
              className={category === item ? "active" : ""}
              onClick={() => selectCategory(item)}
            >
              <span className="nav-glyph" aria-hidden="true">
                <img src={iconFor(item)} alt="" width={26} height={26} loading="lazy" />
              </span>
              <span>{labels[item] ?? titleCaseCategory(item)}</span>
              <b>{counts[item] ?? 0}</b>
            </button>
          ))}
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
          <div className="profile-avatar avatar-crop" aria-hidden="true">
            <img src="/neen-avatar.jpg" alt="" />
          </div>
          <div>
            <strong>Nina</strong>
            <small>Mission Commander</small>
          </div>
        </div>
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
            <img src="/neen-avatar.jpg" alt="" />
          </div>
          <div className="hero-orbit orbit-one" aria-hidden="true" />
          <div className="hero-orbit orbit-two" aria-hidden="true" />
          <div className="hero-float" aria-hidden="true">
            <span className="hero-float-chip chip-a">
              <img src="/icons/writing.webp" alt="" loading="lazy" />
            </span>
            <span className="hero-float-chip chip-b">
              <img src="/icons/images.webp" alt="" loading="lazy" />
            </span>
            <span className="hero-float-chip chip-c">
              <img src="/icons/coding.webp" alt="" loading="lazy" />
            </span>
          </div>
        </section>

        <section className="category-links" aria-label="Quick category links">
          {["all", "favorites", ...categories].map((item) => (
            <button
              key={item}
              className={category === item ? "active" : ""}
              onClick={() => selectCategory(item)}
            >
              <span className="icon-tile" aria-hidden="true">
                <img src={iconFor(item)} alt="" width={34} height={34} loading="lazy" />
              </span>
              <strong>{labels[item] ?? titleCaseCategory(item)}</strong>
              <small>{counts[item] ?? 0}</small>
            </button>
          ))}
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
              <span className="icon-tile" aria-hidden="true">
                <img src="/icons/my-library.webp" alt="" width={30} height={30} loading="lazy" />
              </span>
              <strong>{prompts.length}</strong>
              <span>prompts</span>
              <small>View all ›</small>
            </button>
            <button
              type="button"
              className={libraryView === "categories" ? "active" : ""}
              onClick={openCategoryDirectory}
              aria-label={`Open the clickable list of ${categories.length} categories`}
            >
              <span className="icon-tile" aria-hidden="true">
                <img src="/icons/categories.webp" alt="" width={30} height={30} loading="lazy" />
              </span>
              <strong>{categories.length}</strong>
              <span>categories</span>
              <small>Browse ›</small>
            </button>
            <button
              type="button"
              className={libraryView === "featured" ? "active" : ""}
              onClick={openFeaturedPrompts}
              aria-label={`Open ${featuredCount} featured prompts`}
            >
              <span className="icon-tile" aria-hidden="true">
                <img src="/icons/featured.webp" alt="" width={30} height={30} loading="lazy" />
              </span>
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
                  <h2 id="category-directory-title">Categories</h2>
                  <p>Choose a category to see every prompt filed inside it.</p>
                </div>
                <button className="secondary-button" onClick={openAllPrompts}>
                  View all prompts
                </button>
              </div>
              <div className="category-directory-grid">
                {categories.map((item) => (
                  <button
                    key={item}
                    onClick={() => selectCategory(item)}
                    style={{ "--accent": accentFor(item) } as CSSProperties}
                  >
                    <span className="icon-tile directory-glyph" aria-hidden="true">
                      <img src={iconFor(item)} alt="" width={52} height={52} loading="lazy" />
                    </span>
                    <span>
                      <strong>{labels[item] ?? titleCaseCategory(item)}</strong>
                      <small>
                        {counts[item] ?? 0} {(counts[item] ?? 0) === 1 ? "prompt" : "prompts"}
                      </small>
                    </span>
                    <b aria-hidden="true">›</b>
                  </button>
                ))}
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
                  <span className="icon-tile mission-band-icon" aria-hidden="true">
                    <img src="/icons/featured.webp" alt="" width={44} height={44} loading="lazy" />
                  </span>
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
                      <div className="card-art" aria-hidden="true">
                        <img
                          className="card-art-watermark"
                          src={iconFor(prompt.category)}
                          alt=""
                          loading="lazy"
                        />
                        {prompt.featured && (
                          <span className="card-featured-flag">
                            <img src="/icons/featured.webp" alt="" loading="lazy" />
                          </span>
                        )}
                      </div>
                      <div className="card-body">
                        <div className="card-topline">
                          <span className="category-pill">
                            <span className="icon-tile" aria-hidden="true">
                              <img
                                src={iconFor(prompt.category)}
                                alt=""
                                width={18}
                                height={18}
                                loading="lazy"
                              />
                            </span>
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
                  <span aria-hidden="true">
                    <img src="/icons/search.webp" alt="" width={40} height={40} loading="lazy" />
                  </span>
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
                <span className="category-pill">
                  <span className="icon-tile" aria-hidden="true">
                    <img
                      src={iconFor(selected.category)}
                      alt=""
                      width={18}
                      height={18}
                      loading="lazy"
                    />
                  </span>
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
                  {categoryOrder.map((item) => (
                    <option value={item} key={item}>
                      {titleCaseCategory(item)}
                    </option>
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
