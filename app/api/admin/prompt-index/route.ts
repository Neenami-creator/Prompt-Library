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

export async function GET() {
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

    return Response.json({ count: prompts.length, prompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
