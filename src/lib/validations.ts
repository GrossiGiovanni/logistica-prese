// Schemi Zod per la validazione di form e server action.
// I form HTML inviano stringhe: usiamo preprocessori per normalizzare
// campi vuoti -> undefined e stringhe numeriche -> number.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Helper di preprocessing
// ---------------------------------------------------------------------------

/** "" / null -> undefined, altrimenti stringa trimmata. */
const optionalString = z.preprocess((v) => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length === 0 ? undefined : s;
}, z.string().optional());

/** Stringa obbligatoria non vuota. */
const requiredString = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z.string().min(1, "Campo obbligatorio"),
);

/** "" -> undefined, altrimenti intero >= 0. */
const optionalInt = z.preprocess((v) => {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
}, z.number().int().nonnegative().optional());

/** "" -> undefined, altrimenti float >= 0. */
const optionalFloat = z.preprocess((v) => {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
}, z.number().nonnegative().optional());

/** Checkbox HTML: "on" / "true" / true -> true, resto -> false. */
const checkbox = z.preprocess(
  (v) => v === "on" || v === "true" || v === true,
  z.boolean(),
);

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida (formato YYYY-MM-DD)");

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

const vehicleType = z.enum(["VAN", "TRUCK", "MOTRICE"]);
const costLevel = z.enum(["LOW", "MEDIUM", "HIGH"]);
const pickupSourceType = z.enum(["SPOT", "RECURRING"]);
const pickupStatus = z.enum(["DRAFT", "READY", "PLANNED", "CANCELLED"]);
const timeWindow = z.enum(["MORNING", "AFTERNOON", "ANYTIME", "SPECIFIC"]);
const priority = z.enum(["NORMAL", "HIGH", "MANDATORY"]);
const routeShift = z.enum(["MORNING", "AFTERNOON", "FULL_DAY"]);
const routeStatus = z.enum(["DRAFT", "CONFIRMED"]);

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

export const customerSchema = z.object({
  name: requiredString,
  vatNumber: optionalString,
  phone: optionalString,
  email: optionalString.pipe(z.string().email("Email non valida").optional()),
  notes: optionalString,
});
export type CustomerInput = z.infer<typeof customerSchema>;

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

export const addressSchema = z.object({
  customerId: requiredString,
  label: optionalString,
  street: requiredString,
  city: requiredString,
  province: requiredString,
  postalCode: optionalString,
  country: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : "IT"),
    z.string(),
  ),
  notes: optionalString,
});
export type AddressInput = z.infer<typeof addressSchema>;

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export const driverSchema = z.object({
  name: requiredString,
  phone: optionalString,
  defaultVehicleId: optionalString,
  active: checkbox,
  notes: optionalString,
});
export type DriverInput = z.infer<typeof driverSchema>;

// ---------------------------------------------------------------------------
// Vehicle
// ---------------------------------------------------------------------------

export const vehicleSchema = z.object({
  name: requiredString,
  plate: optionalString,
  vehicleType,
  capacityPallets: optionalInt,
  hasTailLift: checkbox,
  costLevel,
  active: checkbox,
  notes: optionalString,
});
export type VehicleInput = z.infer<typeof vehicleSchema>;

// ---------------------------------------------------------------------------
// Pickup
// ---------------------------------------------------------------------------

export const pickupSchema = z.object({
  pickupDate: dateOnly,
  customerId: requiredString,
  addressId: requiredString,
  sourceType: pickupSourceType,
  status: pickupStatus,
  timeWindow,
  timeFrom: optionalString,
  timeTo: optionalString,
  pallets: optionalInt,
  colli: optionalInt,
  weightKg: optionalFloat,
  volumeM3: optionalFloat,
  requiresTailLift: checkbox,
  requiresMotrice: checkbox,
  priority,
  rawNotes: optionalString,
  internalNotes: optionalString,
});
export type PickupInput = z.infer<typeof pickupSchema>;

// ---------------------------------------------------------------------------
// RecurringPickup
// ---------------------------------------------------------------------------

export const recurringPickupSchema = z.object({
  customerId: requiredString,
  addressId: requiredString,
  active: checkbox,
  monday: checkbox,
  tuesday: checkbox,
  wednesday: checkbox,
  thursday: checkbox,
  friday: checkbox,
  saturday: checkbox,
  sunday: checkbox,
  defaultTimeWindow: timeWindow,
  defaultTimeFrom: optionalString,
  defaultTimeTo: optionalString,
  defaultPallets: optionalInt,
  defaultColli: optionalInt,
  defaultWeightKg: optionalFloat,
  defaultVolumeM3: optionalFloat,
  defaultRequiresTailLift: checkbox,
  defaultRequiresMotrice: checkbox,
  defaultPriority: priority,
  defaultNotes: optionalString,
});
export type RecurringPickupInput = z.infer<typeof recurringPickupSchema>;

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const routeSchema = z.object({
  routeDate: dateOnly,
  driverId: optionalString,
  vehicleId: optionalString,
  shift: routeShift,
  status: routeStatus,
  notes: optionalString,
});
export type RouteInput = z.infer<typeof routeSchema>;

// ---------------------------------------------------------------------------
// Helper: estrae i dati da FormData e li valida.
// ---------------------------------------------------------------------------

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function parseForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
): { success: true; data: z.infer<T> } | { success: false; result: ActionResult } {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      success: false,
      result: {
        ok: false,
        error: "Dati non validi. Controlla i campi evidenziati.",
        fieldErrors: flat.fieldErrors as Record<string, string[]>,
      },
    };
  }
  return { success: true, data: parsed.data };
}
