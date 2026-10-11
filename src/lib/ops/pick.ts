export type OpenTask = { journey_id: string; owner: string; due_at: string };

/**
 * Which journeys to remind: the pending action is the patient's and is past its due time. Staff-owned actions are
 * flagged on the operations screen but never messaged to the patient. One entry per journey, most overdue first.
 */
export function pickReminders(tasks: OpenTask[], nowMs: number): string[] {
  const overdue = tasks
    .filter((t) => t.owner === "Patient" && new Date(t.due_at).getTime() < nowMs)
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  return [...new Set(overdue.map((t) => t.journey_id))];
}
