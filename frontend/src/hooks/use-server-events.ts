import { useEffect, useRef } from "react";
import { subscribe } from "../api/events";

export interface ServerEventHandlers {
  onTree: () => void;
  onChanged: (path: string) => void;
}

export function useServerEvents(handlers: ServerEventHandlers): void {
  // SSE サブスクリプションは一度だけ開き、handler の変更をまたいで生存させる
  // ref で最新の handler を保持し、イベントのたびに参照する
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    return subscribe((ev) => {
      if (ev.type === "changed") {
        handlersRef.current.onChanged(ev.path);
      } else if (ev.type === "tree") {
        handlersRef.current.onTree();
      }
    });
  }, []);
}
