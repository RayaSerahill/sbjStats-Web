import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicStatsRootGameForDisplayName } from "@/lib/publicStatsUser";
import { publicStatsGamePath } from "@/lib/publicStatsRoutes";
import { WheelStatsPage, generateWheelMetadata } from "./WheelStatsPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicWheelPageProps = {
  params: Promise<{ displayName: string }>;
};

export async function generateMetadata(props: PublicWheelPageProps): Promise<Metadata> {
  return generateWheelMetadata(props);
}

export default async function PublicWheelPage({ params }: PublicWheelPageProps) {
  const { displayName } = await params;
  const rootGame = await getPublicStatsRootGameForDisplayName(displayName);

  if (rootGame === "wheel") {
    redirect(publicStatsGamePath(displayName, "wheel", rootGame));
  }

  return <WheelStatsPage params={Promise.resolve({ displayName })} />;
}
