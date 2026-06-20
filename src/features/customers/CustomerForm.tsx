"use client";

import { useActionState } from "react";
import type { Customer } from "@prisma/client";
import { upsertCustomer } from "./actions";
import { FormSection, Field } from "@/components/forms/FormSection";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import type { ActionResult } from "@/lib/validations";

export function CustomerForm({ customer }: { customer?: Customer }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    upsertCustomer,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4">
      {customer ? <input type="hidden" name="id" value={customer.id} /> : null}

      <FormSection title="Dati cliente">
        <Field label="Ragione sociale *" htmlFor="name" error={errors?.name} full>
          <input
            id="name"
            name="name"
            defaultValue={customer?.name ?? ""}
            required
            className="field-input"
          />
        </Field>
        <Field label="Partita IVA" htmlFor="vatNumber" error={errors?.vatNumber}>
          <input
            id="vatNumber"
            name="vatNumber"
            defaultValue={customer?.vatNumber ?? ""}
            className="field-input"
          />
        </Field>
        <Field label="Telefono" htmlFor="phone" error={errors?.phone}>
          <input
            id="phone"
            name="phone"
            defaultValue={customer?.phone ?? ""}
            className="field-input"
          />
        </Field>
        <Field label="Email" htmlFor="email" error={errors?.email}>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={customer?.email ?? ""}
            className="field-input"
          />
        </Field>
        <Field label="Note" htmlFor="notes" error={errors?.notes} full>
          <textarea
            id="notes"
            name="notes"
            defaultValue={customer?.notes ?? ""}
            rows={3}
            className="field-input"
          />
        </Field>
      </FormSection>

      {state && !state.ok ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      <div className="flex items-center gap-2">
        <ConfirmButton variant="primary">
          {customer ? "Salva modifiche" : "Crea cliente"}
        </ConfirmButton>
        <a href="/clienti" className="btn-secondary">
          Annulla
        </a>
      </div>
    </form>
  );
}
