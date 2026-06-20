"use client";

import { useActionState, useState } from "react";
import type { RecurringPickup, Customer, Address } from "@prisma/client";
import { upsertRecurringPickup } from "./actions";
import { FormSection, Field, CheckboxField } from "@/components/forms/FormSection";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { timeWindowLabels, priorityLabels, toOptions } from "@/lib/labels";
import type { ActionResult } from "@/lib/validations";

type CustomerWithAddresses = Customer & { addresses: Address[] };

const weekdays: { name: keyof RecurringPickup; label: string }[] = [
  { name: "monday", label: "Lun" },
  { name: "tuesday", label: "Mar" },
  { name: "wednesday", label: "Mer" },
  { name: "thursday", label: "Gio" },
  { name: "friday", label: "Ven" },
  { name: "saturday", label: "Sab" },
  { name: "sunday", label: "Dom" },
];

export function RecurringPickupForm({
  recurring,
  customers,
}: {
  recurring?: RecurringPickup;
  customers: CustomerWithAddresses[];
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    upsertRecurringPickup,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  const [customerId, setCustomerId] = useState(recurring?.customerId ?? "");
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const addresses = selectedCustomer?.addresses ?? [];

  return (
    <form action={formAction} className="space-y-4">
      {recurring ? <input type="hidden" name="id" value={recurring.id} /> : null}

      <FormSection title="Cliente e indirizzo">
        <Field label="Cliente *" htmlFor="customerId" error={errors?.customerId}>
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
        </Field>
        <Field label="Indirizzo *" htmlFor="addressId" error={errors?.addressId}>
          <select
            id="addressId"
            name="addressId"
            defaultValue={recurring?.addressId ?? ""}
            required
            disabled={!customerId}
            className="field-input"
          >
            <option value="" disabled>{customerId ? "Seleziona indirizzo…" : "Scegli prima il cliente"}</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {(a.label ? a.label + " — " : "") + a.city + " (" + a.province + ")"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Stato" full>
          <div className="pt-1">
            <CheckboxField label="Attiva (verrà generata)" name="active" defaultChecked={recurring?.active ?? true} />
          </div>
        </Field>
      </FormSection>

      <FormSection title="Giorni della settimana">
        <Field label="Ricorrenza" full hint="Seleziona i giorni in cui la presa si ripete.">
          <div className="flex flex-wrap gap-4 pt-1">
            {weekdays.map((d) => (
              <CheckboxField
                key={d.name}
                label={d.label}
                name={d.name}
                defaultChecked={Boolean(recurring?.[d.name] ?? false)}
              />
            ))}
          </div>
        </Field>
      </FormSection>

      <FormSection title="Valori predefiniti">
        <Field label="Fascia oraria" htmlFor="defaultTimeWindow" error={errors?.defaultTimeWindow}>
          <select id="defaultTimeWindow" name="defaultTimeWindow" defaultValue={recurring?.defaultTimeWindow ?? "ANYTIME"} className="field-input">
            {toOptions(timeWindowLabels).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Priorità" htmlFor="defaultPriority" error={errors?.defaultPriority}>
          <select id="defaultPriority" name="defaultPriority" defaultValue={recurring?.defaultPriority ?? "NORMAL"} className="field-input">
            {toOptions(priorityLabels).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Dalle" htmlFor="defaultTimeFrom">
            <input id="defaultTimeFrom" name="defaultTimeFrom" type="time" defaultValue={recurring?.defaultTimeFrom ?? ""} className="field-input" />
          </Field>
          <Field label="Alle" htmlFor="defaultTimeTo">
            <input id="defaultTimeTo" name="defaultTimeTo" type="time" defaultValue={recurring?.defaultTimeTo ?? ""} className="field-input" />
          </Field>
        </div>
        <Field label="Pallet" htmlFor="defaultPallets" error={errors?.defaultPallets} hint="Se vuoto, le prese generate saranno in bozza.">
          <input id="defaultPallets" name="defaultPallets" type="number" min={0} defaultValue={recurring?.defaultPallets ?? ""} className="field-input" />
        </Field>
        <Field label="Colli" htmlFor="defaultColli">
          <input id="defaultColli" name="defaultColli" type="number" min={0} defaultValue={recurring?.defaultColli ?? ""} className="field-input" />
        </Field>
        <Field label="Peso (kg)" htmlFor="defaultWeightKg">
          <input id="defaultWeightKg" name="defaultWeightKg" type="number" min={0} step="0.1" defaultValue={recurring?.defaultWeightKg ?? ""} className="field-input" />
        </Field>
        <Field label="Volume (m³)" htmlFor="defaultVolumeM3">
          <input id="defaultVolumeM3" name="defaultVolumeM3" type="number" min={0} step="0.1" defaultValue={recurring?.defaultVolumeM3 ?? ""} className="field-input" />
        </Field>
        <Field label="Requisiti" full>
          <div className="flex flex-wrap gap-6 pt-1">
            <CheckboxField label="Richiede sponda" name="defaultRequiresTailLift" defaultChecked={recurring?.defaultRequiresTailLift ?? false} />
            <CheckboxField label="Richiede motrice" name="defaultRequiresMotrice" defaultChecked={recurring?.defaultRequiresMotrice ?? false} />
          </div>
        </Field>
        <Field label="Note" htmlFor="defaultNotes" full>
          <textarea id="defaultNotes" name="defaultNotes" defaultValue={recurring?.defaultNotes ?? ""} rows={2} className="field-input" />
        </Field>
      </FormSection>

      {state && !state.ok ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <div className="flex items-center gap-2">
        <ConfirmButton variant="primary">
          {recurring ? "Salva modifiche" : "Crea presa fissa"}
        </ConfirmButton>
        <a href="/prese-fisse" className="btn-secondary">Annulla</a>
      </div>
    </form>
  );
}
