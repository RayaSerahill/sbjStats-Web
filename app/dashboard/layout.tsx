import "./admin.css";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-screen font-sans text-zinc-900 dark:text-zinc-100">{children}</div>;
}
