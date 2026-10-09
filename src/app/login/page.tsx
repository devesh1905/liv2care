import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ROLE_HOME, ROLE_LABEL, safeNext, STAFF_ROLES } from "@/lib/auth/roles";
import { getStaffUser } from "@/lib/auth/session";
import { demoLogin } from "./actions";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Liv2care" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getStaffUser();
  if (user) redirect(ROLE_HOME[user.role]);

  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw) ?? "";
  const demo = process.env.DEMO_LOGINS === "on";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Sign in to Liv2care</h1>
        <p className="text-muted-foreground">For doctors, clinicians, labs, centres and operations staff.</p>
      </div>

      <LoginForm next={next} />

      {demo && (
        <section aria-labelledby="demo-heading" className="flex flex-col gap-3 rounded-lg bg-secondary p-4">
          <h2 id="demo-heading" className="text-sm font-semibold">
            Demo accounts (fake data)
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STAFF_ROLES.map((role) => (
              <form key={role} action={demoLogin}>
                <input type="hidden" name="role" value={role} />
                <Button type="submit" variant="outline" className="w-full">
                  {ROLE_LABEL[role]}
                </Button>
              </form>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
