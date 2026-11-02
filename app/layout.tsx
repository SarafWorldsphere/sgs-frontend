"use client";

import type { Metadata } from "next";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import "./globals.css";
import Providers from "./providers";

// Note: In Next.js App Router, 'metadata' must be moved to a separate server component (like a page.tsx) 
// if you are using "use client" in the layout. However, to keep your structure intact and functional 
// for tracking, you should leave this as a Client Component, and Next.js will warn if metadata needs relocating.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  useEffect(() => {
    // Check if the user is authenticated and navigating within module pages
    const userRole = sessionStorage.getItem('userRole');
    const userEmail = sessionStorage.getItem('userEmail');
    const userPhone = sessionStorage.getItem('userPhone');
    const userId = userEmail || userPhone || "Unknown";

    if (pathname && userRole) {
      const trackPageView = async () => {
        try {
          await fetch('/api/track-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              user_id: userId,
              user_role: userRole,
              module_name: pathname, 
              activity_type: "page_view" 
            })
          });
        } catch (error) {
          console.error("Failed to track page view:", error);
        }
      };

      trackPageView();
    }
  }, [pathname]); // This dependency array ensures it fires on every route change

  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}