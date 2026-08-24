import Link from "next/link";

export default function NotFound() {
  return (
    <main className="signal-glow flex min-h-screen items-center justify-center px-5">
      <section className="max-w-xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-orange-400">
          Arquivo 404
        </p>
        <h1 className="mt-6 text-5xl font-semibold tracking-[-0.045em] text-zinc-50">
          Registro não encontrado.
        </h1>
        <p className="mt-5 leading-7 text-zinc-500">
          A rota solicitada não existe ou o registro foi removido do arquivo local.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block border border-white/15 px-5 py-3 text-sm text-zinc-200"
        >
          Voltar à central
        </Link>
      </section>
    </main>
  );
}
