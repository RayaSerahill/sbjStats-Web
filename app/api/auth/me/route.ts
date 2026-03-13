import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { ensureAuthCollections, getDb, type UserDoc } from "@/lib/db";

export async function GET() {
  await ensureAuthCollections();

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) return NextResponse.json({ user: null }, { status: 200 });

  try {
    const payload = await verifyAuthToken(token);
    const db = await getDb();
    const users = db.collection<UserDoc>("users");
    const user = await users.findOne({ _id: new ObjectId(payload.id) });
    if (!user) return NextResponse.json({ user: null }, { status: 200 });
    return NextResponse.json({ user: { id: payload.id, email: user.email, username: user.username ?? null, name: user.name ?? null, role: "admin" } });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
