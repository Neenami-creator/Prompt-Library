import { createHash } from "node:crypto";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  try {
    const { data, error } = await supabase
      .from("prompts")
      .select("id,title,prompt_text,aliases_json,archived")
      .limit(2000);

    if (error) throw new Error(error.message);

    const prompts = (data ?? []).map((row) => {
      let aliases: string[] = [];
      try {
        const parsed = JSON.parse(row.aliases_json ?? "[]");
        if (Array.isArray(parsed)) aliases = parsed.map(String);
      } catch {}

      return {
        id: row.id,
        title: row.title,
        titleKey: normalise(row.title),
        promptHash: digest(row.prompt_text),
        aliases: aliases.map(normalise),
        archived: Boolean(row.archived),
      };
    });

    const url = new URL(request.url);
    const ids = (url.searchParams.get("ids") ?? "").split("|").filter(Boolean);
    if (ids.length) {
      const liveIds = new Set(prompts.map((item) => item.id));
      return Response.json({
        count: prompts.length,
        requested: ids.length,
        present: ids.filter((id) => liveIds.has(id)),
        missing: ids.filter((id) => !liveIds.has(id)),
      });
    }

    const titles = (url.searchParams.get("titles") ?? "").split("|").filter(Boolean).map(normalise);
    if (titles.length) {
      const matches = titles.map((key) => ({
        key,
        matches: prompts
          .filter((item) => item.titleKey === key || item.aliases.includes(key))
          .map((item) => ({ id: item.id, title: item.title, promptHash: item.promptHash })),
      }));
      return Response.json({ count: prompts.length, requested: titles.length, matches });
    }

    const hashes = (url.searchParams.get("hashes") ?? "").split("|").filter(Boolean);
    if (hashes.length) {
      const matches = hashes.map((hash) => ({
        hash,
        matches: prompts
          .filter((item) => item.promptHash === hash)
          .map((item) => ({ id: item.id, title: item.title })),
      }));
      return Response.json({ count: prompts.length, requested: hashes.length, matches });
    }

    return Response.json({ count: prompts.length, prompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
