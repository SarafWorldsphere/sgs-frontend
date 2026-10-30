import { NextRequest, NextResponse } from 'next/server';

/**
 * Exchanges a Google-verified email OR OTP-verified phone for a signed dashboard token.
 *
 * Each dashboard backend mints and verifies its own tokens, so the login app
 * never shares a JWT secret between services — it only holds the SSO secret
 * that authorises it to *ask* for a token.
 *
 *   Faculty -> SGS_BACKEND_URL + /api/v1/auth/sso-token
 *   Parent  -> SGS_PARENT_SSO_URL
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

    // The backend decides which school a request belongs to from its Host
    // header. These URLs come from the environment and point at a port on
    // localhost, so without this the backend sees `Host: 127.0.0.1:4106`,
    // resolves no school, and answers 404 — the same for every school.
    //
    // Forwarding the host the browser used is what makes one deployment work
    // for several schools. An environment variable cannot do it: it holds one
    // value, and there is more than one school.
    const schoolHost = req.headers.get('host');

    const res = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SSO-Secret': process.env.SGS_SSO_SECRET || '',
        ...(schoolHost ? { Host: schoolHost } : {}),
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