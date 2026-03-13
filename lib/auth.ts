import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { ObjectId } from "mongodb";
import { createHash, randomBytes } from "node:crypto";
import { getDb, isUserRole, type UserDoc, type UserRole } from "@/lib/db";

export const AUTH_COOKIE_NAME = "admin_token";
const API_KEY_PREFIX = "rh_";

const jwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET in environment");
  return new TextEncoder().encode(secret);
};

export type JwtUser = {
  id: string;
  email: string;
  role: UserRole;
};

export async function signAuthToken(user: JwtUser) {
  return new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .setSubject(user.id)
    .sign(jwtSecret());
}

export async function verifyAuthToken(token: string): Promise<JwtUser> {
  const { payload } = await jwtVerify(token, jwtSecret());

  const id = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? payload.email : "";
  const role = isUserRole(payload.role) ? payload.role  : "dealer";

  if (!id || !email) throw new Error("Invalid token payload");
  return { id, email, role };
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function generateApiKey() {
  return `${API_KEY_PREFIX}${randomBytes(24).toString("hex")}`;
}

export function hashApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function getApiKeyPrefix(apiKey: string) {
  return apiKey.slice(0, Math.min(12, apiKey.length));
}

function getApiKeyFromHeaders(req: Request) {
  const xApiKey = req.headers.get("x-api-key")?.trim();
  if (xApiKey) return xApiKey;

  const authHeader = req.headers.get("authorization")?.trim() ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export async function authenticateApiKey(apiKey: string): Promise<JwtUser | null> {
  if (!apiKey) return null;

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const user = await users.findOne(
    { apiKeyHash: hashApiKey(apiKey), deleted: { $ne: true } },
    { projection: { _id: 1, email: 1, role: 1 } }
  );

  if (!user?._id) return null;

  return {
    id: user._id instanceof ObjectId ? user._id.toHexString() : String(user._id),
    email: user.email,
    role: isUserRole(user.role) ? user.role : "dealer",
  };
}

export async function requireUserRequest(req: Request) {
  const apiKey = getApiKeyFromHeaders(req);
  if (apiKey) {
    const auth = await authenticateApiKey(apiKey);
    if (auth) return { ok: true as const, auth, method: "api-key" as const };
    return { ok: false as const, res: Response.json({ error: "Invalid API key" }, { status: 401 }) };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return { ok: false as const, res: Response.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  try {
    const auth = await verifyAuthToken(token);
    const db = await getDb();
    const users = db.collection<UserDoc>("users");
    const user = await users.findOne(
      { _id: new ObjectId(auth.id), deleted: { $ne: true } },
      { projection: { _id: 1, role: 1, email: 1 } }
    );
    if (!user) {
      return { ok: false as const, res: Response.json({ error: "Account not available" }, { status: 401 }) };
    }
    return {
      ok: true as const,
      auth: {
        id: auth.id,
        email: user.email,
        role: isUserRole(user.role) ? user.role : "dealer",
      },
      method: "cookie" as const,
    };
  } catch {
    return { ok: false as const, res: Response.json({ error: "Invalid token" }, { status: 401 }) };
  }
}

export async function requireRoles(req: Request, roles: UserRole[]) {
  const gate = await requireUserRequest(req);
  if (!gate.ok) return gate;
  if (!roles.includes(gate.auth.role)) {
    return { ok: false as const, res: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
}

export const requireAdminRequest = requireUserRequest;
