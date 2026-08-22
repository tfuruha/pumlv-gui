import { useState, type JSX } from "react";
import { svgDataUrlToPngBlob } from "../../lib/svg-to-png";
import { SaveAsPNG } from "../../../wailsjs/go/main/App";

interface ExportControlsProps {
  svg: string; // SVG Data URL
  fileName?: string; // 保存時のデフォルトファイル名（拡張子なし）
}

// 共通のボタンスタイル（微細なホバーアニメーションと押し込み効果）
const BTN_STYLE =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:text-violet-600 hover:border-violet-300 hover:shadow active:scale-95 disabled:pointer-events-none disabled:opacity-50";

export function ExportControls({ svg, fileName = "diagram" }: ExportControlsProps): JSX.Element {
  const [copyStatus, setCopyStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  // PNG画像としてクリップボードへコピー
  const handleCopy = async () => {
    if (copyStatus !== "idle") return;
    setCopyStatus("loading");
    try {
      const blob = await svgDataUrlToPngBlob(svg);
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      setCopyStatus("success");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (e) {
      console.error("クリップボードへのコピーに失敗しました:", e);
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  };

  // PNG画像としてファイルシステムへ保存
  const handleSave = async () => {
    if (saveStatus !== "idle") return;
    setSaveStatus("loading");
    try {
      const blob = await svgDataUrlToPngBlob(svg);
      const arrayBuffer = await blob.arrayBuffer();

      // バイナリデータを安全に Base64 文字列へ変換
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = "";
      const len = uint8.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64 = btoa(binary);

      await SaveAsPNG(base64, fileName);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      console.error("ファイルの保存に失敗しました:", e);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  };

  const isBusy = copyStatus === "loading" || saveStatus === "loading";

  return (
    <div className="absolute top-3 right-3 z-20 flex gap-2">
      {/* コピーボタン */}
      <button
        type="button"
        onClick={handleCopy}
        disabled={isBusy}
        className={BTN_STYLE}
        title={
          copyStatus === "success"
            ? "コピーしました！"
            : copyStatus === "error"
              ? "コピー失敗"
              : "PNG 画像としてクリップボードにコピー"
        }
        aria-label="Copy as PNG"
      >
        {copyStatus === "loading" ? (
          <svg className="h-4 w-4 animate-spin text-violet-600" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : copyStatus === "success" ? (
          <svg
            className="h-4 w-4 text-emerald-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : copyStatus === "error" ? (
          <svg
            className="h-4 w-4 text-rose-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
            />
          </svg>
        )}
      </button>

      {/* 保存ボタン */}
      <button
        type="button"
        onClick={handleSave}
        disabled={isBusy}
        className={BTN_STYLE}
        title={
          saveStatus === "success"
            ? "保存しました！"
            : saveStatus === "error"
              ? "保存失敗"
              : "PNG 画像として保存"
        }
        aria-label="Save as PNG"
      >
        {saveStatus === "loading" ? (
          <svg className="h-4 w-4 animate-spin text-violet-600" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : saveStatus === "success" ? (
          <svg
            className="h-4 w-4 text-emerald-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : saveStatus === "error" ? (
          <svg
            className="h-4 w-4 text-rose-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
