"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { BarChart3 } from "lucide-react";

export function Navbar() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight text-[var(--foreground)]">
          <div className="w-9 h-9 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white shadow-sm">
            <BarChart3 className="w-5 h-5" />
          </div>
          <span>Analytics Intelligence <span className="text-xs px-2 py-0.5 rounded font-medium bg-[var(--accent)] text-[var(--accent-foreground)] border border-[var(--border)] ml-1">Beta</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
