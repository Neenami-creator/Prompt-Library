import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.cwd(), "app/prompt-library.tsx");
let source = readFileSync(file, "utf8");

source = source.replace(
  /  async function copyPrompt\(prompt: Prompt\) \{[\s\S]*?\n  \}\n\n  async function toggleFavourite/,
  `  async function copyPrompt(prompt: Prompt) {
    try {
      const fullPrompt = await getPromptDetail(prompt);
      await navigator.clipboard.writeText(fullPrompt.promptText);

      const now = new Date().toISOString();
      const events = readJson<{ id: string; promptId: string; at: string }[]>(
        USAGE_EVENTS_KEY,
        [],
      );
      writeJson(USAGE_EVENTS_KEY, [
        ...events,
        { id: crypto.randomUUID(), promptId: prompt.id, at: now },
      ]);

      setToast(\`Copied “\${prompt.title}”\`);
      setPrompts((items) =>
        items.map((item) =>
          item.id === prompt.id
            ? {
                ...item,
                copyCount: item.copyCount + 1,
                lastCopiedAt: now,
              }
            : item,
        ),
      );

      if (selected?.id === prompt.id) {
        setSelected({
          ...selected,
          copyCount: selected.copyCount + 1,
          lastCopiedAt: now,
        });
      }
    } catch {
      setToast("Copy failed — select and copy the text manually.");
    }
  }

  async function toggleFavourite`,
);

if (
  !source.includes("USAGE_EVENTS_KEY") ||
  !source.includes("crypto.randomUUID(), promptId: prompt.id") ||
  source.includes("incrementCopy: true")
) {
  throw new Error("Private usage tracking transform did not apply cleanly.");
}

writeFileSync(file, source);
console.log("[usage] private per-user usage tracking applied");
