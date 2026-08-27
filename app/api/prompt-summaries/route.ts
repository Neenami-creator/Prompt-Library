import { supabase, type PromptRow } from "@/lib/supabase";

export const revalidate = 60;

const SUMMARY_COLUMNS =
  "id,title,category,tags_json,description,source,recovery_status,aliases_json,featured,favorite,archived,copy_count,last_copied_at,created_at,updated_at";

function parseList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("prompts")
      .select(SUMMARY_COLUMNS)
      .eq("archived", false)
      .order("featured", { ascending: false })
      .order("title", { ascending: true })
      .limit(2000);

    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const prompts = rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      tags: parseList(row.tags_json),
      description: row.description,
      promptText: "",
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
    }));

    return Response.json(
      {
        prompts,
        audit: {
          seedCount: rows.length,
          recoveredFromPrototype: rows.filter((item: any) =>
            item.source.includes("latest Mission Control prototype"),
          ).length,
          rebuiltBodies: rows.filter((item: any) => item.recovery_status === "rebuilt").length,
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=0, must-revalidate",
          "CDN-Cache-Control": "max-age=60, stale-while-revalidate=300",
          "Vercel-CDN-Cache-Control": "max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
