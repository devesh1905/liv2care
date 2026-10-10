import { DemoRoleSheets } from "@/components/demo-role-sheets";

/**
 * The "try it yourself" buttons for the home page. Shown only when DEMO_LOGINS=on. Each button opens a side panel with a
 * normal sign-in for that role; the visitor types that account's own password, so no password is stored in the site's
 * code or settings for this. Locally the seeded password is shown as a hint (it is in the repo anyway).
 */
export function DemoLogins() {
  if (process.env.DEMO_LOGINS !== "on") return null;
  const local = process.env.NODE_ENV !== "production";
  return <DemoRoleSheets localHint={local ? "Local development only: the seeded demo password is demo-liv2care-only." : undefined} />;
}
