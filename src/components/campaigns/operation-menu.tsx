"use client";

import Link from "next/link";
import { useScramble } from "use-scramble";

import {
  campaignSections,
  type CampaignSectionId,
} from "@/components/campaigns/campaign-presenters";

const SAFE_SCRAMBLE_GLYPHS = [
  35, 42, 43, 45, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 65, 66, 67,
  68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85,
  86, 87, 88, 89, 90,
] as [number, number, ...number[]];

function OperationMenuItem({
  section,
  campaignSlug,
  activeSection,
}: {
  section: (typeof campaignSections)[number];
  campaignSlug: string;
  activeSection: CampaignSectionId;
}) {
  const { ref, replay } = useScramble({
    text: section.label,
    playOnMount: false,
    speed: 0.72,
    tick: 1,
    step: 2,
    seed: 2,
    scramble: 3,
    overflow: false,
    overdrive: 95,
    range: SAFE_SCRAMBLE_GLYPHS,
  });

  return (
    <Link
      href={`/campaigns/${encodeURIComponent(campaignSlug)}${section.path}#campaign-content`}
      aria-label={section.label}
      aria-current={activeSection === section.id ? "page" : undefined}
      className="operation-menu-item"
      onPointerEnter={replay}
      onFocus={replay}
    >
      <span className="operation-menu-number" aria-hidden="true">
        {section.number}
      </span>
      <strong ref={ref} aria-hidden="true">
        {section.label}
      </strong>
      <i aria-hidden="true">→</i>
    </Link>
  );
}

export function OperationMenu({
  campaignSlug,
  campaignName,
  activeSection,
}: {
  campaignSlug: string;
  campaignName: string;
  activeSection: CampaignSectionId;
}) {
  return (
    <nav className="operation-menu" aria-label={`Menu de ${campaignName}`}>
      {campaignSections.map((section) => (
        <OperationMenuItem
          key={section.id}
          section={section}
          campaignSlug={campaignSlug}
          activeSection={activeSection}
        />
      ))}
    </nav>
  );
}
