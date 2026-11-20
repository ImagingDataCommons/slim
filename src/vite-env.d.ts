/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Name of the public/config/<name>.js file loaded by index.html */
  readonly REACT_APP_CONFIG?: string
  /** Set by scripts/set-git-env.sh */
  readonly REACT_APP_GIT_SHA?: string
  readonly REACT_APP_DMV_GIT_SHA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
