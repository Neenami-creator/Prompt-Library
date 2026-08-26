"use client";

import Image from "next/image";
import {
  ChangeEvent,
  CSSProperties,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  RefObject,
  useCallback,
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

type PaletteItem = {
  kind: "prompt" | "category" | "action";
  id: string;
  label: string;
  hint?: string;
  count?: number;
  run: () => void;
};

/**
 * Cheap subsequence-based fuzzy match: every character of `term` must appear
 * in `text`, in order, but not necessarily adjacent. Returns -1 for no match,
 * otherwise a score that rewards tight, early, consecutive matches so the
 * closest typo-tolerant results float to the top.
 */
function fuzzyScore(text: string, term: string): number {
  const t = text.toLowerCase();
  const q = term.toLowerCase();
  if (!q) return -1;
  let cursor = 0;
  let score = 0;
  let streak = 0;
  for (const char of q) {
    const found = t.indexOf(char, cursor);
    if (found === -1) return -1;
    streak = found === cursor ? streak + 1 : 0;
    score += 3 + streak;
    cursor = found + 1;
  }
  return score;
}

/** Wraps every case-insensitive occurrence of `term` in `text` with <mark>. */
function highlightMatches(text: string, term: string) {
  const trimmed = term.trim();
  if (!trimmed) return text;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  if (parts.length === 1) return text;
  return parts.map((part, index) =>
    part.toLowerCase() === trimmed.toLowerCase() ? (
      <mark key={index}>{part}</mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab/Shift+Tab focus inside a modal while it's open, focuses the first
 * focusable element on open, and returns focus to whatever triggered the
 * modal once it closes — so keyboard users never get dropped outside the
 * dialog or lose their place in the page underneath it.
 */
function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusFirst = () => {
      const focusable = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusable?.[0] ?? container)?.focus();
    };
    const raf = window.requestAnimationFrame(focusFirst);

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Tab" || !container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [active, containerRef]);
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
  const [statsOpen, setStatsOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [greeting, setGreeting] = useState(() => getAdelaideGreeting(new Date()));
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileName, setProfileName] = useState("Nina");
  const [profileTitle, setProfileTitle] = useState("Mission Commander");
  const [profileForm, setProfileForm] = useState<{ name: string; title: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [review, setReview] = useState<ReviewItem[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [favoriteOrder, setFavoriteOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(60);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const detailModalRef = useRef<HTMLElement>(null);
  const formModalRef = useRef<HTMLElement>(null);
  const profileModalRef = useRef<HTMLElement>(null);
  const reviewModalRef = useRef<HTMLElement>(null);
  const auditModalRef = useRef<HTMLElement>(null);
  const statsModalRef = useRef<HTMLElement>(null);
  const commandModalRef = useRef<HTMLElement>(null);

  useEffect(() => {
    void loadPrompts();
    void loadProfile();
  }, []);

  // Restore last-used filter/sort/view and favourite ordering from a previous
  // visit, so returning to the app resumes exactly where you left off.
  useEffect(() => {
    try {
      const rawFilters = window.localStorage.getItem("promptLibrary:filters");
      if (rawFilters) {
        const parsed = JSON.parse(rawFilters) as {
          category?: string;
          sort?: string;
          libraryView?: LibraryView;
        };
        if (parsed.category) setCategory(parsed.category);
        if (parsed.sort) setSort(parsed.sort);
        if (parsed.libraryView) setLibraryView(parsed.libraryView);
      }
      const rawOrder = window.localStorage.getItem("promptLibrary:favoriteOrder");
      if (rawOrder) setFavoriteOrder(JSON.parse(rawOrder) as string[]);
    } catch {
      // Corrupt or inaccessible storage — fall back to defaults silently.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "promptLibrary:filters",
        JSON.stringify({ category, sort, libraryView }),
      );
    } catch {
      // Best-effort only — never block the UI on storage failures.
    }
  }, [category, sort, libraryView]);

  useEffect(() => {
    try {
      window.localStorage.setItem("promptLibrary:favoriteOrder", JSON.stringify(favoriteOrder));
    } catch {
      // Best-effort only.
    }
  }, [favoriteOrder]);

  // Registers a service worker (production only) so the app shell can be
  // installed and reopened even without a network connection.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is a nice-to-have — never surface this to the user.
    });
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

  // Renders results incrementally instead of all at once — a lighter-weight
  // substitute for full list virtualization that needs no extra dependency
  // and keeps the existing card grid layout untouched.
  useEffect(() => {
    setVisibleCount(60);
  }, [search, category, sort, libraryView]);

  const loadMoreObserverRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    loadMoreObserverRef.current?.disconnect();
    if (!node) return;
    // Created once per sentinel mount (not on every visibleCount change) —
    // recreating this on each increment made it re-fire immediately in a
    // tight cascade on large libraries, since the sentinel is almost always
    // already within the rootMargin.
    loadMoreObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisibleCount((count) => count + 60);
      },
      { rootMargin: "300px" },
    );
    loadMoreObserverRef.current.observe(node);
  }, []);

  useEffect(() => {
    if (commandOpen) {
      setCommandQuery("");
      setCommandIndex(0);
    }
  }, [commandOpen]);

  // Global keyboard shortcuts: Cmd/Ctrl+K for the command palette, Escape to
  // close whichever modal is topmost, "/" to jump into search, and
  // arrow/f/c for navigating and acting on a focused prompt card.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = Boolean(
        target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName),
      );

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
        return;
      }

      if (event.key === "Escape") {
        if (commandOpen) setCommandOpen(false);
        else if (review) setReview(null);
        else if (form) setForm(null);
        else if (profileForm) setProfileForm(null);
        else if (selected) setSelected(null);
        else if (statsOpen) setStatsOpen(false);
        else if (auditOpen) setAuditOpen(false);
        return;
      }

      if (isTyping || commandOpen) return;

      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      const card = target?.closest?.(".prompt-card") as HTMLElement | null;
      if (!card) return;
      const cards = Array.from(document.querySelectorAll<HTMLElement>(".prompt-card"));
      const index = cards.indexOf(card);

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        cards[index + 1]?.focus();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        cards[index - 1]?.focus();
      } else if (event.key.toLowerCase() === "f") {
        const id = card.dataset.promptId;
        const prompt = prompts.find((item) => item.id === id);
        if (prompt) void toggleFavourite(prompt);
      } else if (event.key.toLowerCase() === "c") {
        const id = card.dataset.promptId;
        const prompt = prompts.find((item) => item.id === id);
        if (prompt) void copyPrompt(prompt);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [commandOpen, review, form, profileForm, selected, statsOpen, auditOpen, prompts]);

  useFocusTrap(Boolean(selected), detailModalRef);
  useFocusTrap(Boolean(form), formModalRef);
  useFocusTrap(Boolean(profileForm), profileModalRef);
  useFocusTrap(Boolean(review), reviewModalRef);
  useFocusTrap(auditOpen, auditModalRef);
  useFocusTrap(statsOpen, statsModalRef);
  useFocusTrap(commandOpen, commandModalRef);

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

  async function loadProfile() {
    try {
      const response = await fetch("/api/profile");
      if (!response.ok) return;
      const data = (await response.json()) as { name?: string; title?: string };
      if (data.name) setProfileName(data.name);
      if (data.title) setProfileTitle(data.title);
    } catch {
      // Personalisation is optional polish — keep the defaults if this fails.
    }
  }

  function openProfileEdit() {
    setProfileForm({ name: profileName, title: profileTitle });
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!profileForm) return;
    const name = profileForm.name.trim();
    const title = profileForm.title.trim();
    if (!name) {
      setToast("Add a name first.");
      return;
    }

    setSavingProfile(true);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, title }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "The profile could not be saved.");
      setProfileName(name);
      setProfileTitle(title || "Mission Commander");
      setProfileForm(null);
      setToast("Profile updated");
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "The profile could not be saved.");
    } finally {
      setSavingProfile(false);
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

  function matchesActiveScope(prompt: Prompt) {
    const matchesCategory =
      category === "all" ||
      (category === "favorites" && prompt.favorite) ||
      (category.startsWith("group:")
        ? groupKeyFor(prompt.category) === category.slice(6)
        : prompt.category === category);
    if (!matchesCategory) return false;
    if (libraryView === "featured" && !prompt.featured) return false;
    return true;
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const result = prompts.filter((prompt) => {
      if (!matchesActiveScope(prompt)) return false;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompts, category, search, sort, libraryView]);

  /**
   * When the exact substring search comes up empty, fall back to a
   * typo-tolerant subsequence match on title/tags rather than showing
   * nothing — this is what makes a slightly misspelled search still useful.
   */
  const fuzzyMatches = useMemo(() => {
    const term = search.trim();
    if (term.length < 2 || filtered.length > 0) return [];
    return prompts
      .filter((prompt) => matchesActiveScope(prompt))
      .map((prompt) => ({
        prompt,
        score: fuzzyScore(`${prompt.title} ${prompt.tags.join(" ")}`, term),
      }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.prompt)
      .slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompts, search, category, libraryView, filtered.length]);

  const usingFuzzy = filtered.length === 0 && fuzzyMatches.length > 0;
  const baseResults = usingFuzzy ? fuzzyMatches : filtered;

  /** Applies your manual favourites ordering (drag-to-reorder) when browsing favourites. */
  const orderedResults = useMemo(() => {
    if (category !== "favorites" || !favoriteOrder.length) return baseResults;
    const orderIndex = new Map(favoriteOrder.map((id, index) => [id, index]));
    return [...baseResults].sort((a, b) => {
      const ai = orderIndex.has(a.id) ? (orderIndex.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.has(b.id) ? (orderIndex.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseResults, favoriteOrder, category]);

  const visiblePrompts = orderedResults.slice(0, visibleCount);
  const hasMore = orderedResults.length > visiblePrompts.length;

  /**
   * What the person is actually reaching for, derived entirely from the
   * copy-count/last-copied data already tracked per prompt — no extra
   * tracking needed.
   */
  const usageStats = useMemo(() => {
    const totalCopies = prompts.reduce((sum, prompt) => sum + prompt.copyCount, 0);
    const usedCount = prompts.filter((prompt) => prompt.copyCount > 0).length;

    const topPrompts = [...prompts]
      .filter((prompt) => prompt.copyCount > 0)
      .sort((a, b) => b.copyCount - a.copyCount)
      .slice(0, 8);

    const recentlyUsed = [...prompts]
      .filter((prompt) => prompt.lastCopiedAt)
      .sort(
        (a, b) =>
          new Date(b.lastCopiedAt as string).getTime() -
          new Date(a.lastCopiedAt as string).getTime(),
      )
      .slice(0, 5);

    const byGroup = new Map<
      string,
      { key: string; label: string; accent: string; copies: number }
    >();
    for (const prompt of prompts) {
      if (!prompt.copyCount) continue;
      const key = groupKeyFor(prompt.category);
      const group = groupFor(key);
      const entry = byGroup.get(key) ?? {
        key,
        label: group?.label ?? "Other",
        accent: group?.accent ?? "#7140a6",
        copies: 0,
      };
      entry.copies += prompt.copyCount;
      byGroup.set(key, entry);
    }
    const groupBreakdown = [...byGroup.values()].sort((a, b) => b.copies - a.copies);
    const maxGroupCopies = groupBreakdown[0]?.copies ?? 0;

    return {
      totalCopies,
      usedCount,
      unusedCount: prompts.length - usedCount,
      topPrompts,
      recentlyUsed,
      groupBreakdown,
      maxGroupCopies,
    };
  }, [prompts]);

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

  function toggleSelectMode() {
    setSelectMode((value) => !value);
    setSelectedIds([]);
  }

  function toggleSelectId(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  /** Sets favourite status on every selected prompt via the existing PATCH endpoint — no new API. */
  async function bulkSetFavourite(next: boolean) {
    if (!selectedIds.length) return;
    setBulkWorking(true);
    const ids = [...selectedIds];
    setPrompts((items) =>
      items.map((item) => (ids.includes(item.id) ? { ...item, favorite: next } : item)),
    );
    try {
      await Promise.all(
        ids.map((id) =>
          fetch("/api/prompts", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, favorite: next }),
          }),
        ),
      );
      setToast(
        next
          ? `Added ${ids.length} prompt${ids.length === 1 ? "" : "s"} to favourites`
          : `Removed ${ids.length} prompt${ids.length === 1 ? "" : "s"} from favourites`,
      );
    } catch {
      setToast("Some favourites could not be saved.");
      void loadPrompts();
    } finally {
      setBulkWorking(false);
      clearSelection();
    }
  }

  function bulkExportSelected() {
    if (!selectedIds.length) return;
    const chosen = prompts.filter((prompt) => selectedIds.includes(prompt.id));
    const content = JSON.stringify(
      chosen.map(
        ({ id, title, category: promptCategory, tags, description, promptText, aliases, favorite }) => ({
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
    download(`Prompt-Library-Selection-${chosen.length}.json`, content, "application/json");
    setToast(`Exported ${chosen.length} selected prompt${chosen.length === 1 ? "" : "s"}`);
  }

  function handleFavouriteDragStart(id: string) {
    setDragId(id);
  }

  function handleFavouriteDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
  }

  function handleFavouriteDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    setFavoriteOrder((current) => {
      const base = current.length ? current : orderedResults.map((prompt) => prompt.id);
      const withoutDragged = base.filter((id) => id !== dragId);
      const targetIndex = withoutDragged.indexOf(targetId);
      const next = [...withoutDragged];
      next.splice(targetIndex === -1 ? next.length : targetIndex, 0, dragId);
      return next;
    });
    setDragId(null);
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
    download("Prompt-Library.md", `# Prompt Library\n\n${content}`, "text/markdown");
    setToast("Markdown export downloaded");
  }

  const paletteResults = useMemo<PaletteItem[]>(() => {
    const term = commandQuery.trim().toLowerCase();

    const quickActions: PaletteItem[] = [
      { kind: "action", id: "add", label: "Add a new prompt", run: () => setForm(emptyForm) },
      { kind: "action", id: "all", label: "Show all prompts", run: () => openAllPrompts() },
      { kind: "action", id: "favourites", label: "Show favourites", run: () => selectCategory("favorites") },
      { kind: "action", id: "featured", label: "Show featured prompts", run: () => openFeaturedPrompts() },
      { kind: "action", id: "stats", label: "Open usage stats", run: () => setStatsOpen(true) },
      { kind: "action", id: "audit", label: "Open consolidation audit", run: () => setAuditOpen(true) },
      { kind: "action", id: "export-json", label: "Export library as JSON", run: () => exportJson() },
      { kind: "action", id: "export-md", label: "Export library as Markdown", run: () => exportMarkdown() },
      {
        kind: "action",
        id: "select",
        label: selectMode ? "Turn off multi-select" : "Select multiple prompts",
        run: () => toggleSelectMode(),
      },
    ];

    const categoryActions: PaletteItem[] = categoryGroups
      .filter((group) => categories.some((item) => groupKeyFor(item) === group.key))
      .map((group) => {
        const groupCategories = categories.filter((item) => groupKeyFor(item) === group.key);
        const count = groupCategories.reduce((sum, item) => sum + (counts[item] ?? 0), 0);
        return {
          kind: "category" as const,
          id: `group:${group.key}`,
          label: `Category: ${group.label}`,
          count,
          run: () => selectCategory(`group:${group.key}`),
        };
      });

    const promptActions: PaletteItem[] = term
      ? prompts
          .map((prompt) => ({
            prompt,
            score: Math.max(
              `${prompt.title} ${prompt.tags.join(" ")}`.toLowerCase().includes(term) ? 999 : -1,
              fuzzyScore(prompt.title, term),
            ),
          }))
          .filter((entry) => entry.score >= 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
          .map(({ prompt }) => ({
            kind: "prompt" as const,
            id: prompt.id,
            label: prompt.title,
            hint: titleCaseCategory(prompt.category),
            run: () => {
              setSelected(prompt);
              setCommandOpen(false);
            },
          }))
      : [];

    if (!term) return [...promptActions, ...quickActions, ...categoryActions].slice(0, 10);

    const matchingActions = [...quickActions, ...categoryActions].filter((item) =>
      item.label.toLowerCase().includes(term),
    );
    return [...promptActions, ...matchingActions].slice(0, 10);
  }, [commandQuery, prompts, categories, counts, selectMode]);

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
          <Image
            className="brand-logo"
            src="/icons/prompt-library-logo.svg"
            alt="Prompt Library"
            width={56}
            height={56}
            priority
          />
          <div className="brand-title">PROMPT LIBRARY</div>
          <button
            className="sidebar-close"
            onClick={() => setMobileNav(false)}
            aria-label="Close categories"
          >
            ×
          </button>
        </div>

        <nav className="category-nav" aria-label="Prompt categories">
          <h2 className="nav-label">LIBRARY</h2>
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

          <h2 className="nav-label nav-label-groups">CATEGORIES</h2>
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
            const isGroupActive = category === `group:${group.key}`;
            return (
              <div className={`nav-group ${isExpanded ? "is-expanded" : ""}`} key={group.key}>
                <button
                  type="button"
                  className={`nav-group-header ${isGroupActive ? "is-active" : ""}`}
                  style={{ "--accent": group.accent } as CSSProperties}
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={isExpanded}
                  aria-label={
                    isExpanded ? `Collapse ${group.label} subcategories` : `Expand ${group.label} subcategories`
                  }
                >
                  <span className="nav-group-dot" aria-hidden="true" />
                  <span>{group.label}</span>
                  <b>{groupCount}</b>
                  <span className="nav-chevron" aria-hidden="true">⌄</span>
                </button>
                <div className="nav-subcategories">
                  <div>
                    <button
                      className={`nav-view-all ${isGroupActive ? "active" : ""}`}
                      onClick={() => selectCategory(`group:${group.key}`)}
                    >
                      <span>View all {group.label}</span>
                      <b>{groupCount}</b>
                    </button>
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
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-audit">
          <h2 className="nav-label">LIBRARY STATUS</h2>
          <button onClick={() => setAuditOpen(true)} className="audit-summary">
            <span className="status-dot" />
            <span>
              <strong>{prompts.length} prompts secured</strong>
              <small>View consolidation audit</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
          <button
            onClick={() => {
              setStatsOpen(true);
              setMobileNav(false);
            }}
            className="audit-summary"
          >
            <span className="status-dot" />
            <span>
              <strong>Usage stats</strong>
              <small>What you&apos;re actually using</small>
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
            <strong>{profileName}</strong>
            <small>{profileTitle}</small>
            <div className="profile-links">
              <button
                type="button"
                className="avatar-change-link"
                onClick={() => avatarInputRef.current?.click()}
              >
                {avatarUploading ? "Uploading…" : "Change photo"}
              </button>
              <span aria-hidden="true">·</span>
              <button type="button" className="avatar-change-link" onClick={openProfileEdit}>
                Edit name
              </button>
            </div>
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
            <Image
              className="mobile-brand-logo"
              src="/icons/prompt-library-logo.svg"
              alt=""
              width={32}
              height={32}
              priority
            />
            <span>PROMPT LIBRARY</span>
          </div>
          <div className="topbar-context" aria-label="Current location">
            <span>LIBRARY</span>
            <b>/</b>
            <strong>PROMPT LIBRARY</strong>
          </div>
          <div className="top-actions">
            <button
              type="button"
              className="command-trigger"
              onClick={() => setCommandOpen(true)}
              aria-label="Open command palette"
            >
              <span aria-hidden="true">⌕</span>
              <span className="command-trigger-label">Quick search</span>
              <kbd aria-hidden="true">⌘K</kbd>
            </button>
            <span className="topbar-greeting">
              {greeting}, {profileName}
            </span>
            <button className="text-button" onClick={() => setStatsOpen(true)}>
              Usage stats
            </button>
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
            <p className="hero-greeting">
              {greeting}, {profileName}.
            </p>
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
            <h2>Prompt Library</h2>
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
                    ref={searchInputRef}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search titles, prompt text, tags or aliases… (press /)"
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
                  <strong>{orderedResults.length}</strong>
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
                <button
                  type="button"
                  className={`select-toggle ${selectMode ? "active" : ""}`}
                  onClick={toggleSelectMode}
                  aria-pressed={selectMode}
                >
                  {selectMode ? "Done selecting" : "Select"}
                </button>
              </section>

              {usingFuzzy && (
                <p className="fuzzy-hint">
                  No exact match — showing close results for “{search.trim()}”.
                </p>
              )}

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
              ) : visiblePrompts.length ? (
                <>
                  <section className="prompt-grid" aria-label="Prompt results">
                    {visiblePrompts.map((prompt, index) => (
                      <article
                        className={`prompt-card ${prompt.featured ? "featured" : ""} ${
                          selectMode && selectedIds.includes(prompt.id) ? "is-selected" : ""
                        } ${dragId === prompt.id ? "is-dragging" : ""}`}
                        data-category={prompt.category}
                        data-prompt-id={prompt.id}
                        key={prompt.id}
                        role="button"
                        tabIndex={0}
                        style={{ animationDelay: `${Math.min(index, 14) * 30}ms` } as CSSProperties}
                        draggable={category === "favorites" && !selectMode}
                        onDragStart={() => handleFavouriteDragStart(prompt.id)}
                        onDragOver={handleFavouriteDragOver}
                        onDrop={() => handleFavouriteDrop(prompt.id)}
                        onClick={() =>
                          selectMode ? toggleSelectId(prompt.id) : setSelected(prompt)
                        }
                        onKeyDown={(event) => handleCardKey(event, prompt)}
                      >
                        {selectMode && (
                          <span
                            className={`card-checkbox ${selectedIds.includes(prompt.id) ? "checked" : ""}`}
                            aria-hidden="true"
                          >
                            {selectedIds.includes(prompt.id) ? "✓" : ""}
                          </span>
                        )}
                        <div
                          className="card-art"
                          aria-hidden="true"
                          style={{ "--accent": accentFor(prompt.category) } as CSSProperties}
                        >
                          {prompt.featured && <span className="card-featured-flag">★ Featured</span>}
                          {category === "favorites" && !selectMode && (
                            <span className="drag-handle" aria-hidden="true">⠿</span>
                          )}
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
                          <h2>
                            {usingFuzzy || !search
                              ? prompt.title
                              : highlightMatches(prompt.title, search)}
                          </h2>
                          <p>
                            {usingFuzzy || !search
                              ? prompt.description
                              : highlightMatches(prompt.description, search)}
                          </p>
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
                              className={copiedId === prompt.id ? "copy-success" : ""}
                              onClick={(event) => {
                                event.stopPropagation();
                                void copyPrompt(prompt);
                                setCopiedId(prompt.id);
                                window.setTimeout(
                                  () => setCopiedId((id) => (id === prompt.id ? null : id)),
                                  1400,
                                );
                              }}
                            >
                              {copiedId === prompt.id ? (
                                <>Copied ✓</>
                              ) : (
                                <>
                                  Copy prompt <span aria-hidden="true">↗</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </section>
                  {hasMore && <div ref={loadMoreRef} className="load-more-sentinel" aria-hidden="true" />}
                </>
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
          <span>Prompt Library</span>
          <span>
            {recoveredCount} recovered · {prompts.length - recoveredCount} rebuilt or added
          </span>
        </footer>
      </main>

      {selected && (
        <div className="modal-layer" role="presentation" onMouseDown={() => setSelected(null)}>
          <section
            className="detail-modal"
            ref={detailModalRef as RefObject<HTMLElement>}
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

      {profileForm && (
        <div className="modal-layer" role="presentation" onMouseDown={() => setProfileForm(null)}>
          <form
            className="form-modal form-modal--narrow"
            ref={(node) => {
              profileModalRef.current = node;
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-form-title"
            onSubmit={saveProfile}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">YOUR PROFILE</p>
                <h2 id="profile-form-title">Make this yours</h2>
              </div>
              <button
                type="button"
                className="close-button"
                aria-label="Close"
                onClick={() => setProfileForm(null)}
              >
                ×
              </button>
            </header>
            <div className="form-grid">
              <label className="wide">
                <span>Display name</span>
                <input
                  value={profileForm.name}
                  onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
                  placeholder="e.g. Shane"
                  autoFocus
                />
              </label>
              <label className="wide">
                <span>Title</span>
                <input
                  value={profileForm.title}
                  onChange={(event) => setProfileForm({ ...profileForm, title: event.target.value })}
                  placeholder="e.g. Mission Commander"
                />
              </label>
            </div>
            <p className="profile-form-note">
              Want a different photo too? Close this and use “Change photo” under your name
              in the sidebar.
            </p>
            <footer>
              <button type="button" className="secondary-button" onClick={() => setProfileForm(null)}>
                Cancel
              </button>
              <button className="primary-button" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {form && (
        <div className="modal-layer" role="presentation" onMouseDown={() => setForm(null)}>
          <form
            className="form-modal"
            ref={(node) => {
              formModalRef.current = node;
            }}
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
            ref={reviewModalRef as RefObject<HTMLElement>}
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
            ref={auditModalRef as RefObject<HTMLElement>}
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

      {statsOpen && (
        <div
          className="modal-layer audit-layer"
          role="presentation"
          onMouseDown={() => setStatsOpen(false)}
        >
          <aside
            className="audit-drawer"
            ref={statsModalRef as RefObject<HTMLElement>}
            role="dialog"
            aria-modal="true"
            aria-labelledby="stats-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">USAGE STATS</p>
                <h2 id="stats-title">What you&apos;re actually using</h2>
              </div>
              <button className="close-button" onClick={() => setStatsOpen(false)} aria-label="Close">
                ×
              </button>
            </header>
            <p className="audit-intro">
              Built from every copy made in this library — the clearest signal of which
              prompts are earning their place.
            </p>

            <div className="audit-score">
              <strong>{usageStats.totalCopies}</strong>
              <span>total copies made</span>
            </div>

            <div className="stats-summary-row">
              <div>
                <strong>{usageStats.usedCount}</strong>
                <small>used at least once</small>
              </div>
              <div>
                <strong>{usageStats.unusedCount}</strong>
                <small>never copied yet</small>
              </div>
            </div>

            <h3 className="stats-subheading">Most copied</h3>
            {usageStats.topPrompts.length ? (
              <div className="stats-list">
                {usageStats.topPrompts.map((prompt, index) => (
                  <button
                    key={prompt.id}
                    type="button"
                    className="stats-row"
                    onClick={() => {
                      setStatsOpen(false);
                      setSelected(prompt);
                    }}
                  >
                    <span className="stats-rank">{index + 1}</span>
                    <span className="stats-row-body">
                      <strong>{prompt.title}</strong>
                      <small>{titleCaseCategory(prompt.category)}</small>
                    </span>
                    <b>{prompt.copyCount}×</b>
                  </button>
                ))}
              </div>
            ) : (
              <p className="stats-empty">
                Nothing copied yet — start copying prompts and they&apos;ll show up here.
              </p>
            )}

            {usageStats.groupBreakdown.length > 0 && (
              <>
                <h3 className="stats-subheading">By category</h3>
                <div className="stats-bars">
                  {usageStats.groupBreakdown.slice(0, 8).map((group) => (
                    <div className="stats-bar-row" key={group.key}>
                      <span>{group.label}</span>
                      <div className="stats-bar-track">
                        <div
                          className="stats-bar-fill"
                          style={
                            {
                              width: `${Math.max(
                                4,
                                (group.copies / (usageStats.maxGroupCopies || 1)) * 100,
                              )}%`,
                              background: group.accent,
                            } as CSSProperties
                          }
                        />
                      </div>
                      <b>{group.copies}</b>
                    </div>
                  ))}
                </div>
              </>
            )}

            {usageStats.recentlyUsed.length > 0 && (
              <>
                <h3 className="stats-subheading">Recently used</h3>
                <div className="stats-list">
                  {usageStats.recentlyUsed.map((prompt) => (
                    <button
                      key={prompt.id}
                      type="button"
                      className="stats-row"
                      onClick={() => {
                        setStatsOpen(false);
                        setSelected(prompt);
                      }}
                    >
                      <span className="stats-row-body">
                        <strong>{prompt.title}</strong>
                        <small>
                          {prompt.lastCopiedAt
                            ? new Date(prompt.lastCopiedAt).toLocaleDateString("en-AU", {
                                day: "numeric",
                                month: "short",
                              })
                            : ""}
                        </small>
                      </span>
                      <b>{prompt.copyCount}×</b>
                    </button>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {selectMode && selectedIds.length > 0 && (
        <div className="bulk-bar" role="toolbar" aria-label="Bulk actions">
          <span>{selectedIds.length} selected</span>
          <div className="bulk-bar-actions">
            <button disabled={bulkWorking} onClick={() => void bulkSetFavourite(true)}>
              ★ Favourite
            </button>
            <button disabled={bulkWorking} onClick={() => void bulkSetFavourite(false)}>
              ☆ Unfavourite
            </button>
            <button disabled={bulkWorking} onClick={bulkExportSelected}>
              Export selected
            </button>
            <button className="subtle-button" onClick={clearSelection}>
              Clear
            </button>
          </div>
        </div>
      )}

      {commandOpen && (
        <div
          className="modal-layer command-layer"
          role="presentation"
          onMouseDown={() => setCommandOpen(false)}
        >
          <div
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            ref={commandModalRef as RefObject<HTMLDivElement>}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="command-input-row">
              <span aria-hidden="true">⌘K</span>
              <input
                ref={commandInputRef}
                value={commandQuery}
                onChange={(event) => {
                  setCommandQuery(event.target.value);
                  setCommandIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setCommandIndex((index) => Math.min(index + 1, paletteResults.length - 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setCommandIndex((index) => Math.max(index - 1, 0));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    paletteResults[commandIndex]?.run();
                  }
                }}
                placeholder="Search prompts, categories, or actions…"
                aria-label="Command palette search"
              />
            </div>
            <div className="command-results" role="listbox">
              {paletteResults.length ? (
                paletteResults.map((item, index) => (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === commandIndex}
                    className={index === commandIndex ? "active" : ""}
                    onMouseEnter={() => setCommandIndex(index)}
                    onClick={() => item.run()}
                  >
                    <span>{item.label}</span>
                    {item.hint && <small>{item.hint}</small>}
                    {typeof item.count === "number" && <b>{item.count}</b>}
                  </button>
                ))
              ) : (
                <p className="command-empty">No matches. Try a different word.</p>
              )}
            </div>
          </div>
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
