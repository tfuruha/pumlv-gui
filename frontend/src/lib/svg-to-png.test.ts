import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { svgDataUrlToPngBlob } from "./svg-to-png";

describe("svgDataUrlToPngBlob", () => {
  beforeAll(() => {
    // jsdom で Image.onload が自動的に発火するように Image クラスをモック
    vi.stubGlobal(
      "Image",
      class {
        _src = "";
        onload: () => void = () => {};

        get src() {
          return this._src;
        }

        set src(val: string) {
          this._src = val;
          // 代入後、非同期で onload を呼び出してロード完了をシミュレート
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      },
    );

    // HTMLCanvasElement.prototype.getContext のモックを注入
    HTMLCanvasElement.prototype.getContext = function (contextId: string): any {
      if (contextId === "2d") {
        return {
          scale: () => {},
          fillRect: () => {},
          drawImage: () => {},
          fillStyle: "",
        };
      }
      return null;
    };

    // HTMLCanvasElement.prototype.toBlob のモックを注入
    HTMLCanvasElement.prototype.toBlob = function (
      callback: (blob: Blob | null) => void,
      _type?: string,
      _quality?: unknown,
    ) {
      callback(new Blob(["mocked-png-data"], { type: "image/png" }));
    };
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("SVGデータURLをPNG Blobに正しく変換できること (viewBoxあり)", async () => {
    const svgDataUrl =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        '<svg viewBox="0 0 100 200"><rect x="10" y="10" width="80" height="180"/></svg>',
      );

    const blob = await svgDataUrlToPngBlob(svgDataUrl, { padding: 10, scale: 2 });
    expect(blob.type).toBe("image/png");
    const text = await blob.text();
    expect(text).toBe("mocked-png-data");
  });

  it("無効なフォーマットのデータURLでエラーを投げること", async () => {
    await expect(svgDataUrlToPngBlob("invalid-url")).rejects.toThrow(
      "無効なSVGデータURLフォーマットです。",
    );
  });
});
