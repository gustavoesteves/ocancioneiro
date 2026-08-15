"use client";

import { useEffect, useState, type ReactNode } from "react";

const navigation = [
  { href: "/import", label: "Painel" },
  { href: "/import/capturar", label: "Capturar" },
  { href: "/import/acervo", label: "Acervo" },
  { href: "/import/revisao", label: "Revisao" },
  { href: "/import/publicacao", label: "Publicacao" },
];

function normalizePathname(pathname: string) {
  const normalized = pathname.replace(/\/index\.html$/, "").replace(/\/$/, "");
  return normalized || "/";
}

export function ImportShell({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(
      () => setPathname(normalizePathname(window.location.pathname)),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#181714]">
      <header className="border-b border-[#d8d0c1] bg-[#fffdf8]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-4 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a4c2f]">
                O Cancioneiro
              </p>
              <p className="mt-1 text-lg font-semibold">Estacao editorial local</p>
            </div>
            <span className="rounded-full border border-[#8da27f] bg-[#edf5e9] px-3 py-1 text-xs font-semibold text-[#3f5d35]">
              fora do site publico
            </span>
          </div>
          <nav
            aria-label="Estacao editorial"
            className="flex flex-wrap gap-2 pb-1 sm:flex-nowrap sm:overflow-x-auto"
          >
            {navigation.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/import" && pathname.startsWith(`${item.href}/`)) ||
                (item.href === "/import/acervo" && pathname.startsWith("/import/obras/"));
              return (
                <a
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-md border px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-[#8a4c2f] bg-[#8a4c2f] text-white"
                      : "border-[#cfc6b5] bg-white text-[#5f5a50] hover:border-[#b99f8d]"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
