import { logoutAction } from "@/app/(auth)/actions";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className={
          compact
            ? "inline-flex min-h-11 items-center px-3 font-mono text-xs uppercase tracking-[0.18em] text-zinc-400 transition hover:text-zinc-100"
            : "border border-white/10 px-5 py-3 font-mono text-xs uppercase tracking-[0.18em] text-zinc-300 transition hover:border-white/25 hover:text-white"
        }
      >
        Sair
      </button>
    </form>
  );
}
