import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.cwd(), "app/prompt-library.tsx");
let source = readFileSync(file, "utf8");

if (!source.includes("promptDetailCacheRef")) {
  source = source.replace(
    '  const [copiedId, setCopiedId] = useState<string | null>(null);',
    '  const [copiedId, setCopiedId] = useState<string | null>(null);\n  const promptDetailCacheRef = useRef(new Map<string, Promise<Prompt>>());\n  const fullLibraryRequestRef = useRef<Promise<Prompt[]> | null>(null);\n  const fullLibraryDataRef = useRef<Prompt[] | null>(null);',
  );

  source = source.replace(
    '      const response = await fetch("/api/prompts");',
    '      const response = await fetch("/api/prompt-summaries");',
  );

  source = source.replace(
    '      setPrompts(data.prompts ?? []);\n      setAudit(data.audit ?? null);\n      setError("");',
    '      setPrompts(data.prompts ?? []);\n      setAudit(data.audit ?? null);\n      setError("");\n      fullLibraryDataRef.current = null;\n      fullLibraryRequestRef.current = null;\n      window.setTimeout(() => { void hydrateFullLibrary(); }, 3500);',
  );

  source = source.replace(
    '  async function loadProfile() {',
    `  async function hydrateFullLibrary(): Promise<Prompt[] | null> {
    if (fullLibraryDataRef.current) return fullLibraryDataRef.current;
    if (fullLibraryRequestRef.current) return fullLibraryRequestRef.current;

    const request = fetch("/api/prompts")
      .then(async (response) => {
        const data = (await response.json()) as { prompts?: Prompt[]; error?: string };
        if (!response.ok || !data.prompts) {
          throw new Error(data.error || "The complete library could not load.");
        }
        return data.prompts;
      });

    fullLibraryRequestRef.current = request;

    try {
      const fullPrompts = await request;
      fullLibraryDataRef.current = fullPrompts;
      for (const prompt of fullPrompts) {
        promptDetailCacheRef.current.set(prompt.id, Promise.resolve(prompt));
      }
      setPrompts(fullPrompts);
      return fullPrompts;
    } catch {
      return null;
    } finally {
      fullLibraryRequestRef.current = null;
    }
  }

  function getPromptDetail(prompt: Prompt): Promise<Prompt> {
    if (prompt.promptText) return Promise.resolve(prompt);

    const fromLibrary = fullLibraryDataRef.current?.find((item) => item.id === prompt.id);
    if (fromLibrary?.promptText) return Promise.resolve(fromLibrary);

    const cached = promptDetailCacheRef.current.get(prompt.id);
    if (cached) return cached;

    const request = fetch(\`/api/prompt-detail/\${encodeURIComponent(prompt.id)}\`)
      .then(async (response) => {
        const data = (await response.json()) as { prompt?: Prompt; error?: string };
        if (!response.ok || !data.prompt) {
          throw new Error(data.error || "The full prompt could not be loaded.");
        }
        return data.prompt;
      })
      .catch((error) => {
        promptDetailCacheRef.current.delete(prompt.id);
        throw error;
      });

    promptDetailCacheRef.current.set(prompt.id, request);
    return request;
  }

  function prefetchPrompt(prompt: Prompt) {
    if (!prompt.promptText) void getPromptDetail(prompt);
  }

  function openPrompt(prompt: Prompt) {
    setSelected(prompt);
    if (prompt.promptText) return;

    void getPromptDetail(prompt)
      .then((detail) => {
        setPrompts((items) =>
          items.map((item) => (item.id === detail.id ? detail : item)),
        );
        setSelected((current) => (current?.id === detail.id ? detail : current));
      })
      .catch(() => {
        setToast("The full prompt is taking longer than expected to load.");
      });
  }

  async function loadProfile() {`,
  );

  source = source.replace(
    '  async function copyPrompt(prompt: Prompt) {\n    try {\n      await navigator.clipboard.writeText(prompt.promptText);',
    '  async function copyPrompt(prompt: Prompt) {\n    try {\n      const fullPrompt = await getPromptDetail(prompt);\n      await navigator.clipboard.writeText(fullPrompt.promptText);',
  );

  source = source.replace(
    '      setSelected(prompt);\n    }\n  }\n\n  return (',
    '      openPrompt(prompt);\n    }\n  }\n\n  return (',
  );

  source = source.replace(
    '              setSelected(prompt);\n              setCommandOpen(false);',
    '              openPrompt(prompt);\n              setCommandOpen(false);',
  );

  source = source.replace(
    '                  onClick={() => spotlightPrompt && setSelected(spotlightPrompt)}',
    '                  onClick={() => spotlightPrompt && openPrompt(spotlightPrompt)}',
  );

  source = source.replace(
    '                          selectMode ? toggleSelectId(prompt.id) : setSelected(prompt)',
    '                          selectMode ? toggleSelectId(prompt.id) : openPrompt(prompt)',
  );

  source = source.replace(
    '                        onKeyDown={(event) => handleCardKey(event, prompt)}',
    '                        onKeyDown={(event) => handleCardKey(event, prompt)}\n                        onMouseEnter={() => prefetchPrompt(prompt)}\n                        onFocus={() => prefetchPrompt(prompt)}',
  );

  source = source.replace(
    '<span>{selected.promptText.split(/\\s+/).length} words</span>',
    '<span>{selected.promptText ? `${selected.promptText.split(/\\s+/).length} words` : "Loading…"}</span>',
  );

  source = source.replace(
    '<pre>{selected.promptText}</pre>',
    '<pre>{selected.promptText || "Loading full prompt…"}</pre>',
  );

  source = source.replace(
    '  function exportJson() {\n    const content = JSON.stringify(',
    '  async function exportJson() {\n    const exportPrompts = (await hydrateFullLibrary()) ?? prompts;\n    const content = JSON.stringify(',
  );

  source = source.replace(
    '      prompts.map(\n        ({',
    '      exportPrompts.map(\n        ({',
  );

  source = source.replace(
    '  function exportMarkdown() {\n    const content = [...prompts]',
    '  async function exportMarkdown() {\n    const exportPrompts = (await hydrateFullLibrary()) ?? prompts;\n    const content = [...exportPrompts]',
  );

  source = source.replace(
    '    try {\n      const parsed = JSON.parse(await file.text()) as Partial<Prompt>[];',
    '    try {\n      const libraryPrompts = (await hydrateFullLibrary()) ?? prompts;\n      const parsed = JSON.parse(await file.text()) as Partial<Prompt>[];',
  );

  source = source.replace(
    '        prompts.map((item) => ({\n          id: item.id,',
    '        libraryPrompts.map((item) => ({\n          id: item.id,',
  );

  source = source.replace(
    '        prompts.map((item) => [item.title.trim().toLowerCase(), item.id]),',
    '        libraryPrompts.map((item) => [item.title.trim().toLowerCase(), item.id]),',
  );

  source = source.replace(
    '  useEffect(() => {\n    if (!toast) return;',
    '  useEffect(() => {\n    if (search.trim().length >= 2 && !fullLibraryDataRef.current) {\n      void hydrateFullLibrary();\n    }\n  }, [search]);\n\n  useEffect(() => {\n    if (!toast) return;',
  );

  if (
    !source.includes('fetch("/api/prompt-summaries")') ||
    !source.includes("promptDetailCacheRef") ||
    !source.includes("onMouseEnter={() => prefetchPrompt(prompt)}") ||
    !source.includes("Loading full prompt…")
  ) {
    throw new Error("Performance transform did not apply cleanly.");
  }

  writeFileSync(file, source);
}

console.log("[performance] lightweight first load and lazy prompt detail fetching applied");
