"use client";

import { CancioneiroApp } from "./CancioneiroApp";
import { ImportTool } from "./ImportTool";

export function AppRouter() {
  const pathname =
    typeof window === "undefined" ? "/" : window.location.pathname.replace(/\/$/, "");

  if (pathname.endsWith("/import") || pathname.endsWith("/import/index.html")) {
    return <ImportTool />;
  }

  return <CancioneiroApp />;
}
