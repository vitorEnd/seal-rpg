"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="signal-glow flex min-h-screen items-center justify-center px-5">
      <section className="max-w-xl border border-white/10 bg-zinc-950 p-8 text-center sm:p-12">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-rose-300">
          Falha no arquivo local
        </p>
        <h1 className="mt-5 text-3xl font-semibold text-zinc-50">
          Não foi possível carregar esta área.
        </h1>
        <p className="mt-4 text-sm leading-6 text-zinc-500">
          Tente novamente. Se o arquivo de dados foi alterado manualmente, restaure o
          seed com o comando documentado no README.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-7 bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950"
        >
          Tentar novamente
        </button>
      </section>
    </main>
  );
}

