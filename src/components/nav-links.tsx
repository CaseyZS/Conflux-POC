"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// A client component only because active-link highlighting needs the current
// pathname, which lives in the browser's router state. Sections appear here
// as their milestones land (Projects/Tasks in M2, Time in M3, Invoices in M4).
const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1 px-3">
      {LINKS.map(({ href, label }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
