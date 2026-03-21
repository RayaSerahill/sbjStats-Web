import "server-only";

import type { Db, ObjectId } from "mongodb";
import { getDb } from "./db";
import {
  normalizeStatsStyle,
  DEFAULT_STATS_STYLE,
  DEFAULT_STATS_LAYOUT_MARKDOWN,
  getStatsFontFamily,
  getBackgroundStyleCss,
  type NormalizedStatsStyle,
  type StatsBackgroundStyle,
  type StatsFontStyle,
  type StatsBackgroundMode,
  type StatsImageFit,
  type StatsGradientDirection,
} from "./statsStyleShared";

export type { StatsBackgroundStyle, StatsFontStyle, StatsBackgroundMode, StatsImageFit, StatsGradientDirection };

export type StatsStyleDoc = {
  _id?: ObjectId;
  uploaderId: string;
  background: StatsBackgroundStyle;
  containerBackground: StatsBackgroundStyle;
  elementBackground: StatsBackgroundStyle;
  fontColor: string;
  fontStyle: StatsFontStyle;
  leaderboardSize: number;
  pieChartColors: string[];
  barChartProfitColor: string;
  barChartLossColor: string;
  barChartDays: number;
  layoutMarkdown: string;
  createdAt: Date;
  updatedAt: Date;
};

export type StatsStyleInput = Partial<
  Pick<
    StatsStyleDoc,
    | "background"
    | "containerBackground"
    | "elementBackground"
    | "fontColor"
    | "fontStyle"
    | "leaderboardSize"
    | "pieChartColors"
    | "barChartProfitColor"
    | "barChartLossColor"
    | "barChartDays"
    | "layoutMarkdown"
  >
>;

export { normalizeStatsStyle, DEFAULT_STATS_STYLE, DEFAULT_STATS_LAYOUT_MARKDOWN, getStatsFontFamily, getBackgroundStyleCss };

export async function getStatsStyleForUploader(uploaderId: string, db?: Db): Promise<NormalizedStatsStyle> {
  const database = db ?? (await getDb());
  const styles = database.collection<StatsStyleDoc>("stats_styles");
  const row = await styles.findOne({ uploaderId });
  return normalizeStatsStyle(row ?? undefined);
}
