import Image from "next/image";
import Link from "next/link";

import { CampaignCard } from "@/components/campaigns/campaign-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SiteHeader } from "@/components/site/site-header";
import { getCurrentSession } from "@/lib/auth/current-user";
import { getCampaignDirectory } from "@/lib/campaign-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [session, campaigns] = await Promise.all([
    getCurrentSession(),
    getCampaignDirectory(),
  ]);
  const featured = campaigns[0] ?? null;
  const remaining = campaigns.slice(1);
  const nameParts = featured?.name.split(/\s+/) ?? [];
  const featuredImageUrl =
    featured?.backgroundImageUrl ?? featured?.coverImageUrl ?? null;

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-media" aria-hidden="true">
          {featuredImageUrl ? (
            <Image
              src={featuredImageUrl}
              alt=""
              fill
              unoptimized={featuredImageUrl.startsWith("/media/")}
              priority
              sizes="100vw"
              className="home-hero-image object-cover"
            />
          ) : null}
          <div className="home-hero-shade" />
        </div>
        <SiteHeader user={session?.user ?? null} active="home" overlay />

        <div className="home-hero-content">
          <p className="home-eyebrow">Campanha privada · arquivo operacional</p>
          {featured ? (
            <>
              <h1>
                <span>{nameParts[0]}</span>
                <strong>{nameParts.slice(1).join(" ")}</strong>
              </h1>
              <p className="home-lead">{featured.shortDescription}</p>
              <div className="home-actions">
                <Link
                  href={session ? `/campaigns/${featured.slug}` : `/login?next=%2Fcampaigns%2F${featured.slug}`}
                  className="home-primary-action"
                >
                  {session ? "Entrar na campanha" : "Acessar arquivo"}
                  <span aria-hidden="true">→</span>
                </Link>
                {!session ? <Link href="/register" className="home-secondary-action">Criar jogador</Link> : null}
              </div>
            </>
          ) : (
            <>
              <h1><span>RPG</span><strong>Vitin</strong></h1>
              <p className="home-lead">Sua central privada de campanhas.</p>
            </>
          )}
        </div>

        {featured ? (
          <div className="home-operation-meta">
            <span>01</span>
            <div><strong>{featured.genre}</strong><small>Arquivo privado</small></div>
          </div>
        ) : null}
      </section>

      <section className="home-archive" aria-labelledby="archive-title">
        <div className="home-archive-heading">
          <div>
            <p className="campaign-kicker">Arquivo disponível</p>
            <h2 id="archive-title">Campanhas</h2>
          </div>
          <p>Entre na operação ativa ou acompanhe os próximos universos que forem criados pelo administrador.</p>
        </div>
        {featured ? (
          <div className="home-campaign-list">
            <CampaignCard campaign={featured} featured />
            {remaining.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}
          </div>
        ) : (
          <EmptyState
            eyebrow="Arquivo vazio"
            title="Nenhuma campanha foi criada."
            description="Use a central administrativa para cadastrar o primeiro universo."
            action={session?.user.role === "admin" ? { label: "Criar campanha", href: "/admin?view=campaigns" } : undefined}
          />
        )}
      </section>
    </main>
  );
}
