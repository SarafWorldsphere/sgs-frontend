import type { Metadata } from "next";
import { headers } from "next/headers";
import { TenantProvider, loadSchoolConfig, themeName } from "@saraswati/tenant-kit";
import "@saraswati/tenant-kit/themes.css";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "SWAIS Login",
  description: "Google authentication and role-based onboarding for SWAIS.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const host = (await headers()).get("host") ?? "";
  const config = await loadSchoolConfig(host);
  return (
    <html lang="en" data-theme={themeName(config.theme)}>
      <body>
        <Providers>
          <TenantProvider config={config}>{children}</TenantProvider>
        </Providers>
      </body>
    </html>
  );
}
