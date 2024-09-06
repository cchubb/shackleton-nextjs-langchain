import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl) throw new Error("Supabase URL not found.");
if (!supabaseAnonKey) throw new Error("Supabase Anon key not found.");

export const supabaseClient: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
);
