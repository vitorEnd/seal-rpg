import { NextResponse } from "next/server";

import {
  canReadCampaignMedia,
  classifyCampaignMediaReference,
} from "@/application/storage/media-access";
import { getCurrentSession } from "@/lib/auth/current-user";
import { fileStorageProvider, repositories } from "@/lib/container";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  if (key.length !== 2) {
    return new NextResponse(null, { status: 404 });
  }

  const storageKey = key.join("/");
  const campaign = await repositories.campaigns.findById(key[0]);
  if (!campaign) {
    return new NextResponse(null, { status: 404 });
  }

  const [chapters, characters, classOptions, files] = await Promise.all([
    repositories.campaignChapters.listByCampaign(campaign.id),
    repositories.characters.listByCampaign(campaign.id),
    repositories.characterClassOptions.listByCampaign(campaign.id),
    repositories.files.listByCampaign(campaign.id),
  ]);
  const reference = classifyCampaignMediaReference({
    storageKey,
    campaign,
    chapters,
    characters,
    classOptions,
    files,
  });
  if (reference.kind === "unknown") {
    return new NextResponse(null, { status: 404 });
  }

  if (!canReadCampaignMedia(reference, campaign, null, null)) {
    const session = await getCurrentSession();
    if (!session) return new NextResponse(null, { status: 404 });
    const membership = await repositories.campaignMembers.findMembership(
      campaign.id,
      session.user.id,
    );
    if (!canReadCampaignMedia(reference, campaign, session.user, membership)) {
      return new NextResponse(null, { status: 404 });
    }
  }

  const content = await fileStorageProvider.read(storageKey);
  if (!content) {
    return new NextResponse(null, { status: 404 });
  }
  const body = new ArrayBuffer(content.bytes.byteLength);
  new Uint8Array(body).set(content.bytes);
  return new NextResponse(body, {
    headers: {
      "Content-Type": content.mimeType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
