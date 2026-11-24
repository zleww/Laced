/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_MARKETING_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** The version in package.json, filled in at build time. */
declare const __APP_VERSION__: string
