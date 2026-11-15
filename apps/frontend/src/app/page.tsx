import Link from "next/link";
import { ArrowRight, ShieldCheck, Database, KeyRound, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="w-full max-w-2xl mx-auto text-center space-y-8">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[var(--accent)] text-[var(--accent-foreground)] border border-[var(--border)]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Stage 2 Authentication Live</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)]">
          Analytics Intelligence SaaS
        </h1>
        <p className="text-base text-[var(--muted-foreground)] max-w-lg mx-auto leading-relaxed">
          Multi-platform marketing analytics and AI intelligence platform. Production-ready authentication module.
        </p>
      </div>

      {/* Primary Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[var(--primary)] text-white font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm"
        >
          <span>Analytics Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/login"
          className="w-full sm:w-auto px-6 py-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-medium text-sm hover:bg-[var(--muted)] transition-colors flex items-center justify-center"
        >
          <span>Sign In</span>
        </Link>
        <Link
          href="/signup"
          className="w-full sm:w-auto px-6 py-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-medium text-sm hover:bg-[var(--muted)] transition-colors flex items-center justify-center"
        >
          <span>Register</span>
        </Link>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 text-left text-xs">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-2">
          <KeyRound className="w-5 h-5 text-[var(--primary)]" />
          <h3 className="font-semibold text-sm text-[var(--foreground)]">Auth.js & Argon2id</h3>
          <p className="text-[var(--muted-foreground)] leading-relaxed">
            Multi-tenant password hashing, Google Sign-in integration, and brute-force protection.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-2">
          <Database className="w-5 h-5 text-[var(--primary)]" />
          <h3 className="font-semibold text-sm text-[var(--foreground)]">Local PostgreSQL 18</h3>
          <p className="text-[var(--muted-foreground)] leading-relaxed">
            Connected to local database via Prisma 7 adapter with atomic transaction rollbacks.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-2">
          <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
          <h3 className="font-semibold text-sm text-[var(--foreground)]">Strict Tenant Isolation</h3>
          <p className="text-[var(--muted-foreground)] leading-relaxed">
            Server-side authorization guards preventing cross-workspace data leakage.
          </p>
        </div>
      </div>
    </div>
  );
}
