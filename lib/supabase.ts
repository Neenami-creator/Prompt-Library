import { createClient } from "@supabase/supabase-js";

/**
 * Project URL and publishable ("anon") key.
 *
 * These are safe to ship in the bundle — the publishable key is designed to be
 * public, and every table's access is governed by Row Level Security policies
 * on the database side, not by keeping this string secret. Environment
 * variables override them so the app can be pointed at another project without
 * a code change.
 */
const url = process.env.SUPABASE_URL ?? "https://tdxmwkywkrhuwgpgnhdo.supabase.co";
const key =
  process.env.SUPABASE_ANON_KEY ??
  "sb_publishable_CrSmbuf2NPJcdhuRz9ryfA_AJTuYRo8";

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

export type PromptRow = {
  id: string;
  title: string;
  category: string;
  tags_json: string;
  description: string;
  prompt_text: string;
  source: string;
  recovery_status: string;
  aliases_json: string;
  featured: boolean;
  favorite: boolean;
  archived: boolean;
  copy_count: number;
  last_copied_at: string | null;
  created_at: string;
  updated_at: string;
};

export const PROMPT_COLUMNS =
  "id,title,category,tags_json,description,prompt_text,source,recovery_status,aliases_json,featured,favorite,archived,copy_count,last_copied_at,created_at,updated_at";
