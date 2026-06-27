"use client";

import { useActionState } from "react";
import type { Vehicle } from "@prisma/client";
import { upsertVehicle } from "./actions";
import { FormSection, Field, CheckboxField } from "@/components/forms/FormSection";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { vehicleTypeLabels, costLevelLabels, toOptions } from "@/lib/labels";
import type { ActionResult } from "@/lib/validations";

export function VehicleForm({ vehicle }: { vehicle?: Vehicle }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    upsertVehicle,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4">
      {vehicle ? <input type="hidden" name="id" value={vehicle.id} /> : null}

      <FormSection title="Mezzo">
        <Field label="Nome *" htmlFor="name" error={errors?.name}>
          <input id="name" name="name" defaultValue={vehicle?.name ?? ""} required className="field-input" />
        </Field>
        <Field label="Targa" htmlFor="plate" error={errors?.plate}>
          <input id="plate" name="plate" defaultValue={vehicle?.plate ?? ""} className="field-input" />
        </Field>
        <Field label="Titolare" htmlFor="owner" error={errors?.owner} hint="Padroncino / proprietario del mezzo">
          <input id="owner" name="owner" defaultValue={vehicle?.owner ?? ""} className="field-input" />
        </Field>
        <Field label="Tipo *" htmlFor="vehicleType" error={errors?.vehicleType}>
          <select id="vehicleType" name="vehicleType" defaultValue={vehicle?.vehicleType ?? "BILICO"} className="field-input">
            {toOptions(vehicleTypeLabels).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Livello costo *" htmlFor="costLevel" error={errors?.costLevel} hint="Le motrici hanno costo alto.">
          <select id="costLevel" name="costLevel" defaultValue={vehicle?.costLevel ?? "MEDIUM"} className="field-input">
            {toOptions(costLevelLabels).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Capacità pallet" htmlFor="capacityPallets" error={errors?.capacityPallets}>
          <input id="capacityPallets" name="capacityPallets" type="number" min={0} defaultValue={vehicle?.capacityPallets ?? ""} className="field-input" />
        </Field>
        <Field label="Capacità (m³)" htmlFor="capacityVolumeM3" error={errors?.capacityVolumeM3}>
          <input id="capacityVolumeM3" name="capacityVolumeM3" type="number" min={0} step="0.1" defaultValue={vehicle?.capacityVolumeM3 ?? ""} className="field-input" />
        </Field>
        <Field label="Portata (kg)" htmlFor="capacityWeightKg" error={errors?.capacityWeightKg}>
          <input id="capacityWeightKg" name="capacityWeightKg" type="number" min={0} step="1" defaultValue={vehicle?.capacityWeightKg ?? ""} className="field-input" />
        </Field>
        <Field label="Costo fisso / giorno (€)" htmlFor="dailyCost" error={errors?.dailyCost} hint="Giornata intera; metà per mezza giornata">
          <input id="dailyCost" name="dailyCost" type="number" min={0} step="1" defaultValue={vehicle?.dailyCost ?? ""} className="field-input" />
        </Field>
        <Field label="Costo / km (€)" htmlFor="costPerKm" error={errors?.costPerKm}>
          <input id="costPerKm" name="costPerKm" type="number" min={0} step="0.01" defaultValue={vehicle?.costPerKm ?? ""} className="field-input" />
        </Field>
        <Field label="Note" htmlFor="notes" error={errors?.notes}>
          <input id="notes" name="notes" defaultValue={vehicle?.notes ?? ""} className="field-input" />
        </Field>
        <Field label="Opzioni" full>
          <div className="flex flex-wrap gap-6 pt-1">
            <CheckboxField label="Ha sponda idraulica" name="hasTailLift" defaultChecked={vehicle?.hasTailLift ?? false} />
            <CheckboxField label="Attivo" name="active" defaultChecked={vehicle?.active ?? true} />
          </div>
        </Field>
      </FormSection>

      {state && !state.ok ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <div className="flex items-center gap-2">
        <ConfirmButton variant="primary">
          {vehicle ? "Salva modifiche" : "Crea mezzo"}
        </ConfirmButton>
        <a href="/mezzi" className="btn-secondary">Annulla</a>
      </div>
    </form>
  );
}
