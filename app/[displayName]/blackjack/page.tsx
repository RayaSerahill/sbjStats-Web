import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicStatsRootGameForDisplayName } from "@/lib/publicStatsUser";
import { publicStatsGamePath } from "@/lib/publicStatsRoutes";
import { BlackjackStatsPage, generateBlackjackMetadata } from "./BlackjackStatsPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicBlackjackPageProps = {
  params: Promise<{ displayName: string }>;
};

export async function generateMetadata(props: PublicBlackjackPageProps): Promise<Metadata> {
  return generateBlackjackMetadata(props);
}

export default async function PublicBlackjackPage({ params }: PublicBlackjackPageProps) {
  const { displayName } = await params;
  const rootGame = await getPublicStatsRootGameForDisplayName(displayName);

  if (rootGame === "blackjack") {
    redirect(publicStatsGamePath(displayName, "blackjack", rootGame));
  }

  return <BlackjackStatsPage params={Promise.resolve({ displayName })} />;
}
