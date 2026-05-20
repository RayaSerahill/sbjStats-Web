import { Suspense } from "react";
import RegisterForm from "./RegisterForm";

export default function DashboardRegisterPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <Suspense fallback={<div className="p-6">Loading...</div>}>
        <RegisterForm />
      </Suspense>
    </main>
  );
}
