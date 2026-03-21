import type { ReactNode } from "react";
import { getBackgroundStyleCss, type StatsBackgroundStyle } from "@/lib/statsStyleShared";

export type StatsLayoutPlayerRow = {
  playerTag: string;
  name: string;
  world: string;
  games: number;
  betTotal: number;
  payoutTotal: number;
  net: number;
};

export type StatsLayoutStyle = {
  fontColor: string;
  leaderboardSize: number;
  containerBackground: StatsBackgroundStyle;
  elementBackground: StatsBackgroundStyle;
  layoutMarkdown: string;
};

export type StatsLayoutData = {
  displayName: string;
  username: string;
  uploaderId: string;
  newestHostTag: string;
  roundsHosted: number;
  totalNet: number;
  dealerNet: number;
  totalBet: number;
  totalPayout: number;
  playerNet: number;
  totalPlayers: number;
  topWinners: StatsLayoutPlayerRow[];
  topLosers: StatsLayoutPlayerRow[];
  topActive: StatsLayoutPlayerRow[];
};

type Props = {
  data: StatsLayoutData;
  style: StatsLayoutStyle;
  dealerCharts: ReactNode;
};

type Block =
  | { type: "widget"; value: string }
  | { type: "heading"; depth: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "blockquote"; text: string }
  | { type: "hr" };

