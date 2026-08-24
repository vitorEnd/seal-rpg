import Link from "next/link";

export default function CampaignNotFound() {
  return (
    <main className="signal-glow flex min-h-screen items-center justify-center px-5 py-14">
      <section className="w-full max-w-2xl border border-white/10 bg-black/25 p-8 text-center sm:p-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-orange-400">
          Arquivo de campanha · 404
        </p>
        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.045em] text-zinc-50 sm:text-5xl">
          Esta campanha não foi localizada.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-zinc-400">
          O endereço pode ter mudado ou o registro não existe mais no arquivo local.
        </p>
        <Link
          href="/campaigns"
          className="mt-8 inline-flex min-h-12 items-center bg-orange-500 px-6 text-sm font-bold uppercase tracking-[0.11em] text-zinc-950 transition hover:bg-orange-400"
        >
          Voltar às campanhas
        </Link>
      </section>
    </main>
  );
}
