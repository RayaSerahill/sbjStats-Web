import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <Suspense fallback={<div />}>
        <LoginClient />
      </Suspense>
    </main>
  );
}