function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function fmtMoney(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "+";
  return `${sign}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(abs)}`;
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];

  for (let i = 0; i < lines.length; ) {
    const line = lines[i]?.trim() ?? "";
    if (!line) {
      i += 1;
      continue;
    }

    const widgetMatch = line.match(/^\{\{([a-z0-9:-]+)\}\}$/i);
    if (widgetMatch) {
      blocks.push({ type: "widget", value: widgetMatch[1].toLowerCase() });
      i += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        depth: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      i += 1;
      continue;
    }

    if (/^-{3,}$/.test(line)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    if (/^>\s+/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const current = lines[i]?.trim() ?? "";
        if (!/^>\s+/.test(current)) break;
        quoteLines.push(current.replace(/^>\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join(" ") });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i]?.trim() ?? "";
        if (!/^[-*]\s+/.test(current)) break;
        items.push(current.replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const current = lines[i]?.trim() ?? "";
      if (!current) break;
      if (/^\{\{[a-z0-9:-]+\}\}$/i.test(current)) break;
      if (/^(#{1,3})\s+/.test(current)) break;
      if (/^[-*]\s+/.test(current)) break;
      if (/^>\s+/.test(current)) break;
      if (/^-{3,}$/.test(current)) break;
      paragraphLines.push(current);
      i += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function renderInline(text: string, placeholders: Record<string, string>, keyPrefix: string, fontColor: string) {
  const resolved = text.replace(/\{\{([a-zA-Z0-9]+)\}\}/g, (match, key) => placeholders[key] ?? match);
  const parts = resolved.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-bold-${index}`} style={{ color: fontColor }}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`${keyPrefix}-code-${index}`}
          className="rounded-md border border-black/10 px-1.5 py-0.5 text-[0.95em]"
          style={{ color: fontColor }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={`${keyPrefix}-text-${index}`}>{part}</span>;
  });
}

function LeaderboardCard({
  title,
  subtitle,
  emptyLabel,
  rows,
  valueMode,
  fontColor,
  elementBackgroundStyle,
}: {
  title: string;
  subtitle: string;
  emptyLabel: string;
  rows: StatsLayoutPlayerRow[];
  valueMode: "net" | "games";
  fontColor: string;
  elementBackgroundStyle: ReturnType<typeof getBackgroundStyleCss>;
}) {
  return (
    <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold" style={{ color: fontColor }}>
          {title}
        </h2>
        <span className="text-xs" style={{ color: fontColor, opacity: 0.7 }}>
          {subtitle}
        </span>
      </div>
      <ol className="mt-3 space-y-2 text-sm" style={{ color: fontColor }}>
        {rows.length ? (
          rows.map((player, index) => (
            <li key={`${player.playerTag}-${index}`} className="flex items-center justify-between gap-3">
              <span className="truncate">
                <span className="mr-2 text-xs" style={{ color: fontColor, opacity: 0.7 }}>
                  #{index + 1}
                </span>
                <span className="font-medium">{player.playerTag}</span>
              </span>
              <span className="shrink-0 font-medium">{valueMode === "games" ? fmtInt(player.games) : fmtMoney(player.net)}</span>
            </li>
          ))
        ) : (
          <li style={{ color: fontColor, opacity: 0.75 }}>{emptyLabel}</li>
        )}
      </ol>
    </div>
  );
}

export function StatsLayoutRenderer({ data, style, dealerCharts }: Props) {
  const blocks = parseBlocks(style.layoutMarkdown);
  const elementBackgroundStyle = getBackgroundStyleCss(style.elementBackground);
  const placeholders: Record<string, string> = {
    dealerName: data.displayName,
    displayName: data.displayName,
    username: data.username,
    usernameOrName: data.username || data.displayName,
    newestHostTag: data.newestHostTag || "unknown",
    roundsHosted: fmtInt(data.roundsHosted),
    totalPlayers: fmtInt(data.totalPlayers),
    totalNet: fmtMoney(data.totalNet),
    dealerNet: fmtMoney(data.dealerNet),
    playerNet: fmtMoney(data.playerNet),
    totalBet: fmtInt(data.totalBet),
    totalPayout: fmtInt(data.totalPayout),
    leaderboardSize: fmtInt(style.leaderboardSize),
  };

  const renderWidget = (widget: string, index: number) => {
    switch (widget) {
      case "empty-state":
        if (data.roundsHosted > 0) return null;
        return (
          <div
            key={`widget-${index}`}
            className="rounded-2xl border border-black/10 p-4 text-sm shadow-sm"
            style={{ ...elementBackgroundStyle, color: style.fontColor }}
          >
            No rounds uploaded yet.
          </div>
        );

      case "summary":
        return (
          <div key={`widget-${index}`} className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
              <div className="text-xs font-medium opacity-70" style={{ color: style.fontColor }}>
                Rounds hosted
              </div>
              <div className="mt-2 text-2xl font-semibold" style={{ color: style.fontColor }}>
                {fmtInt(data.roundsHosted)}
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
              <div className="text-xs font-medium opacity-70" style={{ color: style.fontColor }}>
                Profit / loss (dealer)
              </div>
              <div className="mt-2 text-2xl font-semibold" style={{ color: style.fontColor }}>
                {fmtMoney(data.dealerNet)}
              </div>
              <div className="mt-1 text-xs opacity-70" style={{ color: style.fontColor }}>
                Players net: {fmtMoney(data.playerNet)}
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
              <div className="text-xs font-medium opacity-70" style={{ color: style.fontColor }}>
                Volume
              </div>
              <div className="mt-2 space-y-2 text-sm" style={{ color: style.fontColor }}>
                <div className="flex items-center justify-between gap-3">
                  <span style={{ opacity: 0.75 }}>Total bet</span>
                  <span className="font-medium">{fmtInt(data.totalBet)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span style={{ opacity: 0.75 }}>Total payout</span>
                  <span className="font-medium">{fmtInt(data.totalPayout)}</span>
                </div>
              </div>
            </div>
          </div>
        );

      case "leaderboard:winners":
        return (
          <LeaderboardCard
            key={`widget-${index}`}
            title={`Top ${style.leaderboardSize} winners`}
            subtitle="by net"
            emptyLabel="No winners yet."
            rows={data.topWinners}
            valueMode="net"
            fontColor={style.fontColor}
            elementBackgroundStyle={elementBackgroundStyle}
          />
        );

      case "leaderboard:losers":
        return (
          <LeaderboardCard
            key={`widget-${index}`}
            title={`Top ${style.leaderboardSize} losers`}
            subtitle="by net"
            emptyLabel="No losers yet."
            rows={data.topLosers}
            valueMode="net"
            fontColor={style.fontColor}
            elementBackgroundStyle={elementBackgroundStyle}
          />
        );

      case "leaderboard:active":
        return (
          <LeaderboardCard
            key={`widget-${index}`}
            title={`Top ${style.leaderboardSize} most active`}
            subtitle="by games"
            emptyLabel="No players yet."
            rows={data.topActive}
            valueMode="games"
            fontColor={style.fontColor}
            elementBackgroundStyle={elementBackgroundStyle}
          />
        );

      case "leaderboards":
        return (
          <div key={`widget-${index}`} className="grid gap-4 lg:grid-cols-3">
            <LeaderboardCard
              title={`Top ${style.leaderboardSize} winners`}
              subtitle="by net"
              emptyLabel="No winners yet."
              rows={data.topWinners}
              valueMode="net"
              fontColor={style.fontColor}
              elementBackgroundStyle={elementBackgroundStyle}
            />
            <LeaderboardCard
              title={`Top ${style.leaderboardSize} losers`}
              subtitle="by net"
              emptyLabel="No losers yet."
              rows={data.topLosers}
              valueMode="net"
              fontColor={style.fontColor}
              elementBackgroundStyle={elementBackgroundStyle}
            />
            <LeaderboardCard
              title={`Top ${style.leaderboardSize} most active`}
              subtitle="by games"
              emptyLabel="No players yet."
              rows={data.topActive}
              valueMode="games"
              fontColor={style.fontColor}
              elementBackgroundStyle={elementBackgroundStyle}
            />
          </div>
        );

      case "dealer-charts":
        return <div key={`widget-${index}`}>{dealerCharts}</div>;

      case "footer-note":
        return (
          <div
            key={`widget-${index}`}
            className="rounded-2xl border border-black/10 p-4 text-xs shadow-[0_0_0_1px_rgba(0,0,0,0.04)]"
            style={{ ...elementBackgroundStyle, color: style.fontColor }}
          >
            Stats are usually updated after each hosting session.
          </div>
        );

      default:
        return (
          <div
            key={`widget-${index}`}
            className="rounded-2xl border border-amber-300/70 p-4 text-sm"
            style={{ ...elementBackgroundStyle, color: style.fontColor }}
          >
            Unknown layout widget: <code>{widget}</code>
          </div>
        );
    }
  };

  return (
    <div className="mt-2 space-y-6">
      {blocks.map((block, index) => {
        if (block.type === "widget") return renderWidget(block.value, index);

        if (block.type === "heading") {
          if (block.depth === 1) {
            return (
              <div key={`block-${index}`} className="space-y-2">
                <h1 className="text-2xl font-semibold" style={{ color: style.fontColor }}>
                  {renderInline(block.text, placeholders, `h1-${index}`, style.fontColor)}
                </h1>
              </div>
            );
          }

          if (block.depth === 2) {
            return (
              <h2 key={`block-${index}`} className="text-xl font-semibold" style={{ color: style.fontColor }}>
                {renderInline(block.text, placeholders, `h2-${index}`, style.fontColor)}
              </h2>
            );
          }

          return (
            <h3 key={`block-${index}`} className="text-lg font-semibold" style={{ color: style.fontColor }}>
              {renderInline(block.text, placeholders, `h3-${index}`, style.fontColor)}
            </h3>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p key={`block-${index}`} className="text-sm leading-7" style={{ color: style.fontColor }}>
              {renderInline(block.text, placeholders, `p-${index}`, style.fontColor)}
            </p>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={`block-${index}`} className="list-disc space-y-2 pl-5 text-sm leading-7" style={{ color: style.fontColor }}>
              {block.items.map((item, itemIndex) => (
                <li key={`li-${index}-${itemIndex}`}>{renderInline(item, placeholders, `li-${index}-${itemIndex}`, style.fontColor)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "blockquote") {
          return (
            <div
              key={`block-${index}`}
              className="rounded-2xl border border-black/10 p-4 text-sm shadow-sm"
              style={{ ...elementBackgroundStyle, color: style.fontColor }}
            >
              {renderInline(block.text, placeholders, `quote-${index}`, style.fontColor)}
            </div>
          );
        }

        return <div key={`block-${index}`} className="h-px bg-black/10" />;
      })}
    </div>
  );
}
