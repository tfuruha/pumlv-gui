/**
 * Wails バインディング経由でファイル一覧・ファイル内容を取得する。
 * Phase 2A: fetch() + HTTP サーバーから Wails Go バインディングへ移行済み。
 */
import { GetFiles, GetFileSource } from "../../wailsjs/go/main/App";

export interface FileEntry {
  path: string;
  rel: string;
  name: string;
  source: string;
}

export async function fetchFiles(): Promise<FileEntry[]> {
  const entries = await GetFiles();
  // Go 側が null を返した場合（サービス未起動）は空配列に正規化
  return entries ?? [];
}

export async function fetchFileSource(path: string, _signal?: AbortSignal): Promise<string> {
  // Wails バインディングは AbortSignal をサポートしないため _signal は無視
  return GetFileSource(path);
}

export function sameFilePaths(a: FileEntry[], b: FileEntry[]): boolean {
  return a.length === b.length && a.every((f, i) => f.path === b[i]!.path);
}
