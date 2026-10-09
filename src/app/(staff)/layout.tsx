import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { getStaffUser } from "@/lib/auth/session";
import { logout } from "@/app/login/actions";

async function WhoAmI() {
  const user = await getStaffUser();
  if (!user) return null;
  return (
    <>
      <span className="text-sm text-muted-foreground">
        {user.displayName} · {ROLE_LABEL[user.role]}
      </span>
      <form action={logout} className="ml-auto">
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </>
  );
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 sm:px-6">
        <span className="text-sm font-extrabold tracking-tight text-primary">Liv2care</span>
        <Suspense fallback={null}>
          <WhoAmI />
        </Suspense>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
