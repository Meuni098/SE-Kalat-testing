"use client";

import * as React from "react";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/actions/auth-actions";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const [state, formAction, isPending] = useActionState(loginAction, undefined);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

return (
    <div className="w-full max-w-[440px] bg-[#FFFFFF] border border-[#EBD3B2] rounded shadow-none p-8 flex flex-col">
      {/* BulSU Lockup Header */}
      <div className="flex flex-col items-center text-center mb-6 pb-6 border-b border-[#EBD3B2]">
        <div className="w-14 h-14 rounded-full bg-[#A60212] flex items-center justify-center border-2 border-[#F5AB29] mb-3">
          <span
            className="material-symbols-outlined text-[#F5AB29] text-[28px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            account_balance
          </span>
        </div>
        <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase">
          CUSTODIA
        </h1>
        <p className="text-xs font-bold text-[#D97B1A] tracking-wider uppercase mt-0.5">
          BulSU Asset Management Office
        </p>
        <p className="text-[11px] text-[#6E2B32] mt-1 font-medium">
          Property, Plant &amp; Equipment (PPE) &amp; Lifecycle Management
        </p>
      </div>

      {/* Error Alert */}
      {state?.error && (
        <div className="mb-4 p-3 bg-[#FEE2E2] border border-[#FECACA] rounded text-xs text-[#A60212] font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{state.error}</span>
        </div>
      )}

      {/* Login Form */}
      <form action={formAction} className="flex flex-col space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#3B0A0F] mb-1.5">
            University Email
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#6E2B32] text-[18px]">
              mail
            </span>
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="username@bulsu.edu.ph"
              className="w-full bg-[#FFF4E0] border border-[#EBD3B2] rounded pl-9 pr-3 py-2 text-sm text-[#3B0A0F] placeholder-[#6E2B32] focus:outline-none focus:border-[#A60212] font-medium"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#3B0A0F] mb-1.5">
            Password
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#6E2B32] text-[18px]">
              lock
            </span>
            <input
              type="password"
              name="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#FFF4E0] border border-[#EBD3B2] rounded pl-9 pr-3 py-2 text-sm text-[#3B0A0F] placeholder-[#6E2B32] focus:outline-none focus:border-[#A60212] font-medium"
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isPending}
          className="w-full mt-2"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined animate-spin text-[18px]">
                progress_activity
              </span>
              Authenticating...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                login
              </span>
              Sign In to CUSTODIA
            </span>
          )}
        </Button>
      </form>


    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#FFF4E0] flex flex-col items-center justify-center p-4">
      <Suspense fallback={<div className="text-xs text-[#6E2B32]">Loading login portal...</div>}>
        <LoginForm />
      </Suspense>

      {/* Institutional Legal Footer */}
      <footer className="mt-6 text-center text-xs text-[#6E2B32]">
        <p>Republic of the Philippines · Bulacan State University</p>
        <p className="text-[10px] mt-0.5">
          Commission on Audit (COA) Compliant Asset Tracking System · v2.4-COA
        </p>
      </footer>
    </div>
  );
}
