import { describe, expect, it } from "vitest";
import { parseForm, routeSchema } from "@/lib/validations";
import { routeEditableData } from "./route-data";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const BASE = { routeDate: "2026-10-06", shift: "FULL_DAY", driverId: "d1", vehicleId: "v1" };

describe("lo stato del giro non passa MAI dal form", () => {
  it("il salvataggio (anche automatico) non scrive lo stato", () => {
    const parsed = parseForm(routeSchema, form({ ...BASE, status: "DRAFT" }));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(routeEditableData(parsed.data)).not.toHaveProperty("status");
  });

  it("un form rimasto aperto in bozza non riporta in bozza un giro confermato", () => {
    // Scheda A: form caricato quando il giro era in bozza. Scheda B: il giro
    // viene confermato col pulsante. Il salvataggio automatico di A non deve
    // contenere alcuno stato da scrivere.
    const parsed = parseForm(routeSchema, form({ ...BASE, status: "DRAFT" }));
    if (!parsed.success) throw new Error("form non valido");
    expect(Object.keys(routeEditableData(parsed.data))).not.toContain("status");
  });

  it("il form resta valido anche senza alcun campo stato", () => {
    expect(parseForm(routeSchema, form(BASE)).success).toBe(true);
  });

  it("i dati modificabili restano quelli previsti", () => {
    const parsed = parseForm(routeSchema, form({ ...BASE, notes: "ritiro urgente" }));
    if (!parsed.success) throw new Error("form non valido");
    const d = routeEditableData(parsed.data);
    expect(d.driverId).toBe("d1");
    expect(d.vehicleId).toBe("v1");
    expect(d.shift).toBe("FULL_DAY");
    expect(d.notes).toBe("ritiro urgente");
    expect(d.routeDate.toISOString().slice(0, 10)).toBe("2026-10-06");
  });
});
