import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchFileSource, fetchFiles, sameFilePaths, type FileEntry } from "./files";
import { GetFiles, GetFileSource } from "../../wailsjs/go/main/App";

// Wails Go バインディングのモック
vi.mock("../../wailsjs/go/main/App", () => ({
  GetFiles: vi.fn(),
  GetFileSource: vi.fn(),
}));

const mockedGetFiles = vi.mocked(GetFiles);
const mockedGetFileSource = vi.mocked(GetFileSource);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchFiles", () => {
  it("ファイル一覧を正しく取得して返せること", async () => {
    const payload: FileEntry[] = [{ path: "/p", rel: "p", name: "p", source: "/" }];
    mockedGetFiles.mockResolvedValue(payload);

    const got = await fetchFiles();
    expect(got).toHaveLength(1);
    expect(got[0]!.name).toBe("p");
    expect(mockedGetFiles).toHaveBeenCalledTimes(1);
  });

  it("サーバーが null を返した場合は空の配列を返すこと", async () => {
    mockedGetFiles.mockResolvedValue(null as any);

    const got = await fetchFiles();
    expect(got).toEqual([]);
  });

  it("バックエンドからのエラーを伝播すること", async () => {
    mockedGetFiles.mockRejectedValue(new Error("backend error"));
    await expect(fetchFiles()).rejects.toThrow("backend error");
  });
});

describe("fetchFileSource", () => {
  it("指定したパスで GetFileSource を呼び出すこと", async () => {
    mockedGetFileSource.mockResolvedValue("@startuml\n@enduml\n");

    const body = await fetchFileSource("/tmp/a b.puml");
    expect(body).toBe("@startuml\n@enduml\n");
    expect(mockedGetFileSource).toHaveBeenCalledWith("/tmp/a b.puml");
  });
});

function entry(path: string): FileEntry {
  return {
    path,
    rel: path.replace(/^\//, ""),
    name: path.split("/").pop()!,
    source: "/",
  };
}

describe("sameFilePaths", () => {
  it.each([
    { name: "空のリスト同士は同一とみなす", a: [], b: [], want: true },
    {
      name: "同じパスが同じ順序で並んでいる場合は同一とみなす",
      a: [entry("/a.puml"), entry("/b.puml")],
      b: [entry("/a.puml"), entry("/b.puml")],
      want: true,
    },
    {
      name: "パス以外のフィールドのみが異なる場合は同一とみなす",
      a: [{ path: "/a.puml", rel: "a.puml", name: "a.puml", source: "/" }] as FileEntry[],
      b: [{ path: "/a.puml", rel: "x", name: "x", source: "/different" }] as FileEntry[],
      want: true,
    },
    {
      name: "リストの長さが異なる場合は同一とみなさない",
      a: [entry("/a.puml")],
      b: [entry("/a.puml"), entry("/b.puml")],
      want: false,
    },
    {
      name: "パスが異なる場合は同一とみなさない",
      a: [entry("/a.puml")],
      b: [entry("/b.puml")],
      want: false,
    },
    {
      name: "順序が異なる場合は同一とみなさない",
      a: [entry("/a.puml"), entry("/b.puml")],
      b: [entry("/b.puml"), entry("/a.puml")],
      want: false,
    },
  ])("$name -> $want", ({ a, b, want }) => {
    expect(sameFilePaths(a, b)).toBe(want);
  });
});
