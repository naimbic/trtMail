"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ComposeProvider } from "@/components/compose/compose-context";
import { FloatingComposer } from "@/components/compose/floating-composer";
import { MailboxProvider } from "@/components/mailbox-provider";
import { MailboxSelector } from "@/components/mailbox-selector";
import { LicenseIndicator } from "@/components/license-indicator";
import { AdminNav } from "@/components/admin-nav";
import { SidebarProvider } from "@/components/sidebar-state";

export default function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard requireMailbox requireRole="admin">
      <SidebarProvider expandedWidth={256}>
        <MailboxProvider>
          <ComposeProvider>
            <AppShell
              nav={<AdminNav />}
              headerClassName="justify-between"
              header={
                <>
                  <Link href="/inbox" className="min-w-0 flex-1 truncate text-sm font-medium text-slate-500 md:flex-none">
                    Mail / Administration
                  </Link>
                  <div className="flex items-center gap-2">
                    <div className="hidden md:block">
                      <LicenseIndicator />
                    </div>
                    <MailboxSelector />
                  </div>
                </>
              }
              mainClassName="px-4 py-6 md:px-6 md:py-10 lg:px-12"
              extras={<FloatingComposer />}
            >
              <div className="mx-auto w-full max-w-6xl">{children}</div>
            </AppShell>
          </ComposeProvider>
        </MailboxProvider>
      </SidebarProvider>
    </AuthGuard>
  );
}
