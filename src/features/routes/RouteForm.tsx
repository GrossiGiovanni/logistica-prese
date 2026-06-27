"use client";

import { useActionState, useState } from "react";
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
  drivers: Pick<Driver, "id" | "name" | "defaultVehicleId">[];
  vehicles: Pick<Vehicle, "id" | "name" | "vehicleType">[];
  defaultDate: string;
}) {
  const action = route ? updateRoute : createRoute;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  // Abbinamento fisso autista <-> mezzo: scelto l'uno, propone l'altro.
  const driverToVehicle = new Map(drivers.map((d) => [d.id, d.defaultVehicleId ?? ""]));
  const vehicleToDriver = new Map<string, string>();
  for (const d of drivers) {
    if (d.defaultVehicleId && !vehicleToDriver.has(d.defaultVehicleId)) {
      vehicleToDriver.set(d.defaultVehicleId, d.id);
    }
  }

  const [driverId, setDriverId] = useState(route?.driverId ?? "");
  const [vehicleId, setVehicleId] = useState(route?.vehicleId ?? "");

  function onDriverChange(next: string) {
    setDriverId(next);
    const v = driverToVehicle.get(next);
    if (v) setVehicleId(v); // propone il mezzo predefinito dell'autista
  }
  function onVehicleChange(next: string) {
    setVehicleId(next);
    const d = vehicleToDriver.get(next);
    if (d) setDriverId(d); // propone l'autista associato al mezzo
  }

  // Nome giro generato automaticamente: "Autista / Mezzo".
  const driverName = drivers.find((d) => d.id === driverId)?.name ?? "Autista da assegnare";
  const vehicleName = vehicles.find((v) => v.id === vehicleId)?.name ?? "Mezzo da assegnare";

  return (
    <form action={formAction} className="space-y-4">
      {route ? <input type="hidden" name="id" value={route.id} /> : null}

      <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm">
        <span className="text-slate-500">Nome giro: </span>
        <span className="font-semibold text-slate-900">{driverName} / {vehicleName}</span>
      </div>

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
        <Field label="Autista" htmlFor="driverId" error={errors?.driverId} hint="Scelto l'autista, il mezzo predefinito viene proposto in automatico.">
          <select id="driverId" name="driverId" value={driverId} onChange={(e) => onDriverChange(e.target.value)} className="field-input">
            <option value="">Nessuno</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Mezzo" htmlFor="vehicleId" error={errors?.vehicleId} hint="Scelto il mezzo, viene proposto l'autista associato.">
          <select id="vehicleId" name="vehicleId" value={vehicleId} onChange={(e) => onVehicleChange(e.target.value)} className="field-input">
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
