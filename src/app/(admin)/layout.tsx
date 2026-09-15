"use client";

import Link from "next/link";
import { HelpCircle, Search } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ComposeProvider } from "@/components/compose/compose-context";
import { FloatingComposer } from "@/components/compose/floating-composer";
import { MailboxProvider } from "@/components/mailbox-provider";
import { MailboxSelector } from "@/components/mailbox-selector";
import { LicenseIndicator } from "@/components/license-indicator";
import { AdminNav } from "@/components/admin-nav";
import { SidebarProvider } from "@/components/sidebar-state";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard requireMailbox requireRole="admin">
      <SidebarProvider expandedWidth={256}>
      <MailboxProvider>
        <ComposeProvider>
          <div className="mail-shell grid h-dvh grid-cols-[var(--sidebar-width)_minmax(0,1fr)] overflow-hidden bg-[#f6f8fc] transition-[grid-template-columns] duration-200">
            <aside className="mail-sidebar min-h-0 overflow-y-auto overscroll-contain px-3 py-4 scrollbar-gutter-stable">
              <AdminNav />
            </aside>
            <div className="flex min-h-0 min-w-0 flex-col">
              <header className="mail-topbar flex shrink-0 items-center justify-between gap-3"><Link href="/inbox" className="text-sm font-medium text-slate-500">Mail / Administration</Link><div className="flex items-center gap-2">
                <LicenseIndicator />
                <MailboxSelector />
              </div></header>
              <main className="mail-content min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-tl-3xl px-6 py-10 scrollbar-gutter-stable lg:px-12">
                <div className="w-full max-w-6xl mx-auto">{children}</div>
              </main>
            </div>
            <FloatingComposer />
          </div>
        </ComposeProvider>
      </MailboxProvider>
      </SidebarProvider>
    </AuthGuard>
  );
}
