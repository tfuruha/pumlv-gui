import { Blob as NodeBlob } from "node:buffer";

// React 19 requires this flag so `act()` flushes effects in jsdom.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// react-zoom-pan-pinch uses ResizeObserver internally; jsdom doesn't provide it.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// shiki@4.6.0 の wasm-inlined.mjs が new Blob([...]).stream() を使用するため、jsdom の Blob を補完する
if (typeof Blob !== "undefined" && typeof Blob.prototype.stream !== "function") {
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
}
