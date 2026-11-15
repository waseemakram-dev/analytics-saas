"use client";

import { useState } from "react";

export function GoogleSignInButton({ label = "Continue with Google" }: { label?: string }) {
  const [loading, setLoading] = useState(false);

  const handleGoogleClick = async () => {
    setLoading(true);
    try {
      // In Auth.js v5, OAuth sign-in requires a POST request with a valid CSRF token.
      const csrfRes = await fetch("/api/auth/csrf").then((r) => r.json());
      const csrfToken = csrfRes?.csrfToken;

      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/api/auth/signin/google";

      const inputCsrf = document.createElement("input");
      inputCsrf.type = "hidden";
      inputCsrf.name = "csrfToken";
      inputCsrf.value = csrfToken || "";
      form.appendChild(inputCsrf);

      const inputCallback = document.createElement("input");
      inputCallback.type = "hidden";
      inputCallback.name = "callbackUrl";
      inputCallback.value = "http://localhost:3000/account";
      form.appendChild(inputCallback);

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      console.error("Google sign-in initiation error:", err);
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)] font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-sm disabled:opacity-50"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.43 7.33 24 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.27 2.57 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
        />
      </svg>
      <span>{loading ? "Redirecting to Google..." : label}</span>
    </button>
  );
}
