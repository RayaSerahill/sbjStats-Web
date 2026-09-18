import {
  PUBLIC_STATS_GAME_OPTIONS,
  publicStatsGameLabel,
  publicStatsGamePath,
  type PublicStatsGame,
} from "@/lib/publicStatsRoutes";

/**
 * Discord "component embed" link preview payload.
 * See https://docs.discord.com/developers/link-previews (Components v2 layout).
 */

export const DISCORD_COMPONENT_EMBED_SCRIPT_ID = "discord:component-embed";
export const DISCORD_COMPONENT_EMBED_ACCENT_COLOR = 0xff9fc6;
export const DISCORD_COMPONENT_EMBED_IMAGE_URL = "https://stats.serahill.net/simplestats.png";
export const DISCORD_COMPONENT_EMBED_DESCRIPTION =
  "Look up the stats of this host regarding the games they host inside FFXIV and track your own losses or wins at the same time if you have played on their table!";

// Components v2 type ids.
const COMPONENT_ACTION_ROW = 1;
const COMPONENT_BUTTON = 2;
const COMPONENT_SECTION = 9;
const COMPONENT_TEXT_DISPLAY = 10;
const COMPONENT_THUMBNAIL = 11;
const COMPONENT_CONTAINER = 17;
const BUTTON_STYLE_LINK = 5;

export type DiscordComponentEmbedGame = {
  game: PublicStatsGame;
  enabled: boolean;
};

export type HostStatsComponentEmbedInput = {
  /** Name shown in the embed title. */
  displayName: string;
  /** Public name used in the stats URLs (falls back to displayName). */
  username: string;
  /** The game served at `/<name>`; other games live at `/<name>/<game>`. */
  rootGame: PublicStatsGame;
  /** Absolute origin used to build button links, e.g. https://stats.serahill.net */
  origin: string;
  /** Which games the host has enabled in their public nav. */
  games: DiscordComponentEmbedGame[];
};

export type DiscordComponentEmbedPayload = {
  component: {
    type: typeof COMPONENT_CONTAINER;
    accent_color: number;
    components: unknown[];
  };
};

export function hostStatsComponentEmbedTitle(displayName: string) {
  return `${displayName} hosting stats`;
}

export function hostStatsComponentEmbedButtons({
  username,
  displayName,
  rootGame,
  origin,
  games,
}: HostStatsComponentEmbedInput) {
  const publicName = (username || displayName).trim();
  const base = origin.replace(/\/+$/, "");
  const enabled = new Set(games.filter((g) => g.enabled).map((g) => g.game));

  // Keep the same ordering as the public nav / game options list.
  return PUBLIC_STATS_GAME_OPTIONS.filter((option) => enabled.has(option.key)).map((option) => ({
    type: COMPONENT_BUTTON,
    style: BUTTON_STYLE_LINK,
    label: publicStatsGameLabel(option.key),
    url: `${base}${publicStatsGamePath(publicName, option.key, rootGame)}`,
  }));
}

export function buildHostStatsComponentEmbed(input: HostStatsComponentEmbedInput): DiscordComponentEmbedPayload {
  const buttons = hostStatsComponentEmbedButtons(input);

  const components: unknown[] = [
    {
      type: COMPONENT_SECTION,
      components: [
        {
          type: COMPONENT_TEXT_DISPLAY,
          content: `# ${hostStatsComponentEmbedTitle(input.displayName)}\n${DISCORD_COMPONENT_EMBED_DESCRIPTION}`,
        },
      ],
      accessory: {
        type: COMPONENT_THUMBNAIL,
        media: { url: DISCORD_COMPONENT_EMBED_IMAGE_URL },
      },
    },
  ];

  // Discord rejects empty action rows, so only add one when at least one game is linked.
  if (buttons.length > 0) {
    components.push({ type: COMPONENT_ACTION_ROW, components: buttons });
  }

  return {
    component: {
      type: COMPONENT_CONTAINER,
      accent_color: DISCORD_COMPONENT_EMBED_ACCENT_COLOR,
      components,
    },
  };
}

/**
 * JSON for an inline <script type="application/json">. Escapes characters that
 * could terminate the script element or break inline parsing (including the
 * U+2028 / U+2029 line separators, which are invalid inside inline scripts).
 */
export function serializeDiscordComponentEmbed(payload: DiscordComponentEmbedPayload) {
  const lineSeparators = new RegExp(`[${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, "g");
  return JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(lineSeparators, (ch) => `\\u${ch.charCodeAt(0).toString(16)}`);
}
