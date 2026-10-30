"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSchool } from "@saraswati/tenant-kit";

export function SaffronLogin({ children }: { children: ReactNode }) {
  const school = useSchool();
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;
    const slug = school.slug;
    (async () => {
      const named = await fetch(`/login/${slug}-login.html`);
      const response = named.ok ? named : await fetch("/login/default.html");
      if (!response.ok || cancelled) return;
      const text = await response.text();
      if (!cancelled) setHtml(text);
    })();
    return () => {
      cancelled = true;
    };
  }, [school.slug]);

  return (
    <main className="login-page saffron-login">
      <section className="form-panel">
        {children}
        <footer className="page-footer">
          <span>&copy; 2026 {school.shortName}. All rights reserved.</span>
        </footer>
      </section>
      <aside
        className="saffron-panel"
        aria-label="School welcome"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
