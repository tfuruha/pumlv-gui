// @plantuml/core (MIT) パッケージから plantuml.js と viz-global.js を
// public/plantuml/ にコピーし、4096px ダイアグラムサイズ制限をパッチする。
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = ["plantuml.js", "viz-global.js"];

// エンジンが 4096px 超のレイアウトを拒否する制限をパッチする。
// render/renderToString API にサイズオプションは存在せず、
// scale/dpi プラグマも当該チェックには影響しないため、
// ベンダーコピーへの直接パッチが唯一の解決策。
const LIMIT_FROM = "4096.0";
const LIMIT_TO = "65536.0";
const LIMIT_OCCURRENCES = 2;

function patchDimensionLimit(filePath) {
  const src = readFileSync(filePath, "utf8");
  const found = src.split(LIMIT_FROM).length - 1;
  if (found !== LIMIT_OCCURRENCES) {
    console.error(
      `plantuml.js patch failed: "${LIMIT_FROM}" の出現数が ${LIMIT_OCCURRENCES} 個のはずが ${found} 個でした。\n` +
        "アップストリームの TeaVM ビルドが変更された可能性があります。" +
        "plantuml.js を確認し、vendor-plantuml-core.mjs を更新してください。",
    );
    process.exit(1);
  }
  writeFileSync(filePath, src.replaceAll(LIMIT_FROM, LIMIT_TO));
  console.log(`plantuml.js: ダイアグラムサイズ制限を ${LIMIT_FROM} → ${LIMIT_TO} に引き上げました`);
}

const here = dirname(fileURLToPath(import.meta.url));
const dest = resolve(here, "..", "public", "plantuml");
mkdirSync(dest, { recursive: true });

const requireFrom = createRequire(import.meta.url);
const pkgDir = dirname(requireFrom.resolve("@plantuml/core/package.json"));

for (const name of REQUIRED_FILES) {
  const target = resolve(dest, name);
  copyFileSync(resolve(pkgDir, name), target);
  console.log(`copied ${name} (${statSync(target).size} bytes)`);
}

patchDimensionLimit(resolve(dest, "plantuml.js"));
