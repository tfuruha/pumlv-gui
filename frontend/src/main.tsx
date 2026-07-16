import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app";
import { initApiUrl } from "./api/base-url";

// Wails バインディング経由で API サーバーの URL を事前取得してキャッシュする
// テスト環境では window.go が存在しないためスキップされる
async function bootstrap(): Promise<void> {
  await initApiUrl();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap().catch(console.error);
