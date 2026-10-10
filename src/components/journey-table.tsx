import { nextAction, statusOf } from "@/lib/journey/derived";
import { STAGE_LABEL, type Stage } from "@/lib/journey/stages";
import { JourneyProgress } from "./journey-progress";
import { StatusPill } from "./status-pill";

export type JourneyRow = {
  journey_id: string;
  patient_code: string;
  patient_name: string;
  stage: number;
  missed: boolean;
};

/**
 * Patient, stage, status and next action. Reads journey_status, which carries no clinical columns.
 * A table from the `md` width up, stacked cards on phones.
 */
export function JourneyTable({ rows }: { rows: JourneyRow[] }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">No patients yet.</p>;
  }

  const view = rows.map((r) => {
    const state = { stage: r.stage as Stage, missed: r.missed };
    return { r, state, status: statusOf(state), next: nextAction(state) };
  });

  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {view.map(({ r, state, status, next }) => (
          <li key={r.journey_id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-heading font-extrabold">{r.patient_name}</p>
                <p className="text-xs text-muted-foreground">{r.patient_code}</p>
              </div>
              <StatusPill {...status} />
            </div>
            <JourneyProgress stage={state.stage} missed={state.missed} />
            <div className="text-sm">
              <p className="font-semibold">{STAGE_LABEL[state.stage]}</p>
              <p className="text-muted-foreground">{next ? `${next.who}: ${next.what}` : "Nothing pending"}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-bold">Patient</th>
              <th scope="col" className="px-4 py-3 font-bold">Stage</th>
              <th scope="col" className="px-4 py-3 font-bold">Status</th>
              <th scope="col" className="px-4 py-3 font-bold">Next action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {view.map(({ r, state, status, next }) => (
              <tr key={r.journey_id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-heading font-extrabold">{r.patient_name}</p>
                  <p className="text-xs text-muted-foreground">{r.patient_code}</p>
                </td>
                <td className="w-64 px-4 py-3">
                  <p className="mb-2 font-semibold">{STAGE_LABEL[state.stage]}</p>
                  <JourneyProgress stage={state.stage} missed={state.missed} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill {...status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{next ? `${next.who}: ${next.what}` : "Nothing pending"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
