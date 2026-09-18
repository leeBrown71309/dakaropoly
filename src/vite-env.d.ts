/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Absent in a build with no online mode. */
  readonly VITE_SUPABASE_URL?: string;
  /** Publishable Supabase key. Public by design — RLS is what protects data. */
  readonly VITE_SUPABASE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
