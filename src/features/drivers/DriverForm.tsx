"use client";

import { useActionState } from "react";
import type { Driver, Vehicle } from "@prisma/client";
import { upsertDriver } from "./actions";
import { FormSection, Field, CheckboxField } from "@/components/forms/FormSection";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import type { ActionResult } from "@/lib/validations";

export function DriverForm({
  driver,
  vehicles,
}: {
  driver?: Driver;
  vehicles: Pick<Vehicle, "id" | "name">[];
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    upsertDriver,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4">
      {driver ? <input type="hidden" name="id" value={driver.id} /> : null}

      <FormSection title="Autista">
        <Field label="Nome *" htmlFor="name" error={errors?.name}>
          <input id="name" name="name" defaultValue={driver?.name ?? ""} required className="field-input" />
        </Field>
        <Field label="Codice" htmlFor="code" error={errors?.code} hint="Codice autista (es. 13130)">
          <input id="code" name="code" defaultValue={driver?.code ?? ""} className="field-input" />
        </Field>
        <Field label="Telefono / WhatsApp" htmlFor="phone" error={errors?.phone} hint="Formato internazionale, es. +39 333 1234567">
          <input id="phone" name="phone" defaultValue={driver?.phone ?? ""} placeholder="+39..." className="field-input" />
        </Field>
        <Field label="WhatsApp">
          <div className="pt-2">
            <CheckboxField label="Abilita invio giri su WhatsApp" name="whatsappEnabled" defaultChecked={driver?.whatsappEnabled ?? true} />
          </div>
        </Field>
        <Field label="Mezzo predefinito" htmlFor="defaultVehicleId" error={errors?.defaultVehicleId}>
          <select id="defaultVehicleId" name="defaultVehicleId" defaultValue={driver?.defaultVehicleId ?? ""} className="field-input">
            <option value="">Nessuno</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Stato">
          <div className="flex flex-wrap gap-6 pt-2">
            <CheckboxField label="Attivo" name="active" defaultChecked={driver?.active ?? true} />
            <CheckboxField
              label="Autista Eurosarda"
              name="isEurosarda"
              defaultChecked={driver?.isEurosarda ?? false}
            />
          </div>
        </Field>
        <Field label="Note" htmlFor="notes" error={errors?.notes} full>
          <textarea id="notes" name="notes" defaultValue={driver?.notes ?? ""} rows={2} className="field-input" />
        </Field>
      </FormSection>

      {state && !state.ok ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <div className="flex items-center gap-2">
        <ConfirmButton variant="primary">
          {driver ? "Salva modifiche" : "Crea autista"}
        </ConfirmButton>
        <a href="/autisti" className="btn-secondary">Annulla</a>
      </div>
    </form>
  );
}
