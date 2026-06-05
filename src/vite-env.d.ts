/// <reference types="vite/client" />

import type { FlashApi } from "./types";

declare global {
  interface Window {
    flashApi: FlashApi;
    RufflePlayer?: {
      newest(): {
        createPlayer(): HTMLElement & {
          ruffle(): {
            load(options: string | { url: string; allowScriptAccess?: boolean }): Promise<void> | void;
            play?: () => void;
          };
        };
      };
    };
  }

  interface File {
    path?: string;
  }
}

export {};
