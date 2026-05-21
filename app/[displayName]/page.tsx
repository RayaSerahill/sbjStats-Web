import type { Metadata } from "next";
import { BlackjackStatsPage, generateBlackjackMetadata } from "./blackjack/BlackjackStatsPage";
import { ScratchStatsPage, generateScratchMetadata } from "./scratch/ScratchStatsPage";
import { getPublicStatsRootGameForDisplayName } from "@/lib/publicStatsUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicStatsPageProps = {
  params: Promise<{ displayName: string }>;
};

export async function generateMetadata({ params }: PublicStatsPageProps): Promise<Metadata> {
  const { displayName } = await params;
  const rootGame = await getPublicStatsRootGameForDisplayName(displayName);
  const childParams = Promise.resolve({ displayName });

  return rootGame === "scratch"
    ? generateScratchMetadata({ params: childParams })
    : generateBlackjackMetadata({ params: childParams });
}

export default async function PublicStatsRootPage({ params }: PublicStatsPageProps) {
  const { displayName } = await params;
  const rootGame = await getPublicStatsRootGameForDisplayName(displayName);
  const childParams = Promise.resolve({ displayName });

  return rootGame === "scratch" ? (
    <ScratchStatsPage params={childParams} />
  ) : (
    <BlackjackStatsPage params={childParams} />
  );
}
