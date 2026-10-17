import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { publicSchoolConfig } from "@saraswati/tenant-kit/resolve";

export async function GET() {
  const tenantId = (await headers()).get("x-saraswati-tenant-id");
  if (!tenantId) return new NextResponse(null, { status: 404 });
  const config = await publicSchoolConfig(tenantId);
  if (!config) return new NextResponse(null, { status: 404 });
  return NextResponse.json(config);
}
