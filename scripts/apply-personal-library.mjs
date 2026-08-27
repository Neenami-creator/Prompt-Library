import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.cwd(), "app/prompt-library.tsx");
let source = readFileSync(file, "utf8");

if (!source.includes("promptLibrary:personalPrompts")) {
  source = source.replace(
    '  const [savingProfile, setSavingProfile] = useState(false);',
    '  const [savingProfile, setSavingProfile] = useState(false);\n  const [localAvatar, setLocalAvatar] = useState<string | null>(null);\n  const [hiddenPromptIds, setHiddenPromptIds] = useState<string[]>([]);',
  );

  source = source.replace(
    '    void loadProfile();',
    '    loadLocalPersonalisation();',
  );

  source = source.replace(
    '  async function loadProfile() {',
    `  const PERSONAL_PROMPTS_KEY = "promptLibrary:personalPrompts";
  const HIDDEN_PROMPTS_KEY = "promptLibrary:hiddenPromptIds";
  const FAVOURITES_KEY = "promptLibrary:favourites";
  const PROFILE_KEY = "promptLibrary:profile";
  const AVATAR_KEY = "promptLibrary:avatar";\n  const USAGE_EVENTS_KEY = "promptLibrary:usageEvents";

  function readJson<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key: string, value: unknown) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      setToast("This browser could not save that personal change.");
    }
  }

  function mergePersonalLibrary(master: Prompt[]) {
    const personal = readJson<Prompt[]>(PERSONAL_PROMPTS_KEY, []);
    const hidden = new Set(readJson<string[]>(HIDDEN_PROMPTS_KEY, []));
    const favourites = new Set(readJson<string[]>(FAVOURITES_KEY, []));
    const usageEvents = readJson<{ id: string; promptId: string; at: string }[]>(USAGE_EVENTS_KEY, []);
    const usage = new Map<string, { copyCount: number; lastCopiedAt: string | null }>();

    for (const event of usageEvents) {
      if (!event?.promptId || !event?.at) continue;
      const current = usage.get(event.promptId) ?? { copyCount: 0, lastCopiedAt: null };
      current.copyCount += 1;
      if (!current.lastCopiedAt || event.at > current.lastCopiedAt) current.lastCopiedAt = event.at;
      usage.set(event.promptId, current);
    }

    const applyPersonalState = (prompt: Prompt) => {
      const stats = usage.get(prompt.id);
      return {
        ...prompt,
        favorite: favourites.has(prompt.id) || (prompt.id.startsWith("local-") && prompt.favorite),
        copyCount: stats?.copyCount ?? 0,
        lastCopiedAt: stats?.lastCopiedAt ?? null,
      };
    };

    return [
      ...master.filter((prompt) => !hidden.has(prompt.id)).map(applyPersonalState),
      ...personal.map(applyPersonalState),
    ];
  }

  function loadLocalPersonalisation() {
    const savedProfile = readJson<{ name?: string; title?: string }>(PROFILE_KEY, {});
    if (savedProfile.name?.trim()) setProfileName(savedProfile.name.trim());
    if (savedProfile.title?.trim()) setProfileTitle(savedProfile.title.trim());

    try {
      const avatar = window.localStorage.getItem(AVATAR_KEY);
      if (avatar) setLocalAvatar(avatar);
    } catch {}

    setHiddenPromptIds(readJson<string[]>(HIDDEN_PROMPTS_KEY, []));
  }

  function persistPersonalPrompts(next: Prompt[]) {
    writeJson(PERSONAL_PROMPTS_KEY, next.filter((prompt) => prompt.id.startsWith("local-")));
  }

  function restoreHiddenPrompts() {
    writeJson(HIDDEN_PROMPTS_KEY, []);
    setHiddenPromptIds([]);
    void loadPrompts();
    setToast("Hidden library prompts restored");
  }

  async function loadProfile() {`,
  );

  // Keep the old remote profile helper unused for backwards compatibility,
  // but save profile changes only to this browser.
  source = source.replace(
    /  async function saveProfile\(event: FormEvent\) \{[\s\S]*?\n  \}\n\n  const categories/,
    `  async function saveProfile(event: FormEvent) {
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
      writeJson(PROFILE_KEY, { name, title: title || "Mission Commander" });
      setProfileName(name);
      setProfileTitle(title || "Mission Commander");
      setProfileForm(null);
      setToast("Profile updated on this device");
    } finally {
      setSavingProfile(false);
    }
  }

  const categories`,
  );

  source = source.replace(
    /  async function uploadAvatar\(event: ChangeEvent<HTMLInputElement>\) \{[\s\S]*?\n  \}\n\n  function openAllPrompts/,
    `  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToast("Choose an image file.");
      return;
    }

    setAvatarUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 560, 0.84);
      window.localStorage.setItem(AVATAR_KEY, dataUrl);
      setLocalAvatar(dataUrl);
      setAvatarVersion((value) => value + 1);
      setToast("Photo updated on this device");
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "The photo could not be saved.");
    } finally {
      setAvatarUploading(false);
    }
  }

  function openAllPrompts`,
  );

  source = source.replace(
    /  async function savePrompt\(event: FormEvent\) \{[\s\S]*?\n  \}\n\n  async function archivePrompt/,
    `  async function savePrompt(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    if (!form.title.trim() || !form.promptText.trim()) {
      setToast("Add a title and full prompt first.");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const existing = form.id ? prompts.find((prompt) => prompt.id === form.id) : null;
      const personal = prompts.filter((prompt) => prompt.id.startsWith("local-"));

      const personalPrompt: Prompt = {
        id: existing?.id.startsWith("local-") ? existing.id : "local-" + crypto.randomUUID(),
        title: form.title.trim(),
        category: form.category.trim().toLowerCase() || "uncategorised",
        tags: listFromText(form.tags),
        description: form.description.trim(),
        promptText: form.promptText.trim(),
        source: "My prompt",
        recoveryStatus: "added",
        aliases: existing?.aliases ?? [],
        featured: false,
        favorite: existing?.favorite ?? false,
        archived: false,
        copyCount: existing?.copyCount ?? 0,
        lastCopiedAt: existing?.lastCopiedAt ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      let nextPersonal = personal.filter((prompt) => prompt.id !== personalPrompt.id);
      nextPersonal = [...nextPersonal, personalPrompt];
      writeJson(PERSONAL_PROMPTS_KEY, nextPersonal);

      if (existing && !existing.id.startsWith("local-")) {
        const hidden = new Set(readJson<string[]>(HIDDEN_PROMPTS_KEY, []));
        hidden.add(existing.id);
        const nextHidden = [...hidden];
        writeJson(HIDDEN_PROMPTS_KEY, nextHidden);
        setHiddenPromptIds(nextHidden);
        setPrompts((items) => [
          ...items.filter((item) => item.id !== existing.id && item.id !== personalPrompt.id),
          personalPrompt,
        ]);
        setToast("Saved as your personal version");
      } else {
        setPrompts((items) => [
          ...items.filter((item) => item.id !== personalPrompt.id),
          personalPrompt,
        ]);
        setToast(existing ? "My prompt updated" : "Added to my library");
      }

      setForm(null);
    } finally {
      setSaving(false);
    }
  }

  async function archivePrompt`,
  );

  source = source.replace(
    /  async function archivePrompt\(prompt: Prompt\) \{[\s\S]*?\n  \}\n\n  async function exportJson/,
    `  async function archivePrompt(prompt: Prompt) {
    if (prompt.id.startsWith("local-")) {
      const personal = readJson<Prompt[]>(PERSONAL_PROMPTS_KEY, []).filter(
        (item) => item.id !== prompt.id,
      );
      writeJson(PERSONAL_PROMPTS_KEY, personal);
      setPrompts((items) => items.filter((item) => item.id !== prompt.id));
      setSelected(null);
      setToast("Personal prompt deleted");
      return;
    }

    const hidden = new Set(readJson<string[]>(HIDDEN_PROMPTS_KEY, []));
    hidden.add(prompt.id);
    const nextHidden = [...hidden];
    writeJson(HIDDEN_PROMPTS_KEY, nextHidden);
    setHiddenPromptIds(nextHidden);
    setPrompts((items) => items.filter((item) => item.id !== prompt.id));
    setSelected(null);
    setToast("Removed from my library");
  }

  async function exportJson`,
  );

  source = source.replace(
    /  async function toggleFavourite\(prompt: Prompt\) \{[\s\S]*?\n  \}\n\n  function toggleSelectMode/,
    `  async function toggleFavourite(prompt: Prompt) {
    const next = !prompt.favorite;
    const favourites = new Set(readJson<string[]>(FAVOURITES_KEY, []));
    if (next) favourites.add(prompt.id);
    else favourites.delete(prompt.id);
    writeJson(FAVOURITES_KEY, [...favourites]);

    setPrompts((items) =>
      items.map((item) => (item.id === prompt.id ? { ...item, favorite: next } : item)),
    );
    if (selected?.id === prompt.id) setSelected({ ...prompt, favorite: next });
  }

  function toggleSelectMode`,
  );

  // Apply local overlays to both lightweight and hydrated master responses.
  source = source.replace(
    '      setPrompts(data.prompts ?? []);',
    '      setPrompts(mergePersonalLibrary(data.prompts ?? []));',
  );
  source = source.replace(
    '      setPrompts(fullPrompts);',
    '      setPrompts(mergePersonalLibrary(fullPrompts));',
  );

  // Local avatar everywhere; shared avatar remains the default.
  source = source.replaceAll(
    'src={`/api/icon/neen-avatar.jpg?v=${avatarVersion}`}',
    'src={localAvatar || `/api/icon/neen-avatar.jpg?v=${avatarVersion}`}',
  );

  // Make the origin of personal prompts visible without adding UI clutter.
  source = source.replace(
    '{titleCaseCategory(prompt.category)}\n                            </span>',
    '{prompt.id.startsWith("local-") ? "My prompt · " : ""}{titleCaseCategory(prompt.category)}\n                            </span>',
  );

  // Master prompts are hidden locally; personal prompts are genuinely deleted.
  source = source.replace(
    '<button className="subtle-button danger" onClick={() => void archivePrompt(selected)}>\n                  Archive\n                </button>',
    '<button className="subtle-button danger" onClick={() => void archivePrompt(selected)}>\n                  {selected.id.startsWith("local-") ? "Delete prompt" : "Remove from my library"}\n                </button>',
  );

  // Remote JSON import is intentionally not exposed in public personal mode.
  source = source.replace(
    '<button onClick={() => importRef.current?.click()}>Import JSON</button>',
    '',
  );

  // Give users a way to undo local hiding.
  source = source.replace(
    '<button type="button" className="avatar-change-link" onClick={openProfileEdit}>\n                Edit name\n              </button>',
    '<button type="button" className="avatar-change-link" onClick={openProfileEdit}>\n                Edit name\n              </button>\n              {hiddenPromptIds.length > 0 && (<>\n                <span aria-hidden="true">·</span>\n                <button type="button" className="avatar-change-link" onClick={restoreHiddenPrompts}>Restore prompts</button>\n              </>)}',
  );

  const checks = {
    storage: source.includes("promptLibrary:personalPrompts"),
    remove: source.includes("Removed from my library"),
    photo: source.includes("Photo updated on this device"),
    merge: source.includes("mergePersonalLibrary"),
    usage: source.includes("promptLibrary:usageEvents"),
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) {
    throw new Error(`Local personal-library transform did not apply cleanly: ${failed.join(", ")}`);
  }

  writeFileSync(file, source);
}

console.log("[personal] browser-local profile, avatar and personal prompt layer applied");
