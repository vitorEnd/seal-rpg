import type { Metadata } from "next";
import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { getCurrentSession } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Acesso negado" };
export const dynamic = "force-dynamic";

export default async function AccessDeniedPage() {
  const session = await getCurrentSession();

  return (
    <main className="signal-glow flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-2xl border border-rose-300/20 bg-zinc-950/85 p-8 sm:p-12">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-rose-300">
          Conteúdo restrito
        </p>
        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-zinc-50">
          Seu usuário não possui acesso a este arquivo.
        </h1>
        <p className="mt-5 leading-7 text-zinc-400">
          {session
            ? `Você entrou como ${session.user.username}. A campanha ou área solicitada exige uma associação aprovada ou uma permissão administrativa.`
            : "Sua sessão não está ativa."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950"
          >
            Voltar ao início
          </Link>
          {session ? (
            <Link
              href="/campaigns"
              className="border border-white/15 px-5 py-3 text-sm font-semibold text-zinc-100"
            >
              Minhas campanhas
            </Link>
          ) : null}
          {session ? <LogoutButton /> : null}
        </div>
      </section>
    </main>
  );
}
