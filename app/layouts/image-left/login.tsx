"use client";

import type { ReactNode } from "react";
import { useSchool } from "@saraswati/tenant-kit";
import { schoolLogo } from "@saraswati/tenant-kit";

export function ImageLeftLogin({ children }: { children: ReactNode }) {
  const school = useSchool();
  return (
    <main className="login-page">
      <section className="brand-panel" aria-label={`${school.shortName} sign in`}>
        <div className="sky-shape top-shape" />
        <div className="dot-grid" aria-hidden="true" />
        <div className="brand-content">
          <img className="school-logo" src={schoolLogo(school.tenantId)} alt="" />
          <h1>{school.schoolName}</h1>
          <div className="gold-divider" aria-hidden="true" />
          {school.place ? <p className="tagline">{school.place}</p> : null}
        </div>
        <img className="campus-art" src="/assets/campus-hero.png" alt="" />
        <div className="sky-shape bottom-shape" />
      </section>
      <section className="form-panel">
        {children}
        <footer className="page-footer">
          <span>&copy; 2026 {school.shortName}. All rights reserved.</span>
          <i aria-hidden="true">|</i>
          <span className="footer-link">Privacy Policy</span>
          <i aria-hidden="true">|</i>
          <span className="footer-link">Terms of Use</span>
        </footer>
      </section>
    </main>
  );
}
