"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ComposeProvider } from "@/components/compose/compose-context";
import { FloatingComposer } from "@/components/compose/floating-composer";
import { MailSearchInput } from "@/components/mail-search/mail-search-input";
import { MailSearchProvider } from "@/components/mail-search/mail-search-context";
import { MailboxProvider } from "@/components/mailbox-provider";
import { MailboxSelector } from "@/components/mailbox-selector";
import { LicenseIndicator } from "@/components/license-indicator";
import { DashboardNav } from "@/components/dashboard-nav";
import { SidebarProvider } from "@/components/sidebar-state";

export default function SettingsShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <MailboxProvider>
          <ComposeProvider>
            <MailSearchProvider>
              <AppShell
                nav={<DashboardNav />}
                header={
                  <>
                    <MailSearchInput />
                    <Link
                      href="/settings"
                      aria-label="Mail settings"
                      className="hidden h-10 w-10 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-200 md:flex"
                    >
                      <HelpCircle className="h-5 w-5" />
                    </Link>
                    <div className="hidden md:block">
                      <LicenseIndicator />
                    </div>
                    <MailboxSelector />
                  </>
                }
                extras={<FloatingComposer />}
              >
                {children}
              </AppShell>
            </MailSearchProvider>
          </ComposeProvider>
        </MailboxProvider>
      </SidebarProvider>
    </AuthGuard>
  );
}
