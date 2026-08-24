import Link from "next/link";

import {
  campaignStatusLabel,
  campaignThemeStyle,
} from "@/components/campaigns/campaign-presenters";
import { SiteHeader } from "@/components/site/site-header";
import type { Campaign, User } from "@/domain/entities";

export function CampaignAccessPending({
  campaign,
  user,
}: {
  campaign: Campaign;
  user: User;
}) {
  return (
    <main
      className="campaign-theme min-h-screen"
      style={campaignThemeStyle(campaign.primaryColor, campaign.secondaryColor)}
    >
      <SiteHeader user={user} active="campaigns" />
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center px-5 py-14 sm:px-8">
        <section className="w-full border border-white/10 bg-black/25 p-7 sm:p-12">
          <div className="flex flex-wrap items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-amber-300" aria-hidden="true" />
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-200">
              Participação pendente
            </p>
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.045em] text-zinc-50 sm:text-5xl">
            Seu acesso a {campaign.name} aguarda aprovação.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">
            A campanha está {campaignStatusLabel(campaign.status).toLocaleLowerCase("pt-BR")},
            mas o conteúdo narrativo só será liberado quando um administrador ou mestre
            aprovar sua participação.
          </p>
          <Link
            href="/campaigns"
            className="mt-8 inline-flex min-h-12 items-center border border-white/15 px-5 text-sm font-semibold text-zinc-100 transition hover:border-white/35"
          >
            Voltar às minhas campanhas
          </Link>
        </section>
      </div>
    </main>
  );
}
