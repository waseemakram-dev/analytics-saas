"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, Mail, ArrowRight, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";
  const emailFromUrl = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailFromUrl);
  const [token, setToken] = useState(tokenFromUrl);

  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  // Auto-verify if parameters are present in URL
  useEffect(() => {
    if (tokenFromUrl && emailFromUrl) {
      handleVerify(tokenFromUrl, emailFromUrl);
    }
  }, [tokenFromUrl, emailFromUrl]);

  const handleVerify = async (tok: string, mail: string) => {
    if (!tok || !mail) {
      setError("Verification token and email are required.");
      return;
    }

    setVerifying(true);
    setError(null);
    setResendStatus(null);

    try {
      const res = await api.verifyEmail({ token: tok, email: mail });
      if (res.success) {
        setVerified(true);
      } else {
        setError(res.error?.message || "Verification failed. The token may be expired or invalid.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during verification.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Please provide your email address to receive a new verification link.");
      return;
    }

    setResending(true);
    setError(null);
    setResendStatus(null);

    try {
      const res = await api.resendVerification(email);
      if (res.success) {
        setResendStatus("A new verification link has been sent if an unverified account exists.");
      } else {
        setError(res.error?.message || "Failed to resend verification link.");
      }
    } catch (err: any) {
      setError(err.message || "Error resending verification email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Email Verification</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">
          Verify your email address to unlock full platform access
        </p>
      </div>

      <div className="bg-[var(--card)] p-8 rounded-xl border border-[var(--border)] shadow-sm space-y-6">
        {verifying && (
          <div className="text-center py-8 space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)] mx-auto" />
            <p className="text-sm text-[var(--muted-foreground)]">Verifying your token...</p>
          </div>
        )}

        {verified && (
          <div className="text-center py-6 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Email Verified!</h2>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                Your email address has been verified. You can now access your analytics dashboard.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium text-sm hover:opacity-90 transition-opacity"
            >
              <span>Continue to Login</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {!verifying && !verified && (
          <div className="space-y-4">
            {error && (
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-start gap-3 text-sm text-red-700 dark:text-red-300">
                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Verification Failed</p>
                  <p className="mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {resendStatus && (
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-sm text-emerald-800 dark:text-emerald-200">
                {resendStatus}
              </div>
            )}

            {!tokenFromUrl && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerify(token, email);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Verification Token</label>
                  <input
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Enter token from verification link"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={verifying}
                  className="w-full py-2.5 px-4 rounded-lg bg-[var(--primary)] text-white font-medium text-sm hover:opacity-90 transition-opacity"
                >
                  Verify Token
                </button>
              </form>
            )}

            <div className="pt-4 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                Need a new verification link? Enter your email and request a resend:
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || !email}
                  className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                >
                  {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Resend</span>
                </button>
              </div>
            </div>

            <div className="pt-2 text-center">
              <Link href="/login" className="text-xs text-[var(--primary)] hover:underline font-medium">
                Back to Login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--primary)]" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
