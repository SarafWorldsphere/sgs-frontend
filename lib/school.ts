import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.SARASWATI_DATABASE_URL });

export type ResolvedSchool = { tenantId: string; status: string };

export async function resolveSchool(host: string): Promise<ResolvedSchool | null> {
  const domain = host.trim().toLowerCase().replace(/\.$/, "").split(":")[0];
  if (!domain || domain.includes("/")) return null;
  const result = await pool.query(
    `SELECT t.tenant_id::text AS "tenantId", t.status
     FROM platform.tenant_domains AS d
     JOIN platform.tenants AS t ON t.tenant_id = d.tenant_id
     WHERE d.domain = $1`,
    [domain],
  );
  return result.rows[0] ?? null;
}
