import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveSchool } from "@/lib/school";

const TENANT_HEADER = "x-saraswati-tenant-id";

export const proxy = auth(async (request) => {
  const school = await resolveSchool(request.headers.get("host") ?? "");
  if (!school) return new NextResponse(null, { status: 404 });
  if (school.status !== "active") return new NextResponse(null, { status: 403 });
  const headers = new Headers(request.headers);
  headers.delete(TENANT_HEADER);
  headers.set(TENANT_HEADER, school.tenantId);
  return NextResponse.next({ request: { headers } });
});
