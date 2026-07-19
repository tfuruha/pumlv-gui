import { useState, useEffect, type JSX } from "react";
import { FileTree } from "./components/file-tree";
import { Preview } from "./components/preview";
import { SourceView } from "./components/source-view";
import { useActiveRender } from "./hooks/use-active-render";
import { useFileList } from "./hooks/use-file-list";
import { useServerEvents } from "./hooks/use-server-events";
import { SOURCE_PANEL_ID, SOURCE_PANEL_NAME, SOURCE_TOGGLE_LABEL } from "./source-panel";
import { SelectFolder, OpenFolder, GetLastFolder } from "../wailsjs/go/main/App";

export default function App(): JSX.Element {
  const { files, active, select, reload: reloadFiles } = useFileList();
  const { source, render, reload: reloadActive } = useActiveRender(active);
  const [sourceOpen, setSourceOpen] = useState<boolean>(true);
  const [lastFolder, setLastFolder] = useState<string>("");

  // サイドバーの幅と表示状態を localStorage から読み込み / 管理
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("sidebarWidth");
    return saved ? parseInt(saved, 10) : 288;
  });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem("sidebarOpen");
    return saved !== "false";
  });

  // マウスドラッグによる幅の動的変更処理
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // 最小幅 180px、最大幅 600px にクランプして設定
      const newWidth = Math.max(180, Math.min(600, startWidth + (moveEvent.clientX - startX)));
      setSidebarWidth(newWidth);
      localStorage.setItem("sidebarWidth", String(newWidth));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };


  // 起動時およびツリー変更時に開いているフォルダパスを取得
  const updateLastFolder = async () => {
    try {
      const folder = await GetLastFolder();
      setLastFolder(folder);
    } catch (e) {
      console.error("Failed to get last folder:", e);
    }
  };

  useEffect(() => {
    void updateLastFolder();
  }, [files]);

  useServerEvents({
    onTree: () => {
      reloadFiles();
      void updateLastFolder();
    },
    onChanged: (path) => {
      if (path === active) reloadActive();
    },
  });

  const handleOpenFolder = async () => {
    try {
      const folder = await SelectFolder();
      if (folder) {
        await OpenFolder(folder);
      }
    } catch (e) {
      console.error("Failed to open folder:", e);
    }
  };

  const activeName = files.find((f) => f.path === active)?.rel ?? "";
  const toggleLabel = sourceOpen ? SOURCE_TOGGLE_LABEL.open : SOURCE_TOGGLE_LABEL.closed;

  // フォルダがまだ開かれていない場合 (Welcome画面)
  if (!lastFolder) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-slate-900 px-6 text-slate-100">
        <div className="max-w-md text-center">
          <h1 className="mb-2 bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-5xl font-extrabold text-transparent tracking-tight">
            pumlv-gui
          </h1>
          <p className="mb-8 text-sm text-slate-400">
            PlantUML ファイルをリアルタイムにローカルプレビュー
          </p>

          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 backdrop-blur-sm shadow-xl">
            <button
              onClick={handleOpenFolder}
              className="w-full rounded-lg bg-violet-600 px-4 py-3 font-semibold text-white transition-all hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-600/30 active:scale-95"
            >
              フォルダを選択
            </button>
            <p className="mt-4 text-xs text-slate-500">
              または、フォルダをこのウィンドウにドラッグ＆ドロップしてください
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-50 text-slate-800">
      {sidebarOpen && (
        <aside
          style={{ width: `${sidebarWidth}px` }}
          className="shrink-0 overflow-y-auto bg-white flex flex-col"
        >
          <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
            <div>
              <h1 className="font-bold text-violet-700 text-lg">pumlv</h1>
              <p className="text-xs text-slate-500">{files.length} file(s)</p>
            </div>
            <button
              onClick={handleOpenFolder}
              title="別のフォルダを開く"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {files.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                サポートされているファイルが見つかりません。
                <div className="text-xs text-slate-500 mt-1">
                  (.puml, .plantuml, .iuml, .wsd)
                </div>
              </div>
            ) : (
              <FileTree files={files} active={active} onSelect={select} />
            )}
          </div>
          
          <div className="border-t border-slate-200 p-3 bg-slate-50">
            <p className="text-[10px] text-slate-400 truncate" title={lastFolder}>
              監視中: {lastFolder}
            </p>
          </div>
        </aside>
      )}

      {sidebarOpen && (
        <div
          onMouseDown={handleMouseDown}
          style={{ margin: "0 -2px" }}
          className="w-1 cursor-col-resize shrink-0 relative z-10 flex justify-center group"
          title="ドラッグして幅を調整"
        >
          <div className="w-[1px] h-full bg-slate-200 group-hover:bg-violet-500 group-active:bg-violet-600 transition-colors" />
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => {
                const nextState = !sidebarOpen;
                setSidebarOpen(nextState);
                localStorage.setItem("sidebarOpen", String(nextState));
              }}
              title={sidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
                <line x1="9" y1="3" x2="9" y2="21" strokeWidth={2} />
              </svg>
            </button>
            <span className="min-w-0 truncate font-medium">{activeName || "ファイルを選択してください"}</span>
          </div>

          {active && (
            <button
              type="button"
              aria-expanded={sourceOpen}
              aria-controls={SOURCE_PANEL_ID}
              onClick={() => setSourceOpen((v) => !v)}
              title={toggleLabel}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
                <line x1="15" y1="3" x2="15" y2="21" strokeWidth={2} />
              </svg>
            </button>
          )}
        </header>

        <div className="flex min-h-0 flex-1">
          <section className="relative min-w-0 flex-1 bg-slate-100">
            {render.kind === "loading" && (
              <div className="absolute inset-0 grid place-items-center text-slate-500">
                rendering...
              </div>
            )}

            {render.kind === "error" && (
              <pre className="absolute inset-0 m-0 overflow-auto whitespace-pre-wrap p-4 text-sm text-red-700">
                {render.message}
              </pre>
            )}

            {render.kind === "ok" && (
              <Preview
                svg={render.svg}
                fileName={activeName.split("/").pop()?.replace(/\.[^.]+$/, "") || "diagram"}
              />
            )}

            {render.kind === "idle" && (
              <div className="absolute inset-0 grid place-items-center text-slate-400">
                {files.length > 0 ? "ファイルツリーからプレビューするファイルを選択してください" : "監視フォルダに有効なファイルがありません"}
              </div>
            )}
          </section>

          {active && (
            <section
              id={SOURCE_PANEL_ID}
              aria-label={SOURCE_PANEL_NAME}
              hidden={!sourceOpen}
              className="w-[40ch] max-w-[50%] shrink-0 overflow-auto border-l border-slate-200 bg-white"
            >
              <SourceView source={source} />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
