"use client";

import { usePathname } from "next/navigation";

const NO_SIDEBAR_ROUTES = ["/", "/login", "/onboarding"];

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasSidebar = !NO_SIDEBAR_ROUTES.some((r) =>
    r === "/" ? pathname === "/" : pathname.startsWith(r)
  );

  return (
    <main
      className={`flex flex-1 flex-col h-screen overflow-y-auto ${hasSidebar ? "md:ml-64" : ""}`}
    >
      {children}
    </main>
  );
}
