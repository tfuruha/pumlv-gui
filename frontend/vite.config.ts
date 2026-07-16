import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  build: {
    // Wails の //go:embed all:frontend/dist に合わせた出力先
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    // wails dev 時は Wails の devServer を使うため proxy は不要
    // （API URL は動的に GetAPIAddress() で取得する）
  },
});
