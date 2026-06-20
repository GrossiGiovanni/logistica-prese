"use client";

import { useActionState } from "react";
import type { Address, Customer } from "@prisma/client";
import { upsertAddress } from "./actions";
import { FormSection, Field } from "@/components/forms/FormSection";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import type { ActionResult } from "@/lib/validations";

export function AddressForm({
  address,
  customers,
  defaultCustomerId,
}: {
  address?: Address;
  customers: Pick<Customer, "id" | "name">[];
  defaultCustomerId?: string;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    upsertAddress,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4">
      {address ? <input type="hidden" name="id" value={address.id} /> : null}

      <FormSection title="Indirizzo">
        <Field label="Cliente *" htmlFor="customerId" error={errors?.customerId} full>
          <select
            id="customerId"
            name="customerId"
            defaultValue={address?.customerId ?? defaultCustomerId ?? ""}
            required
            className="field-input"
          >
            <option value="" disabled>
              Seleziona cliente…
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Etichetta" htmlFor="label" error={errors?.label} hint="Es. Sede principale, Magazzino, Produzione">
          <input id="label" name="label" defaultValue={address?.label ?? ""} className="field-input" />
        </Field>
        <Field label="Via *" htmlFor="street" error={errors?.street}>
          <input id="street" name="street" defaultValue={address?.street ?? ""} required className="field-input" />
        </Field>
        <Field label="Città *" htmlFor="city" error={errors?.city}>
          <input id="city" name="city" defaultValue={address?.city ?? ""} required className="field-input" />
        </Field>
        <Field label="Provincia *" htmlFor="province" error={errors?.province}>
          <input id="province" name="province" defaultValue={address?.province ?? ""} required className="field-input" maxLength={4} />
        </Field>
        <Field label="CAP" htmlFor="postalCode" error={errors?.postalCode}>
          <input id="postalCode" name="postalCode" defaultValue={address?.postalCode ?? ""} className="field-input" />
        </Field>
        <Field label="Paese" htmlFor="country" error={errors?.country}>
          <input id="country" name="country" defaultValue={address?.country ?? "IT"} className="field-input" />
        </Field>
        <Field label="Note" htmlFor="notes" error={errors?.notes} full>
          <textarea id="notes" name="notes" defaultValue={address?.notes ?? ""} rows={2} className="field-input" />
        </Field>
      </FormSection>

      {state && !state.ok ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <div className="flex items-center gap-2">
        <ConfirmButton variant="primary">
          {address ? "Salva modifiche" : "Crea indirizzo"}
        </ConfirmButton>
        <a href="/indirizzi" className="btn-secondary">
          Annulla
        </a>
      </div>
    </form>
  );
}
