"use client";

// Maschera Reso: come l'inserimento presa, ma con "numero distinta" al posto
// del numero presa e la quantità "Resi consegnati al cliente".

import { useActionState, useState } from "react";
import type { Reso, Customer, Address } from "@prisma/client";
import { upsertReso } from "./actions";
import { FormSection, Field } from "@/components/forms/FormSection";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import type { ActionResult } from "@/lib/validations";
import { toDateInputValue } from "@/lib/dates";

type CustomerWithAddresses = Customer & { addresses: Address[] };

export function ResoForm({
  reso,
  customers,
  defaultDate,
}: {
  reso?: Reso;
  customers: CustomerWithAddresses[];
  defaultDate: string;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(upsertReso, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  const [customerId, setCustomerId] = useState(reso?.customerId ?? "");
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const addresses = selectedCustomer?.addresses ?? [];
  const [newCustomer, setNewCustomer] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {reso ? <input type="hidden" name="id" value={reso.id} /> : null}

      <FormSection title="Reso" description="Consegna di resi al cliente senza ritiro associato.">
        <Field label="N. distinta" htmlFor="distintaNumber" error={errors?.distintaNumber}>
          <input
            id="distintaNumber"
            name="distintaNumber"
            defaultValue={reso?.distintaNumber ?? ""}
            className="field-input"
          />
        </Field>
        <Field label="Data *" htmlFor="resoDate" error={errors?.resoDate}>
          <input
            id="resoDate"
            name="resoDate"
            type="date"
            defaultValue={reso ? toDateInputValue(reso.resoDate) : defaultDate}
            required
            className="field-input"
          />
        </Field>
        <Field label="Cliente *" htmlFor="customerId" error={errors?.customerId} full>
          {!reso ? (
            <label className="mb-1 flex items-center gap-2 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={newCustomer}
                onChange={(e) => setNewCustomer(e.target.checked)}
              />
              Nuovo cliente (crea al volo)
            </label>
          ) : null}
          {newCustomer ? (
            <input name="newCustomerName" placeholder="Nome nuovo cliente" required className="field-input" />
          ) : (
            <select
              id="customerId"
              name="customerId"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="field-input"
            >
              <option value="" disabled>Seleziona cliente…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Indirizzo" htmlFor="addressId" error={errors?.addressId}>
          <select
            id="addressId"
            name="addressId"
            defaultValue={reso?.addressId ?? ""}
            disabled={!customerId}
            className="field-input"
          >
            <option value="">{customerId ? "Nessuno / sede" : "Scegli prima il cliente"}</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {(a.label ? a.label + " — " : "") + a.street + ", " + a.city + " (" + a.province + ")"}
              </option>
            ))}
          </select>
        </Field>
      </FormSection>

      <FormSection title="Quantità">
        <Field label="Resi consegnati al cliente" htmlFor="resiCount" error={errors?.resiCount}>
          <input id="resiCount" name="resiCount" type="number" min={0} defaultValue={reso?.resiCount ?? ""} className="field-input" />
        </Field>
        <Field label="Pallet" htmlFor="pallets" error={errors?.pallets}>
          <input id="pallets" name="pallets" type="number" min={0} defaultValue={reso?.pallets ?? ""} className="field-input" />
        </Field>
        <Field label="Colli" htmlFor="colli" error={errors?.colli}>
          <input id="colli" name="colli" type="number" min={0} defaultValue={reso?.colli ?? ""} className="field-input" />
        </Field>
        <Field label="Note" htmlFor="notes" error={errors?.notes} full>
          <textarea id="notes" name="notes" defaultValue={reso?.notes ?? ""} rows={2} className="field-input" />
        </Field>
      </FormSection>

      {state && !state.ok ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <div className="flex items-center gap-2">
        <ConfirmButton variant="primary">
          {reso ? "Salva modifiche" : "Registra reso"}
        </ConfirmButton>
        <a href="/pianificazione" className="btn-secondary">Annulla</a>
      </div>
    </form>
  );
}
