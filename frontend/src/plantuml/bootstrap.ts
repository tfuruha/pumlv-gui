// Loads plantuml/plantuml's TeaVM build (frontend/public/plantuml/{plantuml.js,viz-global.js}).
// Split out from renderer.ts so vi.mock() can replace this whole module in tests
// instead of poking module-private state through a back-door export.

const VIZ_URL = "/plantuml/viz-global.js";
const PLANTUML_MODULE_URL = "/plantuml/plantuml.js";

export interface RenderOptions {
  maxSvgSize?: number;
  dark?: boolean;
}

type RenderToString = (
  lines: string[],
  onSuccess: (svg: string) => void,
  onError: (message: string) => void,
  options?: RenderOptions,
) => void;

export interface PlantUMLModule {
  renderToString: RenderToString;
}

let ready: Promise<PlantUMLModule> | null = null;

function loadVizGlobal(): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = VIZ_URL;
    s.async = false;
    s.addEventListener("load", () => resolve(), { once: true });
    s.addEventListener("error", () => reject(new Error(`failed to load: ${VIZ_URL}`)), {
      once: true,
    });
    document.head.appendChild(s);
  });
}

/**
 * /public ディレクトリのファイルは Vite 8 で直接 import() できないため、
 * fetch() でテキストを取得してから Blob URL 経由で動的インポートする。
 * これにより dev/production 両方で動作する。
 */
async function importFromPublic(url: string): Promise<PlantUMLModule> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to fetch: ${url} (${response.status})`);
  }
  const text = await response.text();
  const blob = new Blob([text], { type: "application/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  try {
    const mod = (await import(/* @vite-ignore */ blobUrl)) as PlantUMLModule;
    return mod;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export async function loadPlantUMLModule(): Promise<PlantUMLModule> {
  if (ready) return ready;
  ready = (async () => {
    // plantuml.js only touches globalThis.Graphviz from inside renderToString,
    // so we can fetch/parse both scripts in parallel.
    const [, mod] = await Promise.all([loadVizGlobal(), importFromPublic(PLANTUML_MODULE_URL)]);
    if (typeof mod.renderToString !== "function") {
      throw new Error("plantuml.js did not export renderToString");
    }
    return mod;
  })();
  return ready;
}
