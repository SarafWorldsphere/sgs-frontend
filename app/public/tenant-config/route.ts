import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET() {
  const tenantId = (await headers()).get("x-saraswati-tenant-id");
  if (!tenantId) return new NextResponse(null, { status: 404 });

  const result = await getPool().query(
    `SELECT tenant_id::text AS "tenantId", slug, config
     FROM platform.tenants
     WHERE tenant_id = $1::uuid`,
    [tenantId],
  );
  const row = result.rows[0];
  if (!row) return new NextResponse(null, { status: 404 });

  const config = { ...(row.config ?? {}) };
  delete config.database_secret;
  delete config.databaseSecret;
  return NextResponse.json({ ...config, tenantId: row.tenantId, slug: row.slug });
}
