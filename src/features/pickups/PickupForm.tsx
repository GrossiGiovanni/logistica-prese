"use client";

import { useActionState, useState } from "react";
import type { Pickup, Customer, Address } from "@prisma/client";
import { upsertPickup } from "./actions";
import { FormSection, Field, CheckboxField } from "@/components/forms/FormSection";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import {
  pickupSourceLabels,
  pickupStatusLabels,
  timeWindowLabels,
  priorityLabels,
  toOptions,
} from "@/lib/labels";
import { toDateInputValue } from "@/lib/dates";
import type { ActionResult } from "@/lib/validations";

type CustomerWithAddresses = Customer & { addresses: Address[] };

export function PickupForm({
  pickup,
  customers,
  defaultDate,
}: {
  pickup?: Pickup;
  customers: CustomerWithAddresses[];
  defaultDate: string;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    upsertPickup,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  const [customerId, setCustomerId] = useState(pickup?.customerId ?? "");
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const addresses = selectedCustomer?.addresses ?? [];

  return (
    <form action={formAction} className="space-y-4">
      {pickup ? <input type="hidden" name="id" value={pickup.id} /> : null}

      <FormSection title="Presa" description="I campi con * sono obbligatori. Pallet/peso/volume non bloccano il salvataggio ma la presa sarà segnalata.">
        <Field label="Data *" htmlFor="pickupDate" error={errors?.pickupDate}>
          <input
            id="pickupDate"
            name="pickupDate"
            type="date"
            defaultValue={pickup ? toDateInputValue(pickup.pickupDate) : defaultDate}
            required
            className="field-input"
          />
        </Field>
        <Field label="Origine *" htmlFor="sourceType" error={errors?.sourceType}>
          <select id="sourceType" name="sourceType" defaultValue={pickup?.sourceType ?? "SPOT"} className="field-input">
            {toOptions(pickupSourceLabels).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
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
            defaultValue={pickup?.addressId ?? ""}
            required
            disabled={!customerId}
            className="field-input"
          >
            <option value="" disabled>{customerId ? "Seleziona indirizzo…" : "Scegli prima il cliente"}</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {(a.label ? a.label + " — " : "") + a.street + ", " + a.city + " (" + a.province + ")"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Stato *" htmlFor="status" error={errors?.status}>
          <select id="status" name="status" defaultValue={pickup?.status ?? "READY"} className="field-input">
            {toOptions(pickupStatusLabels).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Priorità *" htmlFor="priority" error={errors?.priority}>
          <select id="priority" name="priority" defaultValue={pickup?.priority ?? "NORMAL"} className="field-input">
            {toOptions(priorityLabels).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      </FormSection>

      <FormSection title="Fascia oraria e quantità">
        <Field label="Fascia oraria" htmlFor="timeWindow" error={errors?.timeWindow}>
          <select id="timeWindow" name="timeWindow" defaultValue={pickup?.timeWindow ?? "ANYTIME"} className="field-input">
            {toOptions(timeWindowLabels).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Dalle" htmlFor="timeFrom" error={errors?.timeFrom}>
            <input id="timeFrom" name="timeFrom" type="time" defaultValue={pickup?.timeFrom ?? ""} className="field-input" />
          </Field>
          <Field label="Alle" htmlFor="timeTo" error={errors?.timeTo}>
            <input id="timeTo" name="timeTo" type="time" defaultValue={pickup?.timeTo ?? ""} className="field-input" />
          </Field>
        </div>
        <Field label="Pallet" htmlFor="pallets" error={errors?.pallets} hint="Se vuoto, la presa è segnalata con dati mancanti.">
          <input id="pallets" name="pallets" type="number" min={0} defaultValue={pickup?.pallets ?? ""} className="field-input" />
        </Field>
        <Field label="Colli" htmlFor="colli" error={errors?.colli}>
          <input id="colli" name="colli" type="number" min={0} defaultValue={pickup?.colli ?? ""} className="field-input" />
        </Field>
        <Field label="Peso (kg)" htmlFor="weightKg" error={errors?.weightKg}>
          <input id="weightKg" name="weightKg" type="number" min={0} step="0.1" defaultValue={pickup?.weightKg ?? ""} className="field-input" />
        </Field>
        <Field label="Volume (m³)" htmlFor="volumeM3" error={errors?.volumeM3}>
          <input id="volumeM3" name="volumeM3" type="number" min={0} step="0.1" defaultValue={pickup?.volumeM3 ?? ""} className="field-input" />
        </Field>
        <Field label="Requisiti" full>
          <div className="flex flex-wrap gap-6 pt-1">
            <CheckboxField label="Richiede sponda" name="requiresTailLift" defaultChecked={pickup?.requiresTailLift ?? false} />
            <CheckboxField label="Richiede motrice" name="requiresMotrice" defaultChecked={pickup?.requiresMotrice ?? false} />
          </div>
        </Field>
      </FormSection>

      <FormSection title="Note">
        <Field label="Note operative (dal cliente)" htmlFor="rawNotes" error={errors?.rawNotes} full>
          <textarea id="rawNotes" name="rawNotes" defaultValue={pickup?.rawNotes ?? ""} rows={2} className="field-input" />
        </Field>
        <Field label="Note interne" htmlFor="internalNotes" error={errors?.internalNotes} full>
          <textarea id="internalNotes" name="internalNotes" defaultValue={pickup?.internalNotes ?? ""} rows={2} className="field-input" />
        </Field>
      </FormSection>

      {state && !state.ok ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <div className="flex items-center gap-2">
        <ConfirmButton variant="primary">
          {pickup ? "Salva modifiche" : "Crea presa"}
        </ConfirmButton>
        <a href="/prese" className="btn-secondary">Annulla</a>
      </div>
    </form>
  );
}
