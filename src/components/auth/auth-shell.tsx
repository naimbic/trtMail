"use client";

import { BrandName } from "@/components/brand-name";
import { useBranding } from "@/components/branding-provider";
import type { AuthShellProps } from "./types";

export function AuthShell({
  title,
  description,
  children,
  footer,
  steps,
}: AuthShellProps) {
  const branding = useBranding();

  return (
    <div className="mail-auth min-h-dvh bg-[#f1f4fa] px-4 py-6 text-neutral-900 sm:px-6 lg:flex lg:items-center lg:px-10 lg:py-10">
      <main className="mail-auth-card mx-auto grid w-full max-w-6xl overflow-hidden rounded-4xl bg-white lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <section className="mail-auth-story flex flex-col p-7 sm:p-10 lg:p-14">
          <div className="flex items-center gap-2">
            <span className="truncate text-md font-semibold text-neutral-800">
              {<BrandName name={branding.appName} />}
            </span>
          </div>

          <div className="mt-8 lg:mt-20"><p className="mail-eyebrow">TRT DIGITAL · TEAM WORKSPACE</p>
            <h1 className="max-w-md text-xl font-medium leading-tight tracking-tight text-neutral-950 sm:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="mt-5 max-w-md text-base leading-7 text-neutral-600">
                {description}
              </p>
            )}
          </div>
          <div className="mail-auth-note"><span className="mail-auth-rule" /><p className="text-xl font-medium">Good conversations.<br />Great working relationships.</p><p className="mt-3 text-sm leading-6">Your clients, your team, your next opportunity.<br />All connected in one mail workspace.</p></div>
        </section>

        <section className="flex min-w-0 flex-col justify-center p-7 sm:p-10 lg:p-14">
          {steps && (
            <div className="mb-7 flex flex-wrap gap-2 text-xs font-semibold">
              {steps.map((step, index) => (
                <span key={step.label} className="flex items-center gap-2">
                  <span
                    className={
                      step.active ? "text-blue-700" : "text-neutral-400"
                    }
                  >
                    {index + 1} {step.label}
                  </span>
                  {index < steps.length - 1 && (
                    <span className="text-neutral-300">/</span>
                  )}
                </span>
              ))}
            </div>
          )}
          <div className="w-full">{children}</div>
          {footer && (
            <div className="mt-8 text-sm font-medium text-blue-700">
              {footer}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
