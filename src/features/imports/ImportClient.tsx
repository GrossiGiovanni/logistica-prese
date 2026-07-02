"use client";

// Flusso import AS400: upload xlsx → preview (nessuna scrittura) → conferma.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewImport, confirmImport, type ImportPreview, type ImportResult } from "./actions";
import { Badge } from "@/components/badges/Badge";

const STATUS_LABEL = {
  new: { text: "Nuova", tone: "green" as const },
  existing: { text: "Già presente", tone: "slate" as const },
  error: { text: "Errore", tone: "red" as const },
};

export function ImportClient() {
  const router = useRouter();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onUpload(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const p = await previewImport(formData);
      setPreview(p);
    });
  }

  function onConfirm() {
    if (!preview) return;
    startTransition(async () => {
      const r = await confirmImport(preview);
      setResult(r);
      setPreview(null);
      router.refresh(); // aggiorna lo storico import
    });
  }

  return (
    <div className="space-y-4">
      <form action={onUpload} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="grow">
          <label className="field-label" htmlFor="file">File Excel AS400 (.xlsx)</label>
          <input id="file" name="file" type="file" accept=".xlsx" required className="field-input" />
        </div>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending && !preview ? "Lettura…" : "Carica e verifica"}
        </button>
      </form>

      {preview && !preview.ok ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {preview.error}
        </p>
      ) : null}

      {preview?.ok ? (
        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
            <span className="font-semibold text-slate-900">{preview.fileName}</span>
            <span>Righe lette: <b>{preview.totalRows}</b></span>
            <span className="text-emerald-700">Nuove: <b>{preview.newCount}</b></span>
            <span className="text-slate-500">Già presenti: <b>{preview.existingCount}</b></span>
            <span className={preview.errorCount > 0 ? "text-red-600" : "text-slate-500"}>
              Errori: <b>{preview.errorCount}</b>
            </span>
          </div>

          <div className="max-h-96 overflow-auto rounded-md border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">Esito</th>
                  <th className="px-2 py-1.5">N. presa</th>
                  <th className="px-2 py-1.5">Data</th>
                  <th className="px-2 py-1.5">Mittente</th>
                  <th className="px-2 py-1.5">Località</th>
                  <th className="px-2 py-1.5">Carico</th>
                  <th className="px-2 py-1.5">Dettaglio</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => {
                  const s = STATUS_LABEL[r.status];
                  return (
                    <tr key={r.rowNumber} className="border-t border-slate-100">
                      <td className="px-2 py-1.5"><Badge tone={s.tone}>{s.text}</Badge></td>
                      <td className="px-2 py-1.5 font-mono">{r.numero ?? "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.date ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.mittente ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.city ?? "—"}{r.province ? ` (${r.province})` : ""}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {[
                          r.pallets != null ? `${r.pallets} plt` : null,
                          r.loadingMeters != null ? `${r.loadingMeters} mtl` : null,
                          r.volumeM3 != null ? `${r.volumeM3} m³` : null,
                          r.colli != null ? `${r.colli} colli` : null,
                        ].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500">{r.reason ?? r.rawNotes ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onConfirm}
              disabled={pending || preview.newCount === 0}
              className="btn-primary"
            >
              {pending ? "Import in corso…" : `Conferma import (${preview.newCount} prese)`}
            </button>
            <button onClick={() => setPreview(null)} disabled={pending} className="btn-secondary">
              Annulla
            </button>
          </div>
        </div>
      ) : null}

      {result ? (
        result.ok ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <b>Import completato.</b> Importate: <b>{result.imported}</b> · Saltate (già presenti):{" "}
            <b>{result.skipped}</b> · Non importate per errore: <b>{result.errors}</b>. Le nuove prese
            sono in pianificazione alla loro data, non assegnate.
          </div>
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {result.error}
          </p>
        )
      ) : null}
    </div>
  );
}
