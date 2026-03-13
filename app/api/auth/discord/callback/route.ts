import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, authCookieOptions, signAuthToken } from "@/lib/auth";
import { ensureAuthCollections, getDb, type UserDoc, type UserRole } from "@/lib/db";

const STATE_COOKIE = "discord_oauth_state";

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

export async function GET(req: Request) {
  await ensureAuthCollections();

  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const error = url.searchParams.get("error");
  const baseUrl = getBaseUrl(req);

  if (error) {
    return NextResponse.redirect(new URL(`/dashboard/register?error=${encodeURIComponent("Discord sign-in was cancelled")}`, baseUrl));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value ?? "";
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL(`/dashboard/register?error=${encodeURIComponent("Discord sign-in could not be verified")}`, baseUrl));
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL(`/dashboard/register?error=${encodeURIComponent("Discord auth is not configured")}`, baseUrl));
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
    const email = (discordUser.email ?? "").trim().toLowerCase();
    const usernameFromDiscord = (discordUser.username ?? "").trim();
    const name = usernameFromDiscord || (discordUser.global_name ?? "").trim();

    if (!email) {
      throw new Error("Discord did not return an email address");
    }

    const db = await getDb();
    const users = db.collection<UserDoc>("users");
    const existing = await users.findOne({ email, deleted: { $ne: true } });

    let id = "";
    let role: UserRole = "dealer";

    if (existing?._id) {
      id = existing._id.toHexString();
      role = existing.role ?? "dealer";
      await users.updateOne(
        { _id: existing._id },
        {
          $set: {
            name: existing.name || name || undefined,
            updatedAt: new Date(),
          },
        }
      );
    } else {
      const existingCount = await users.countDocuments({}, { limit: 2 });
      role = existingCount === 0 ? "owner" : "dealer";
      const now = new Date();
      const insert = await users.insertOne({
        email,
        passwordHash: "",
        name: name || undefined,
        username: undefined,
        role,
        deleted: false,
        createdAt: now,
        updatedAt: now,
      });
      id = insert.insertedId.toHexString();
    }

    const token = await signAuthToken({ id, email, role });
    const res = NextResponse.redirect(new URL("/dashboard", baseUrl));
    res.cookies.set(AUTH_COOKIE_NAME, token, authCookieOptions());
    res.cookies.set(STATE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return res;
  } catch {
    const res = NextResponse.redirect(new URL(`/dashboard/register?error=${encodeURIComponent("Discord sign-in failed")}`, baseUrl));
    res.cookies.set(STATE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return res;
  }
}
