import type { Metadata } from "next";
import { getDashboardSession } from "@/app/dashboard/dashboardSession";
import { ensureGameCollections, getDb } from "@/lib/db";
import { calculateWheelStats } from "@/lib/wheelStats";
import { loadWheelStatsForUser } from "@/app/[displayName]/wheel/loadStats";
import { WheelLiveEditor } from "./WheelLiveEditor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Wheel live editor | SimpleStats" };

/**
 * The host's own public wheel page in Fortune clothes, with every
 * surface clickable. Lives outside the dashboard shell on purpose so it
 * looks exactly like the real page.
 */
export default async function WheelLiveEditorPage() {
  const session = await getDashboardSession();
  await ensureGameCollections();
  const db = await getDb();

  const data = await loadWheelStatsForUser(db, session.user, {
    displayName: session.userLabel,
    username: session.user.username ?? session.userLabel,
  });
  const stats = calculateWheelStats(data);

  return (
    <WheelLiveEditor
      displayName={data.displayName}
      username={data.username}
      rootGame={data.publicStatsRootGame}
      style={data.style}
      stats={stats}
      hasGames={data.games.length > 0}
    />
  );
}
