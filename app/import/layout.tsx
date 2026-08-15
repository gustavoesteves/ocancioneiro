import type { ReactNode } from "react";
import { ImportShell } from "../components/ImportShell";

export default function ImportLayout({ children }: { children: ReactNode }) {
  return <ImportShell>{children}</ImportShell>;
}
