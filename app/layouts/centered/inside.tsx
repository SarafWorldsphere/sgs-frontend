"use client";

import type { ReactNode } from "react";
import { useSchool } from "@saraswati/tenant-kit";
import { schoolLogo } from "@saraswati/tenant-kit";

export function CenteredInside({ children }: { children: ReactNode }) {
  const school = useSchool();
  return (
    <main className="inside-centered">
      <section className="inside-centered-card">
        <img className="school-logo" src={schoolLogo(school.tenantId)} alt="" />
        <h1>{school.schoolName}</h1>
        {children}
      </section>
    </main>
  );
}
