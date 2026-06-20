import { generateRecurringAction } from "./actions";
import { ConfirmButton } from "@/components/ui/ConfirmButton";

/**
 * Form "Genera prese fisse per data". Usa una server action.
 * `redirectTo` consente di tornare alla pagina di provenienza (es. /pianificazione).
 */
export function GenerateRecurringForm({
  date,
  redirectTo,
  compact = false,
}: {
  date: string;
  redirectTo: string;
  compact?: boolean;
}) {
  return (
    <form action={generateRecurringAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      {compact ? (
        <input type="hidden" name="date" value={date} />
      ) : (
        <div>
          <label className="field-label">Data</label>
          <input type="date" name="date" defaultValue={date} className="field-input w-auto" />
        </div>
      )}
      <ConfirmButton
        variant="primary"
        confirm={`Generare le prese fisse${compact ? " per la data selezionata" : ""}?`}
      >
        Genera prese fisse
      </ConfirmButton>
    </form>
  );
}
