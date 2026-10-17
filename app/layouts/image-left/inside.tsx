"use client";

import type { ReactNode } from "react";
import { useSchool } from "@saraswati/tenant-kit";
import { schoolLogo } from "@saraswati/tenant-kit";

export function ImageLeftInside({ children }: { children: ReactNode }) {
  const school = useSchool();
  return (
    <main className="inside-shell">
      <header className="inside-bar">
        <img src={schoolLogo(school.tenantId)} alt="" />
        <strong>{school.schoolName}</strong>
      </header>
      <div className="inside-body">{children}</div>
    </main>
  );
}
