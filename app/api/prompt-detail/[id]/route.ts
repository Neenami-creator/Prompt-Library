import { supabase, PROMPT_COLUMNS, type PromptRow } from "@/lib/supabase";

export const revalidate = 30;

function parseList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function serialise(row: PromptRow) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    tags: parseList(row.tags_json),
    description: row.description,
    promptText: row.prompt_text,
    source: row.source,
    recoveryStatus: row.recovery_status,
    aliases: parseList(row.aliases_json),
    featured: row.featured,
    favorite: row.favorite,
    archived: row.archived,
    copyCount: row.copy_count,
    lastCopiedAt: row.last_copied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { data, error } = await supabase
      .from("prompts")
      .select(PROMPT_COLUMNS)
      .eq("id", id)
      .eq("archived", false)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return Response.json(
      { prompt: data ? serialise(data as PromptRow) : null },
      { headers: { "Cache-Control": "public, max-age=0, must-revalidate", "CDN-Cache-Control": "max-age=30", "Vercel-CDN-Cache-Control": "max-age=30" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
