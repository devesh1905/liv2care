import { ClipboardList, FlaskConical, Microscope, Stethoscope, Users } from "lucide-react";
import type { StaffRole } from "@/lib/auth/roles";

export const ROLE_ICON: Record<StaffRole, typeof Stethoscope> = {
  doctor: Stethoscope,
  clinician: ClipboardList,
  lab: FlaskConical,
  centre: Microscope,
  ops: Users,
};

/** What each person can do, in plain words, so a visitor can choose where to start. */
export const ROLE_BLURB: Record<StaffRole, string> = {
  doctor: "Add a pretend patient, review the clinician's note, approve or decline a FibroScan, and choose the next step.",
  clinician: "Open a patient's report, type the FIB-4 and a short summary, and send it back to the doctor.",
  lab: "Add appointment times, upload a report, and mark visits as attended or missed.",
  centre: "The same for FibroScan visits: upload the scan report and mark the visit.",
  ops: "See every patient and what is overdue, send reminders, and read the activity log and the progress numbers.",
};
