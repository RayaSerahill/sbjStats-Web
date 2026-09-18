import { headers } from "next/headers";
import {
  DISCORD_COMPONENT_EMBED_SCRIPT_ID,
  buildHostStatsComponentEmbed,
  serializeDiscordComponentEmbed,
  type DiscordComponentEmbedGame,
} from "@/lib/discordComponentEmbed";
import { normalizePublicStatsOrigin, type PublicStatsGame } from "@/lib/publicStatsRoutes";

type DiscordComponentEmbedProps = {
  displayName: string;
  username: string;
  rootGame: PublicStatsGame;
  games: DiscordComponentEmbedGame[];
};

async function getPublicStatsRequestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  // Only the known public stats domains are used; anything else falls back to the default.
  return normalizePublicStatsOrigin(host ? `${proto}://${host}` : "");
}

/**
 * Renders the Discord "component embed" link-preview payload for a host's stats page.
 * Discord looks for `<script id="discord:component-embed" type="application/json">`.
 */
export async function DiscordComponentEmbed({ displayName, username, rootGame, games }: DiscordComponentEmbedProps) {
  const origin = await getPublicStatsRequestOrigin();
  const payload = buildHostStatsComponentEmbed({ displayName, username, rootGame, origin, games });

  return (
    <script
      id={DISCORD_COMPONENT_EMBED_SCRIPT_ID}
      type="application/json"
      dangerouslySetInnerHTML={{ __html: serializeDiscordComponentEmbed(payload) }}
    />
  );
}
