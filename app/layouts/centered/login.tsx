"use client";

import type { ReactNode } from "react";
import { useSchool } from "@saraswati/tenant-kit";
import { schoolLogo } from "@saraswati/tenant-kit";

export function CenteredLogin({ children }: { children: ReactNode }) {
  const school = useSchool();
  return (
    <main className="login-centered">
      <section className="centered-card">
        <img className="school-logo" src={schoolLogo(school.tenantId)} alt="" />
        <h1>{school.schoolName}</h1>
        <p className="centered-lead">One initial login only</p>
        {children}
        <footer className="page-footer">
          <span>&copy; 2026 {school.shortName}. All rights reserved.</span>
        </footer>
      </section>
    </main>
  );
}
