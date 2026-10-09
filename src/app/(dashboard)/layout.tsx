"use client";

import Link from "next/link";
import { HelpCircle, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ComposeProvider } from "@/components/compose/compose-context";
import { FloatingComposer } from "@/components/compose/floating-composer";
import { MailSearchInput } from "@/components/mail-search/mail-search-input";
import { MailSearchProvider } from "@/components/mail-search/mail-search-context";
import { MailboxProvider } from "@/components/mailbox-provider";
import { MailboxSelector } from "@/components/mailbox-selector";
import { LicenseIndicator } from "@/components/license-indicator";
import { DashboardNav } from "@/components/dashboard-nav";
import { SidebarProvider, useSidebar } from "@/components/sidebar-state";
import { NotificationToaster } from "@/components/notification-toaster";
import { TabTitleBadge } from "@/components/tab-title-badge";
import { UndoSnackbar } from "@/components/undo-snackbar";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";

function MobileMenuButton() {
  const { setMobileOpen } = useSidebar();
  return (
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      aria-label="Open menu"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-200 md:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const pathname = usePathname();
  useEffect(() => setMobileOpen(false), [pathname, setMobileOpen]);

  return (
    <div className="mail-shell grid h-dvh grid-cols-1 overflow-hidden bg-[#f6f8fc] transition-[grid-template-columns] duration-200 md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-neutral-900/40 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}
      <aside
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a,button")) setMobileOpen(false);
        }}
        className={`mail-sidebar min-h-0 overflow-y-auto overscroll-contain px-3 py-4 scrollbar-gutter-stable max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-[280px] max-md:max-w-[85vw] max-md:shadow-2xl max-md:transition-transform max-md:duration-200 ${
          mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"
        }`}
      >
        <DashboardNav />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-col">
        <header className="mail-topbar flex h-16 w-full shrink-0 items-center gap-2 pr-4 text-sm md:gap-4">
          <MobileMenuButton />
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
        </header>
        <main className="mail-content min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white scrollbar-gutter-stable md:rounded-tl-3xl">
          {children}
        </main>
      </div>
      <FloatingComposer />
      <NotificationToaster />
      <UndoSnackbar />
      <TabTitleBadge />
      <KeyboardShortcuts />
    </div>
  );
}

export default function DashboardLayout({
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
            <Shell>{children}</Shell>
          </MailSearchProvider>
        </ComposeProvider>
      </MailboxProvider>
      </SidebarProvider>
    </AuthGuard>
  );
}
