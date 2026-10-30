import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { TenantProvider, loadSchoolConfig, themeName } from "@saraswati/tenant-kit";
import "@saraswati/tenant-kit/themes.css";
import "./globals.css";
import Providers from "./providers";

const schoolForRequest = cache(async () => {
  const host = (await headers()).get("host") ?? "";
  return loadSchoolConfig(host);
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await schoolForRequest();
  return {
    title: `${config.schoolName} Login`,
    description: `Google authentication for ${config.schoolName}.`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await schoolForRequest();
  return (
    <html lang="en" data-theme={themeName(config.theme)}>
      <body>
        {config.layout === "saffron" ? (
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Noto+Sans+Devanagari:wght@600;700&display=swap"
          />
        ) : null}
        <Providers>
          <TenantProvider config={config}>{children}</TenantProvider>
        </Providers>
      </body>
    </html>
  );
}
