import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { withClient } from '@/lib/db';
import { getRoleMapping } from '@/lib/role-mapping';

/**
 * Exchanges a Google-verified email OR OTP-verified phone for a signed dashboard token.
 *
 * Each dashboard backend mints and verifies its own tokens, so the login app
 * never shares a JWT secret between services — it only holds the SSO secret
 * that authorises it to *ask* for a token.
 *
 *   Faculty      -> SGS_BACKEND_URL + /api/v1/auth/sso-token
 *   Parent       -> SGS_PARENT_SSO_URL
 *   School Admin -> SGS_ADMIN_SSO_URL
 *
 * If a role's endpoint is not configured, respond with no token rather than
 * an error: the dashboard page then redirects without one.
 */

type SsoTarget = { url: string } | null;

function resolveTarget(role: string | undefined): SsoTarget {
  switch (role) {
    case 'Parent': {
      const url = process.env.SGS_PARENT_SSO_URL;
      return url ? { url } : null;
    }
    // 'School Admin' with a space — what the role selector sends, and what the
    // dashboard map is keyed on. Without this case the role fell through to
    // `default` and was sent to the *faculty* backend, which looks up a
    // teacher: an admin who is not also a teacher got a 404, the portal
    // redirected with no token, and the admin app bounced them straight back
    // here. That loop is what made admin unreachable.
    case 'School Admin': {
      const url = process.env.SGS_ADMIN_SSO_URL;
      return url ? { url } : null;
    }
    // Named, not left to `default`. Every role reaches this function now, and
    // the default sends the caller to the *faculty* backend — which looks up a
    // teacher. A headmaster who is not also a teacher got a pointless 404, and
    // one who is would have been handed a faculty token for a different
    // dashboard. Returning null is the honest answer: the role is fine, there
    // is simply no token endpoint for it yet.
    case 'Headmaster':
    case 'Student':
      return null;

    // Faculty, and any caller predating the `role` field.
    default: {
      const base = process.env.SGS_BACKEND_URL;
      return base ? { url: `${base.replace(/\/$/, '')}/api/v1/auth/sso-token` } : null;
    }
  }
}

/** Only ever interpolated from the fixed table in lib/role-mapping. */
function isSafeIdentifier(identifier: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier);
}

/**
 * Does this identity actually hold this role?
 *
 * The role arrives from the browser, where it was kept in sessionStorage, so it
 * is a request and not a fact. Without this check someone could sign in as
 * themselves, set the role to School Admin in devtools, and have an admin token
 * minted for them.
 */
async function holdsRole(role: string, email: string | null, phone: string | null): Promise<boolean> {
  const mapping = getRoleMapping(role);
  if (!mapping) return false;
  if (!isSafeIdentifier(mapping.table)) return false;
  if (!isSafeIdentifier(mapping.emailColumn) || !isSafeIdentifier(mapping.phoneColumn)) return false;

  if (email) {
    return withClient(async (client) => {
      const result = await client.query(
        `SELECT 1 FROM ${mapping.table} WHERE LOWER(${mapping.emailColumn}::text) = $1 LIMIT 1`,
        [email]
      );
      return result.rows.length > 0;
    });
  }

  if (!phone) return false;

  // Phone numbers are not stored consistently — some rows carry +91, some do
  // not, some have spaces. Matching them literally would refuse a user whose
  // row happens to be written the other way, which is a lockout rather than a
  // refusal. This mirrors what auth.ts already does to find the same person.
  const cleaned = phone.replace(/[\s\-()\.]/g, "");
  if (!cleaned) return false;
  const candidates = [cleaned];
  if (cleaned.length === 10) candidates.push(`+91${cleaned}`);
  if (cleaned.startsWith("91") && cleaned.length === 12) candidates.push(cleaned.slice(2));
  const values = Array.from(new Set(candidates));

  return withClient(async (client) => {
    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
    const result = await client.query(
      `SELECT 1 FROM ${mapping.table}
        WHERE REGEXP_REPLACE(COALESCE(${mapping.phoneColumn}::text, ''), '[^0-9+]', '', 'g')
              IN (${placeholders})
        LIMIT 1`,
      values
    );
    return result.rows.length > 0;
  });
}

export async function POST(req: NextRequest) {
  try {
    const { role } = await req.json();

    // The identity comes from the signed session, never from the request body.
    // The page used to send whichever email it had to hand; anything the
    // browser can set, the browser can change, so a token could be requested
    // for an address the caller had not authenticated as.
    const session = await auth();
    const sessionUser = session?.user as
      | (typeof session extends null ? never : { email?: string | null; phone?: string })
      | undefined;

    const email = typeof sessionUser?.email === 'string' ? sessionUser.email.toLowerCase() : null;
    const phone = typeof sessionUser?.phone === 'string' ? sessionUser.phone : null;

    if (!email && !phone) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    if (!(await holdsRole(role, email, phone))) {
      return NextResponse.json({ error: 'Not authorised for this role' }, { status: 403 });
    }

    const target = resolveTarget(role);

    if (!target) {
      // Faculty has always failed loudly here; keep that. For newer roles a
      // missing endpoint is a deployment that hasn't opted in yet, not an error.
      if (role === undefined || role === 'Faculty') {
        return NextResponse.json({ error: 'SGS_BACKEND_URL is not configured' }, { status: 500 });
      }
      return NextResponse.json({ access_token: null });
    }

    const res = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SSO-Secret': process.env.SGS_SSO_SECRET || '',
      },
      // Pass both email and phone; the backend will use whichever is populated
      body: JSON.stringify({ email, phone, role }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'SSO failed' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ access_token: data.access_token });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}