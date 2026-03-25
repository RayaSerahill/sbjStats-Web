import "server-only";

import type { Db, ObjectId } from "mongodb";
import { getDb } from "./db";
import {
  normalizeStatsStyle,
  DEFAULT_STATS_STYLE,
  getStatsFontFamily,
  getBackgroundStyleCss,
  type NormalizedStatsStyle,
  type StatsBackgroundStyle,
  type StatsFontStyle,
  type StatsNavItemStyle,
  type StatsBackgroundMode,
  type StatsImageFit,
  type StatsGradientDirection,
} from "./statsStyleShared";

export type { StatsBackgroundStyle, StatsFontStyle, StatsNavItemStyle, StatsBackgroundMode, StatsImageFit, StatsGradientDirection };

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
  scratchBackground: StatsBackgroundStyle;
  scratchContainerBackground: StatsBackgroundStyle;
  scratchElementBackground: StatsBackgroundStyle;
  scratchFontColor: string;
  scratchFontStyle: StatsFontStyle;
  scratchLeaderboardSize: number;
  scratchChartCardsColor: string;
  scratchChartWinsColor: string;
  scratchChartValueColor: string;
  scratchLeaderboardTableBackground: StatsBackgroundStyle;
  scratchLeaderboardTableHeaderBackground: StatsBackgroundStyle;
  scratchLeaderboardTableHeaderTextColor: string;
  scratchLeaderboardTabContainerBackground: StatsBackgroundStyle;
  scratchLeaderboardTabActiveBackground: StatsBackgroundStyle;
  scratchLeaderboardTabInactiveBackground: StatsBackgroundStyle;
  scratchLeaderboardTabHoverBackground: StatsBackgroundStyle;
  scratchLeaderboardTabActiveTextColor: string;
  scratchLeaderboardTabInactiveTextColor: string;
  scratchLeaderboardTabHoverTextColor: string;
  publicNavShowBlackjack: boolean;
  publicNavShowScratch: boolean;
  publicNavBackground: StatsBackgroundStyle;
  publicNavBorderRadius: number;
  publicNavFontColor: string;
  publicNavFontSize: number;
  publicNavFontStyle: StatsFontStyle;
  publicNavInactive: StatsNavItemStyle;
  publicNavHover: StatsNavItemStyle;
  publicNavActive: StatsNavItemStyle;
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
    | "scratchBackground"
    | "scratchContainerBackground"
    | "scratchElementBackground"
    | "scratchFontColor"
    | "scratchFontStyle"
    | "scratchLeaderboardSize"
    | "scratchChartCardsColor"
    | "scratchChartWinsColor"
    | "scratchChartValueColor"
    | "scratchLeaderboardTableBackground"
    | "scratchLeaderboardTableHeaderBackground"
    | "scratchLeaderboardTableHeaderTextColor"
    | "scratchLeaderboardTabContainerBackground"
    | "scratchLeaderboardTabActiveBackground"
    | "scratchLeaderboardTabInactiveBackground"
    | "scratchLeaderboardTabHoverBackground"
    | "scratchLeaderboardTabActiveTextColor"
    | "scratchLeaderboardTabInactiveTextColor"
    | "scratchLeaderboardTabHoverTextColor"
    | "publicNavShowBlackjack"
    | "publicNavShowScratch"
    | "publicNavBackground"
    | "publicNavBorderRadius"
    | "publicNavFontColor"
    | "publicNavFontSize"
    | "publicNavFontStyle"
    | "publicNavInactive"
    | "publicNavHover"
    | "publicNavActive"
  >
>;

export { normalizeStatsStyle, DEFAULT_STATS_STYLE, getStatsFontFamily, getBackgroundStyleCss };

export async function getStatsStyleForUploader(uploaderId: string, db?: Db): Promise<NormalizedStatsStyle> {
  const database = db ?? (await getDb());
  const styles = database.collection<StatsStyleDoc>("stats_styles");
  const row = await styles.findOne({ uploaderId });
  return normalizeStatsStyle(row ?? undefined);
}
