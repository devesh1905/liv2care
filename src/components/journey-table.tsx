import { nextAction, statusOf } from "@/lib/journey/derived";
import { STAGE_LABEL, type Stage } from "@/lib/journey/stages";

export type JourneyRow = {
  journey_id: string;
  patient_code: string;
  patient_name: string;
  stage: number;
  missed: boolean;
};

const TONE = {
  ok: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  warn: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  info: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  bad: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
} as const;

/** Patient, stage, status and next action. Reads journey_status, which carries no clinical columns. */
export function JourneyTable({ rows }: { rows: JourneyRow[] }) {
  if (rows.length === 0) return <p className="text-muted-foreground">No patients yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Patient</th>
            <th className="px-3 py-2">Stage</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Next action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const state = { stage: r.stage as Stage, missed: r.missed };
            const status = statusOf(state);
            const next = nextAction(state);
            return (
              <tr key={r.journey_id} className="border-t">
                <td className="px-3 py-2">
                  <span className="font-semibold">{r.patient_name}</span>{" "}
                  <span className="text-muted-foreground">{r.patient_code}</span>
                </td>
                <td className="px-3 py-2">{STAGE_LABEL[state.stage]}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[status.tone]}`}>{status.label}</span>
                </td>
                <td className="px-3 py-2">{next ? `${next.who}: ${next.what}` : "None"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
