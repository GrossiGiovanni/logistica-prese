"use client";

// Cambio password obbligatorio al primo accesso (e possibile in seguito).
// Il middleware porta qui chi non ha ancora scelto una password propria.

import { useActionState } from "react";
import { Logo } from "@/components/layout/Logo";
import { changePassword, signOut, type ChangePasswordState } from "@/features/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-policy";

export default function CambiaPasswordPage() {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    null,
  );

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-5 text-center">
          <Logo className="mx-auto w-64" />
          <h1 className="mt-4 text-lg font-semibold text-slate-900">Imposta la tua password</h1>
          <p className="mt-1 text-sm text-slate-500">
            Per motivi di sicurezza, al primo accesso devi scegliere una password personale.
          </p>
        </div>

        <form action={formAction} className="space-y-3">
          <div>
            <label className="field-label" htmlFor="password">Nuova password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              autoFocus
              className="field-input"
            />
            <p className="mt-1 text-xs text-slate-400">Almeno {MIN_PASSWORD_LENGTH} caratteri.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="confirm">Conferma password</label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className="field-input"
            />
          </div>
          {state && !state.ok ? <p className="text-sm text-red-600">{state.error}</p> : null}
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Salvataggio…" : "Salva e accedi"}
          </button>
        </form>

        <form action={signOut} className="mt-3 text-center">
          <button type="submit" className="text-xs text-slate-500 hover:underline">
            Esci
          </button>
        </form>
      </div>
    </div>
  );
}
