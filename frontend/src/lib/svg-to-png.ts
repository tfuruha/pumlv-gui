/**
 * クリップボードコピーやファイル出力のために、SVGデータURLをPNG Blobに変換するユーティリティ。
 * Word等に貼り付けた際の解像度不足や余白の見切れを防止するためのパラメータを設定可能です。
 */

// ==========================================
// デフォルトの設定値
// ==========================================

// PADDING: 画像の周囲に追加する余白（ピクセル単位）。
// Word等で図の外枠が切れるのを防ぎます。
export const DEFAULT_PADDING = 12;

// SCALE: 出力画像の解像度倍率。
// SVGはベクターデータのため、このスケールを大きくすることで、高解像度なPNGとして出力できます。
// スケール 3x は、一般的な印刷やWord仕様書への貼り付け（約250〜300dpi相当）に十分な解像度を確保します。
export const DEFAULT_SCALE = 3;

export interface SvgToPngOptions {
  padding?: number; // 余白ピクセル
  scale?: number; // 解像度倍率
}

/**
 * SVG の Data URL ("data:image/svg+xml;charset=utf-8,...") を PNG の Blob に変換します。
 * @param svgDataUrl SVG Data URL
 * @param options 設定オプション（余白や解像度スケール）
 * @returns PNG Blob
 */
export async function svgDataUrlToPngBlob(
  svgDataUrl: string,
  options: SvgToPngOptions = {},
): Promise<Blob> {
  const padding = options.padding ?? DEFAULT_PADDING;
  const scale = options.scale ?? DEFAULT_SCALE;

  // 1. SVGのテキストソースを取り出し、元サイズ（width, height）を計算する
  const svgPrefix = "data:image/svg+xml;charset=utf-8,";
  if (!svgDataUrl.startsWith(svgPrefix)) {
    throw new Error("無効なSVGデータURLフォーマットです。");
  }
  const svgText = decodeURIComponent(svgDataUrl.substring(svgPrefix.length));

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svgEl = doc.documentElement;

  if (!svgEl || svgEl.tagName.toLowerCase() !== "svg") {
    throw new Error("SVGドキュメントの解析に失敗しました。");
  }

  // viewBox 属性または width/height 属性から元のサイズを特定
  let srcW = 800;
  let srcH = 600;

  const viewBoxAttr = svgEl.getAttribute("viewBox");
  if (viewBoxAttr) {
    const parts = viewBoxAttr.split(/\s+/).map(Number);
    if (parts.length === 4 && !parts.some(isNaN)) {
      srcW = parts[2];
      srcH = parts[3];
    }
  } else {
    const wAttr = svgEl.getAttribute("width");
    const hAttr = svgEl.getAttribute("height");
    if (wAttr && hAttr) {
      srcW = parseFloat(wAttr);
      srcH = parseFloat(hAttr);
    }
  }

  // 2. 出力先のCanvasを作成し、解像度に合わせてサイズ設定
  const canvas = document.createElement("canvas");
  const canvasW = (srcW + padding * 2) * scale;
  const canvasH = (srcH + padding * 2) * scale;

  canvas.width = canvasW;
  canvas.height = canvasH;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D コンテキストの取得に失敗しました。");
  }

  // Canvasの描画座標系をスケールアップ
  ctx.scale(scale, scale);

  // 背景を白で塗りつぶす（Wordに貼り付けた際の透過部分の黒化を防ぐため）
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, srcW + padding * 2, srcH + padding * 2);

  // 3. SVGイメージをロードしてCanvas上に描画
  const img = new Image();
  img.src = svgDataUrl;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("SVG画像の読み込みに失敗しました。"));
  });

  // 余白(PADDING)の位置に描画
  ctx.drawImage(img, padding, padding);

  // 4. CanvasをPNG Blobに書き出し
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("PNG Blobへの変換に失敗しました。"));
      }
    }, "image/png");
  });
}
