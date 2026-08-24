import Link from "next/link";

export function EmptyState({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <section className="border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center sm:px-10 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
        {eyebrow}
      </p>
      <h2 className="mx-auto mt-4 max-w-xl text-2xl font-semibold tracking-[-0.035em] text-zinc-100 sm:text-3xl">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-400">
        {description}
      </p>
      {action ? (
        <Link
          href={action.href}
          className="mt-7 inline-flex min-h-11 items-center border border-white/15 px-5 text-sm font-semibold text-zinc-100 transition hover:border-white/35"
        >
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}
