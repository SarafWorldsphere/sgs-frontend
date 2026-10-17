import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveTenant } from "@saraswati/tenant-kit/resolve";

const TENANT_HEADER = "x-saraswati-tenant-id";

export const proxy = auth(async (request) => {
  const tenant = await resolveTenant(request.headers.get("host") ?? "");
  if (!tenant) return new NextResponse(null, { status: 404 });
  if (tenant.status !== "active") return new NextResponse(null, { status: 403 });
  const headers = new Headers(request.headers);
  headers.delete(TENANT_HEADER);
  headers.set(TENANT_HEADER, tenant.tenantId);
  return NextResponse.next({ request: { headers } });
});
