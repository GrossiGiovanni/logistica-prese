"use client";

import { useActionState } from "react";
import type { Route, Driver, Vehicle } from "@prisma/client";
import { createRoute, updateRoute } from "./actions";
import { FormSection, Field } from "@/components/forms/FormSection";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { routeShiftLabels, routeStatusLabels, vehicleTypeLabels, toOptions } from "@/lib/labels";
import { toDateInputValue } from "@/lib/dates";
import type { ActionResult } from "@/lib/validations";

export function RouteForm({
  route,
  drivers,
  vehicles,
  defaultDate,
}: {
  route?: Route;
  drivers: Pick<Driver, "id" | "name">[];
  vehicles: Pick<Vehicle, "id" | "name" | "vehicleType">[];
  defaultDate: string;
}) {
  const action = route ? updateRoute : createRoute;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4">
      {route ? <input type="hidden" name="id" value={route.id} /> : null}

      <FormSection title="Dati giro">
        <Field label="Data *" htmlFor="routeDate" error={errors?.routeDate}>
          <input
            id="routeDate"
            name="routeDate"
            type="date"
            defaultValue={route ? toDateInputValue(route.routeDate) : defaultDate}
            required
            className="field-input"
          />
        </Field>
        <Field label="Fascia *" htmlFor="shift" error={errors?.shift}>
          <select id="shift" name="shift" defaultValue={route?.shift ?? "FULL_DAY"} className="field-input">
            {toOptions(routeShiftLabels).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Autista" htmlFor="driverId" error={errors?.driverId}>
          <select id="driverId" name="driverId" defaultValue={route?.driverId ?? ""} className="field-input">
            <option value="">Nessuno</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Mezzo" htmlFor="vehicleId" error={errors?.vehicleId}>
          <select id="vehicleId" name="vehicleId" defaultValue={route?.vehicleId ?? ""} className="field-input">
            <option value="">Nessuno</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.vehicleType === "MOTRICE" ? ` (${vehicleTypeLabels.MOTRICE})` : ""}
              </option>
            ))}
          </select>
        </Field>
        {route ? (
          <Field label="Stato" htmlFor="status" error={errors?.status}>
            <select id="status" name="status" defaultValue={route.status} className="field-input">
              {toOptions(routeStatusLabels).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="status" value="DRAFT" />
        )}
        <Field label="Ora partenza" htmlFor="departureTime" error={errors?.departureTime}>
          <input id="departureTime" name="departureTime" type="time" defaultValue={route?.departureTime ?? ""} className="field-input" />
        </Field>
        <Field label="Ora rientro" htmlFor="returnTime" error={errors?.returnTime}>
          <input id="returnTime" name="returnTime" type="time" defaultValue={route?.returnTime ?? ""} className="field-input" />
        </Field>
        <Field label="Km percorsi" hint="Calcolati automaticamente dalle fermate (magazzino → prese → magazzino)">
          <input
            value={route?.km != null ? `${route.km} km` : "— (in attesa di fermate / API)"}
            disabled
            className="field-input bg-slate-50 text-slate-500"
          />
        </Field>
        <Field label="Note" htmlFor="notes" error={errors?.notes} full>
          <textarea id="notes" name="notes" defaultValue={route?.notes ?? ""} rows={2} className="field-input" />
        </Field>
      </FormSection>

      {state && !state.ok ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state && state.ok ? <p className="text-sm text-emerald-600">Modifiche salvate.</p> : null}

      <div className="flex items-center gap-2">
        <ConfirmButton variant="primary">
          {route ? "Salva modifiche" : "Crea giro"}
        </ConfirmButton>
        <a href="/giri" className="btn-secondary">Indietro</a>
      </div>
    </form>
  );
}
