import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-screen">
      <div className="auth-screen-media" aria-hidden="true">
        <Image
          src="/art/neptune-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="auth-screen-shade" />
        <div className="campaign-scanlines" />
      </div>

      <Link href="/" className="auth-brand" aria-label="RPG Vitin — início">
        <span>RV</span>
        <div>
          <strong>RPG Vitin</strong>
          <small>Arquivo privado</small>
        </div>
      </Link>

      <div className="auth-layout">
        <section className="auth-intro">
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <div className="auth-intro-rule" />
          <span>{description}</span>
          <div className="auth-dev-badge">
            <i aria-hidden="true" />
            Autenticação temporária · DEV ONLY
          </div>
        </section>

        <section className="auth-panel">{children}</section>
      </div>
    </main>
  );
}
