/// <reference types="vite/client" />

declare const __APP_BUILD__: string

interface ImportMetaEnv {
  readonly VITE_FOOTBALL_DATA_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
