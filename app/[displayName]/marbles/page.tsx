import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicStatsRootGameForDisplayName } from "@/lib/publicStatsUser";
import { publicStatsGamePath } from "@/lib/publicStatsRoutes";
import { MarblesStatsPage, generateMarblesMetadata } from "./MarblesStatsPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicMarblesPageProps = {
  params: Promise<{ displayName: string }>;
};

export async function generateMetadata(props: PublicMarblesPageProps): Promise<Metadata> {
  return generateMarblesMetadata(props);
}

export default async function PublicMarblesPage({ params }: PublicMarblesPageProps) {
  const { displayName } = await params;
  const rootGame = await getPublicStatsRootGameForDisplayName(displayName);

  if (rootGame === "marbles") {
    redirect(publicStatsGamePath(displayName, "marbles", rootGame));
  }

  return <MarblesStatsPage params={Promise.resolve({ displayName })} />;
}
