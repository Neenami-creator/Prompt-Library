import { createHash } from "node:crypto";
import { supabase } from "@/lib/supabase";
import { normaliseAustralianEnglish } from "@/lib/australian-english";

export const dynamic = "force-dynamic";

type IncomingPrompt = {
  id: string;
  title: string;
  category: string;
  tags?: string[];
  description?: string;
  promptText: string;
  source?: string;
  recoveryStatus?: string;
  aliases?: string[];
};

function normalise(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function digest(value: string | null | undefined) {
  return createHash("sha256").update(normalise(value)).digest("hex");
}

function cleanList(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))]
    : [];
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const encoded = url.searchParams.get("payload") ?? "";
    if (!encoded) return Response.json({ error: "Missing payload." }, { status: 400 });

    const incoming = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as IncomingPrompt[];
    if (!Array.isArray(incoming) || incoming.length > 10) {
      return Response.json({ error: "Payload must contain 1–10 prompts." }, { status: 400 });
    }

    const { data: existingData, error: readError } = await supabase
      .from("prompts")
      .select("id,title,prompt_text")
      .limit(2000);
    if (readError) throw new Error(readError.message);

    const existing = existingData ?? [];
    const ids = new Set(existing.map((item) => item.id));
    const titles = new Set(existing.map((item) => normalise(item.title)));
    const hashes = new Set(existing.map((item) => digest(item.prompt_text)));

    const inserted: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const item of incoming) {
      const title = normaliseAustralianEnglish(item.title?.trim() ?? "");
      const promptText = normaliseAustralianEnglish(item.promptText?.trim() ?? "");
      const id = item.id?.trim();

      if (!id || !title || !promptText) {
        skipped.push({ id: id || "unknown", reason: "missing required fields" });
        continue;
      }
      if (/\[truncated for model\]|\[source text truncated\]|incomplete source/i.test(promptText)) {
        skipped.push({ id, reason: "incomplete source marker" });
        continue;
      }
      if (ids.has(id) || titles.has(normalise(title)) || hashes.has(digest(promptText))) {
        skipped.push({ id, reason: "already represented" });
        continue;
      }

      const now = new Date().toISOString();
      const row = {
        id,
        title,
        category: item.category?.trim().toLowerCase() || "uncategorised",
        tags_json: JSON.stringify(cleanList(item.tags).map(normaliseAustralianEnglish)),
        description: normaliseAustralianEnglish(item.description?.trim() || ""),
        prompt_text: promptText,
        source: item.source?.trim() || "Imported from Custom Prompt Library export",
        recovery_status: item.recoveryStatus?.trim() || "imported",
        aliases_json: JSON.stringify(cleanList(item.aliases).map(normaliseAustralianEnglish)),
        featured: false,
        favorite: false,
        archived: false,
        copy_count: 0,
        last_copied_at: null,
        created_at: now,
        updated_at: now,
      };

      const { error } = await supabase.from("prompts").insert(row);
      if (error) {
        skipped.push({ id, reason: error.message });
        continue;
      }

      inserted.push(id);
      ids.add(id);
      titles.add(normalise(title));
      hashes.add(digest(promptText));
    }

    return Response.json({ requested: incoming.length, inserted, skipped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
