import type { ReactNode } from "react";

export function WorkspaceListToolbar({ children }: { children: ReactNode }) {
  return <div className="b2b-toolbar workspace-list-toolbar">{children}</div>;
}
