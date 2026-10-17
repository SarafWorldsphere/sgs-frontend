"use client";

import type { ReactNode } from "react";
import { useSchool } from "@saraswati/tenant-kit";
import { CenteredInside } from "./centered/inside";
import { CenteredLogin } from "./centered/login";
import { ImageLeftInside } from "./image-left/inside";
import { ImageLeftLogin } from "./image-left/login";

function layoutName(value: string): "image-left" | "centered" {
  return value === "centered" ? "centered" : "image-left";
}

export function LoginSurface({ children }: { children: ReactNode }) {
  const school = useSchool();
  const Layout = layoutName(school.layout) === "centered" ? CenteredLogin : ImageLeftLogin;
  return <Layout>{children}</Layout>;
}

export function InsideSurface({ children }: { children: ReactNode }) {
  const school = useSchool();
  const Layout = layoutName(school.layout) === "centered" ? CenteredInside : ImageLeftInside;
  return <Layout>{children}</Layout>;
}
