import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/auth-forms";
import { getCurrentSession } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Criar conta local" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/");
  }

  return (
    <AuthShell
      eyebrow="Novo perfil"
      title="Crie uma identidade de jogador."
      description="O perfil será salvo apenas no banco JSON local. Nenhum dado será enviado para serviços externos."
    >
      <RegisterForm />
    </AuthShell>
  );
}

