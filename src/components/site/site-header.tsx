import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import type { User } from "@/domain/entities";

const roleLabels = {
  admin: "Administrador",
  game_master: "Mestre",
  player: "Jogador",
} as const;

export function SiteHeader({
  user,
  active,
  overlay = false,
}: {
  user: User | null;
  active?: "home" | "campaigns" | "admin";
  overlay?: boolean;
}) {
  const navItems = [
    { id: "home", label: "Início", href: "/" },
    { id: "campaigns", label: "Campanhas", href: "/campaigns" },
    ...(user?.role === "admin"
      ? [{ id: "admin", label: "Admin", href: "/admin" }]
      : []),
  ] as const;

  return (
    <header className={`site-header ${overlay ? "overlay" : ""}`}>
      <div className="site-header-inner">
        <Link href="/" className="site-brand" aria-label="RPG Vitin — início">
          <span className="site-brand-mark">RV</span>
          <span>
            <strong>RPG Vitin</strong>
            <small>Arquivo privado</small>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Navegação principal">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active === item.id ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-account">
          {user ? (
            <>
              <div>
                <strong>{user.name}</strong>
                <small>{roleLabels[user.role]}</small>
              </div>
              <LogoutButton compact />
            </>
          ) : (
            <Link href="/login" className="site-login">Entrar</Link>
          )}
        </div>
      </div>
    </header>
  );
}
