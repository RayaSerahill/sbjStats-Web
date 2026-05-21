import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicStatsRootGameForDisplayName } from "@/lib/publicStatsUser";
import { publicStatsGamePath } from "@/lib/publicStatsRoutes";
import { ScratchStatsPage, generateScratchMetadata } from "./ScratchStatsPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicScratchPageProps = {
  params: Promise<{ displayName: string }>;
};

export async function generateMetadata(props: PublicScratchPageProps): Promise<Metadata> {
  return generateScratchMetadata(props);
}

export default async function PublicScratchPage({ params }: PublicScratchPageProps) {
  const { displayName } = await params;
  const rootGame = await getPublicStatsRootGameForDisplayName(displayName);

  if (rootGame === "scratch") {
    redirect(publicStatsGamePath(displayName, "scratch", rootGame));
  }

  return <ScratchStatsPage params={Promise.resolve({ displayName })} />;
}
