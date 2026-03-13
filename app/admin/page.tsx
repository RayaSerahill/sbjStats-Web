import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { ensureAuthCollections, getDb, type UserDoc } from "@/lib/db";
import { LogoutButton } from "./LogoutButton";
import { redirect } from "next/navigation";
import { GameImport } from "./components/GameImport";
import { Aliases } from "./components/Aliases";
import { HiddenPlayers } from "./components/HiddenPlayers";
import { ApiKeys } from "./components/ApiKeys";
import { AdminSectionsClient } from "./AdminSectionsClient";
import { StatsStyleEditor } from "./components/StatsStyleEditor";
import { Account } from "./components/Account";
import { Games } from "./components/Games";

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
      <>
        <div className="mx-auto w-full max-w-6xl px-4">
          <div className="rounded-3xl p-6 cute-border">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold text-zinc-900">Admin</h1>
                <p className="mt-2 text-sm text-zinc-600">
                  Logged in as <span className="font-medium text-zinc-900">{user?.name ?? user?.username ?? auth.email}</span>
                </p>
              </div>
              <LogoutButton />
            </div>
          </div>

          <AdminSectionsClient
              gameImport={<GameImport />}
              account={<Account />}
              games={<Games />}
              aliases={<Aliases />}
              hiddenPlayers={<HiddenPlayers />}
              apiKeys={<ApiKeys />}
              statsStyle={<StatsStyleEditor />}
          />
        </div>
      </>
  );
}
