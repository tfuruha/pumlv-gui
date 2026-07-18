import { describe, expect, it, vi, beforeEach } from "vitest";
import { subscribe, type ServerEvent } from "./events";
import { EventsOn } from "../../wailsjs/runtime/runtime";

// Wails runtime EventsOn のモック
vi.mock("../../wailsjs/runtime/runtime", () => ({
  EventsOn: vi.fn(),
}));

const mockedEventsOn = vi.mocked(EventsOn);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("subscribe", () => {
  it("file:changed と tree:changed のイベントリスナーを登録すること", () => {
    const offFileChanged = vi.fn();
    const offTreeChanged = vi.fn();
    mockedEventsOn.mockImplementation((event) => {
      if (event === "file:changed") return offFileChanged;
      if (event === "tree:changed") return offTreeChanged;
      return vi.fn();
    });

    const cleanup = subscribe(() => {});
    expect(mockedEventsOn).toHaveBeenCalledWith("file:changed", expect.any(Function));
    expect(mockedEventsOn).toHaveBeenCalledWith("tree:changed", expect.any(Function));

    cleanup();
    expect(offFileChanged).toHaveBeenCalledTimes(1);
    expect(offTreeChanged).toHaveBeenCalledTimes(1);
  });

  it("file:changed が発火されたときに 'changed' イベントをディスパッチすること", () => {
    let fileChangedCallback: ((path: string) => void) | null = null;
    mockedEventsOn.mockImplementation((event, cb) => {
      if (event === "file:changed") {
        fileChangedCallback = cb as any;
      }
      return vi.fn();
    });

    const seen: ServerEvent[] = [];
    subscribe((ev) => seen.push(ev));

    expect(fileChangedCallback).not.toBeNull();
    fileChangedCallback!("/tmp/a.puml");

    expect(seen).toEqual([{ type: "changed", path: "/tmp/a.puml" }]);
  });

  it("tree:changed が発火されたときに 'tree' イベントをディスパッチすること", () => {
    let treeChangedCallback: (() => void) | null = null;
    mockedEventsOn.mockImplementation((event, cb) => {
      if (event === "tree:changed") {
        treeChangedCallback = cb as any;
      }
      return vi.fn();
    });

    const seen: ServerEvent[] = [];
    subscribe((ev) => seen.push(ev));

    expect(treeChangedCallback).not.toBeNull();
    treeChangedCallback!();

    expect(seen).toEqual([{ type: "tree" }]);
  });
});
