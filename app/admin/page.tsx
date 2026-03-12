import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { ensureAuthCollections, getDb, type UserDoc } from "@/lib/db";
import { LogoutButton } from "./LogoutButton";
import { redirect } from "next/navigation";
import { GameImport } from "./GameImport";
import { Aliases } from "./Aliases";
import { HiddenPlayers } from "./HiddenPlayers";
import { ApiKeys } from "./ApiKeys";
import { AdminSectionsClient } from "./AdminSectionsClient";

export default async function AdminPage() {
  await ensureAuthCollections();

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  const auth = token ? await verifyAuthToken(token).catch(() => null) : null;

  if (!auth) redirect("/admin/login");

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const user = await users.findOne({ _id: new ObjectId(auth.id) });

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <div className="rounded-3xl border border-[#FF9FC6]/35 bg-gradient-to-b from-white to-[#FF9FC6]/90 p-6 shadow-[0_0_0_1px_rgba(255,159,198,0.18),0_18px_60px_rgba(255,159,198,0.22)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Admin</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Logged in as <span className="font-medium text-zinc-900">{user?.name ?? auth.email}</span>
            </p>
          </div>
          <LogoutButton />
        </div>

        <AdminSectionsClient
          userLabel={user?.name ?? auth.email}
          gameImport={<GameImport />}
          aliases={<Aliases />}
          hiddenPlayers={<HiddenPlayers />}
          apiKeys={<ApiKeys />}
        />
      </div>
    </div>
  );
}
