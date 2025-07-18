/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL: string;
  readonly VITE_WEBSOCKET_TRANSPORTS: string;
  readonly VITE_WEBSOCKET_RECONNECTION: string;
  readonly VITE_WEBSOCKET_RECONNECTION_ATTEMPTS: string;
  readonly VITE_WEBSOCKET_RECONNECTION_DELAY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 