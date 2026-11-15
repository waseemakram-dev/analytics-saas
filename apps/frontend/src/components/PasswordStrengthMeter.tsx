"use client";

import { Check, X } from "lucide-react";

export function PasswordStrengthMeter({ password }: { password: string }) {
  const rules = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "At least one uppercase letter (A-Z)", valid: /[A-Z]/.test(password) },
    { label: "At least one lowercase letter (a-z)", valid: /[a-z]/.test(password) },
    { label: "At least one number (0-9)", valid: /[0-9]/.test(password) },
    { label: "At least one special character (!@#$%...)", valid: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = rules.filter((r) => r.valid).length;

  const getStrengthColor = () => {
    if (score <= 1) return "bg-red-500";
    if (score <= 3) return "bg-amber-500";
    if (score === 4) return "bg-blue-500";
    return "bg-emerald-500";
  };

  const getStrengthLabel = () => {
    if (password.length === 0) return "";
    if (score <= 1) return "Weak";
    if (score <= 3) return "Fair";
    if (score === 4) return "Good";
    return "Strong";
  };

  if (!password) return null;

  return (
    <div className="space-y-2 text-xs pt-1">
      <div className="flex items-center justify-between">
        <span className="text-[var(--muted-foreground)]">Password Strength:</span>
        <span className="font-medium text-[var(--foreground)]">{getStrengthLabel()}</span>
      </div>
      <div className="w-full bg-[var(--muted)] h-1.5 rounded-full overflow-hidden flex gap-1">
        {[1, 2, 3, 4, 5].map((lvl) => (
          <div
            key={lvl}
            className={`h-full flex-1 transition-all duration-300 ${
              score >= lvl ? getStrengthColor() : "bg-transparent"
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 text-[11px]">
        {rules.map((rule, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-1.5 ${
              rule.valid ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--muted-foreground)]"
            }`}
          >
            {rule.valid ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <X className="w-3.5 h-3.5 flex-shrink-0 opacity-40" />}
            <span>{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
