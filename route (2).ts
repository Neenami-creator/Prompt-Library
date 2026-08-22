import { supabase } from "@/lib/supabase";

/**
 * Serves the custom icon set and avatar out of Postgres rather than `public/`.
 *
 * The images are stored base64-encoded in the `assets` table so the deployment
 * payload stays plain text. They are immutable build assets, so the response is
 * cached hard at the edge and in the browser: after the first request the
 * database is never touched again for a given file.
 */
const NAME_PATTERN = /^[a-z0-9-]+\.(webp|jpg|png|svg)$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;

  if (!NAME_PATTERN.test(file)) {
    return new Response("Not found", { status: 404 });
  }

  const { data, error } = await supabase
    .from("assets")
    .select("content_type,payload")
    .eq("name", file)
    .maybeSingle();

  if (error || !data) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = Buffer.from(data.payload as string, "base64");

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": (data.content_type as string) || "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
