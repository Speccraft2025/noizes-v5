import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Null when env is unconfigured — callers fall back to local-only mode so the
// app still works as a pure prototype without a backend.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
