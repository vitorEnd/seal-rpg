import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";
import { getCurrentSession } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const session = await getCurrentSession();
  if (session) {
    redirect(session.user.role === "admin" ? "/admin" : "/campaigns");
  }

  const { next } = await searchParams;
  const returnTo = typeof next === "string" ? next : undefined;

  return (
    <AuthShell
      eyebrow="Acesso restrito"
      title="Identifique-se para abrir o arquivo."
      description="Neste ambiente local, identidade, sessão e permissões funcionam inteiramente no seu computador."
    >
      <LoginForm returnTo={returnTo} />
      <div className="auth-seed-accounts">
        <p>
          Contas seed · DEV ONLY
        </p>
        <dl>
          <div>
            <dt>Administrador</dt>
            <dd>admin / neptune-dev</dd>
          </div>
          <div>
            <dt>Mestre</dt>
            <dd>gm / master-dev</dd>
          </div>
          <div>
            <dt>Jogador</dt>
            <dd>player / player-dev</dd>
          </div>
        </dl>
      </div>
    </AuthShell>
  );
}
