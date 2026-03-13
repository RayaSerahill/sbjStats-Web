import "./admin.css";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen px-4 py-12 font-sans text-zinc-900 dark:text-zinc-100">
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </div>
  );
}
