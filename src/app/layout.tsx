import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { getCurrentUserEmail } from "@/lib/supabase/server";
import { getCurrentBranch } from "@/lib/branch";

export const metadata: Metadata = {
  title: "Logistica Prese",
  description: "MVP pianificazione prese/ritiri logistici giornalieri",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userEmail, branch] = await Promise.all([getCurrentUserEmail(), getCurrentBranch()]);

  return (
    <html lang="it">
      <body>
        <div className="flex min-h-screen">
          <Sidebar userEmail={userEmail} branch={branch} />
          <main className="flex-1 overflow-x-hidden">
            <div className="mx-auto max-w-7xl p-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
