// @plantuml/core (MIT) パッケージから plantuml.js と viz-global.js を
// public/plantuml/ にコピーし、4096px ダイアグラムサイズ制限をパッチする。
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = ["plantuml.js", "viz-global.js"];

// エンジンがデフォルト上限（v1.2026.8 では 8192px）超のレイアウトを拒否する制限をパッチする。
const PATCH_RULES = [
  { from: "AQx=8192;", to: "AQx=65536;", expected: 3 },
  { from: "c<0)c=8192;", to: "c<0)c=65536;", expected: 1 },
];

function patchDimensionLimit(filePath) {
  let src = readFileSync(filePath, "utf8");
  for (const { from, to, expected } of PATCH_RULES) {
    const found = src.split(from).length - 1;
    if (found !== expected) {
      console.error(
        `plantuml.js patch failed: "${from}" の出現数が ${expected} 個のはずが ${found} 個でした。\n` +
          "アップストリームの TeaVM ビルドが変更された可能性があります。" +
          "plantuml.js を確認し、vendor-plantuml-core.mjs を更新してください。",
      );
      process.exit(1);
    }
    src = src.replaceAll(from, to);
  }
  writeFileSync(filePath, src);
  console.log("plantuml.js: ダイアグラムサイズ制限を 65536 に引き上げました");
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
