import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { AUTH_COOKIE_NAME, authCookieOptions, signAuthToken, verifyAuthToken } from "@/lib/auth";
import { ensureAuthCollections, getDb, type UserDoc, type UserRole } from "@/lib/db";
import { findRegistrationWhitelistMatch } from "@/lib/whitelist";

const STATE_COOKIE = "discord_oauth_state";
const MODE_COOKIE = "discord_oauth_mode";

type DiscordTokenResponse = {
  access_token?: string;
  token_type?: string;
};

type DiscordUserResponse = {
  id?: string;
  username?: string;
  global_name?: string | null;
  email?: string;
};

function getBaseUrl(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function clearOauthCookies(res: NextResponse) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  res.cookies.set(STATE_COOKIE, "", cookieOptions);
  res.cookies.set(MODE_COOKIE, "", cookieOptions);
  return res;
}

export async function GET(req: Request) {
  await ensureAuthCollections();

  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const error = url.searchParams.get("error");
  const baseUrl = getBaseUrl(req);

  if (error) {
    return clearOauthCookies(NextResponse.redirect(new URL(`/dashboard/register?error=${encodeURIComponent("Discord sign-in was cancelled")}`, baseUrl)));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value ?? "";
  const mode = cookieStore.get(MODE_COOKIE)?.value === "connect" ? "connect" : "login";
  if (!code || !state || !expectedState || state !== expectedState) {
    const target = mode === "connect"
      ? `/dashboard?error=${encodeURIComponent("Discord sign-in could not be verified")}`
      : `/dashboard/register?error=${encodeURIComponent("Discord sign-in could not be verified")}`;
    return clearOauthCookies(NextResponse.redirect(new URL(target, baseUrl)));
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const target = mode === "connect"
      ? `/dashboard?error=${encodeURIComponent("Discord auth is not configured")}`
      : `/dashboard/register?error=${encodeURIComponent("Discord auth is not configured")}`;
    return clearOauthCookies(NextResponse.redirect(new URL(target, baseUrl)));
  }

  const redirectUri = `${baseUrl}/api/auth/discord/callback`;

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      cache: "no-store",
    });

    if (!tokenRes.ok) {
      throw new Error("Failed token exchange");
    }

    const tokenData = (await tokenRes.json()) as DiscordTokenResponse;
    const accessToken = tokenData.access_token ?? "";
    if (!accessToken) throw new Error("Missing access token");

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!userRes.ok) {
      throw new Error("Failed user lookup");
    }

    const discordUser = (await userRes.json()) as DiscordUserResponse;
    const discordId = (discordUser.id ?? "").trim();
    const email = (discordUser.email ?? "").trim().toLowerCase();
    const usernameFromDiscord = (discordUser.username ?? "").trim();
    const globalName = (discordUser.global_name ?? "").trim();
    const name = globalName || usernameFromDiscord;

    if (!discordId) {
      throw new Error("Discord did not return a user id");
    }

    const db = await getDb();
    const users = db.collection<UserDoc>("users");

    if (mode === "connect") {
      const authToken = cookieStore.get(AUTH_COOKIE_NAME)?.value ?? "";
      if (!authToken) {
        return clearOauthCookies(NextResponse.redirect(new URL(`/dashboard/login?error=${encodeURIComponent("Please sign in before connecting Discord")}`, baseUrl)));
      }

      const auth = await verifyAuthToken(authToken).catch(() => null);
      if (!auth?.id) {
        return clearOauthCookies(NextResponse.redirect(new URL(`/dashboard/login?error=${encodeURIComponent("Please sign in before connecting Discord")}`, baseUrl)));
      }

      const currentUserId = new ObjectId(auth.id);
      const currentUser = await users.findOne({ _id: currentUserId, deleted: { $ne: true } });
      if (!currentUser) {
        return clearOauthCookies(NextResponse.redirect(new URL(`/dashboard/login?error=${encodeURIComponent("Account not available")}`, baseUrl)));
      }

      const linkedElsewhere = await users.findOne({ discord: discordId, _id: { $ne: currentUserId }, deleted: { $ne: true } }, { projection: { _id: 1 } });
      if (linkedElsewhere?._id) {
        return clearOauthCookies(NextResponse.redirect(new URL(`/dashboard?error=${encodeURIComponent("That Discord account is already connected to another user")}`, baseUrl)));
      }

      await users.updateOne(
        { _id: currentUserId },
        {
          $set: {
            discord: discordId,
            updatedAt: new Date(),
          },
        }
      );

      return clearOauthCookies(NextResponse.redirect(new URL(`/dashboard?success=${encodeURIComponent("Discord account connected")}`, baseUrl)));
    }

    let existing = await users.findOne({ discord: discordId, deleted: { $ne: true } });
    if (!existing && email) {
      existing = await users.findOne({ email, deleted: { $ne: true } });
    }

    let id = "";
    let role: UserRole = "dealer";

    if (existing?._id) {
      id = existing._id.toHexString();
      role = existing.role ?? "dealer";
      await users.updateOne(
        { _id: existing._id },
        {
          $set: {
            discord: existing.discord || discordId,
            name: existing.name || name || undefined,
            updatedAt: new Date(),
          },
        }
      );
    } else {
      if (!email) {
        throw new Error("Discord did not return an email address");
      }

      const whitelistMatch = await findRegistrationWhitelistMatch(db, { email, discord: discordId });
      if (!whitelistMatch) {
        return clearOauthCookies(
          NextResponse.redirect(
            new URL(
              `/dashboard/register?error=${encodeURIComponent("Your email address or Discord ID is not whitelisted for registration")}`,
              baseUrl
            )
          )
        );
      }

      const existingCount = await users.countDocuments({}, { limit: 2 });
      role = existingCount === 0 ? "owner" : "dealer";
      const now = new Date();
      const insert = await users.insertOne({
        email,
        passwordHash: "",
        name: name || undefined,
        username: undefined,
        discord: discordId,
        role,
        deleted: false,
        createdAt: now,
        updatedAt: now,
      });
      id = insert.insertedId.toHexString();
    }

    const token = await signAuthToken({ id, email: existing?.email ?? email, role });
    const res = NextResponse.redirect(new URL("/dashboard", baseUrl));
    res.cookies.set(AUTH_COOKIE_NAME, token, authCookieOptions());
    return clearOauthCookies(res);
  } catch {
    const target = mode === "connect"
      ? `/dashboard?error=${encodeURIComponent("Discord connection failed")}`
      : `/dashboard/register?error=${encodeURIComponent("Discord sign-in failed")}`;
    return clearOauthCookies(NextResponse.redirect(new URL(target, baseUrl)));
  }
}
