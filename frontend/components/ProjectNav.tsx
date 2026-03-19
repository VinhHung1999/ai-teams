"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface ProjectNavProps {
  projectId: number;
  projectName: string;
}

export function ProjectNav({ projectId, projectName }: ProjectNavProps) {
  const pathname = usePathname();

  const tabs = [
    { href: `/project/${projectId}`, label: "Board", match: (p: string) => p === `/project/${projectId}` },
    { href: `/project/${projectId}/backlog`, label: "Backlog", match: (p: string) => p.includes("/backlog") },
  ];

  return (
    <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center justify-between px-6 h-12">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-muted-foreground/50 hover:text-foreground/80 transition-colors"
          >
            <span className="font-mono text-[11px] tracking-wider">AI·TEAMS</span>
          </Link>
          <span className="text-border">/</span>
          <span className="text-sm font-semibold text-foreground/90">{projectName}</span>
        </div>

        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`
                  px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all
                  ${isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground/60 hover:text-foreground/80 hover:bg-muted/30"
                  }
                `}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
