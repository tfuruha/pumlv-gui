import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app";

// Phase 2A: Wails バインディング（GetFiles / GetFileSource）と
// Wails Events（EventsOn）を直接使用するため、API URL キャッシュは不要になった。
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
