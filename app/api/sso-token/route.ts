import { NextRequest, NextResponse } from 'next/server';

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
    // Faculty, and any caller predating the `role` field.
    default: {
      const base = process.env.SGS_BACKEND_URL;
      return base ? { url: `${base.replace(/\/$/, '')}/api/v1/auth/sso-token` } : null;
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, phone, role } = await req.json();

    // Ensure AT LEAST ONE identifier is provided
    if (!email && !phone) {
      return NextResponse.json({ error: 'Email or Phone is required' }, { status: 400 });
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