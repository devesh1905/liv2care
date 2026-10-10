import { LogOut } from "lucide-react";
import { Suspense } from "react";
import { logout } from "@/app/login/actions";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { getStaffUser } from "@/lib/auth/session";

async function WhoAmI() {
  const user = await getStaffUser();
  if (!user) return null;
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right leading-tight sm:block">
        <p className="text-sm font-semibold">{user.displayName}</p>
        <p className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</p>
      </div>
      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-primary sm:hidden">{ROLE_LABEL[user.role]}</span>
      <form action={logout}>
        <Button type="submit" variant="outline" size="sm">
          <LogOut aria-hidden="true" />
          Sign out
        </Button>
      </form>
    </div>
  );
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo />
          <Suspense fallback={null}>
            <WhoAmI />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">Demo build. Fake patients and simulated messages only.</footer>
    </div>
  );
}
