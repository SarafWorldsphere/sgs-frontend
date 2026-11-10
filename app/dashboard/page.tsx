'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { InsideSurface } from '../layouts';

// Disable all forms of prerendering for this page
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Role to Dashboard URL mapping
const ROLE_DASHBOARD_MAP: Record<string, string> = {
  "School Admin": process.env.NEXT_PUBLIC_SCHOOL_ADMIN_DASHBOARD_URL || "https://staging.sgs.swais.in/admin/students",
  "Headmaster":    process.env.NEXT_PUBLIC_HEADMASTER_DASHBOARD_URL || "https://staging.sgs.swais.in/headmaster",
  "Faculty":       process.env.NEXT_PUBLIC_FACULTY_DASHBOARD_URL || "https://staging.sgs.swais.in/faculty/dashboard",
  "Student":       process.env.NEXT_PUBLIC_STUDENT_DASHBOARD_URL || "https://staging.sgs.swais.in/student",
  "Parent":        process.env.NEXT_PUBLIC_PARENT_DASHBOARD_URL || "https://staging.sgs.swais.in/parent/dashboard",
};

// There is no longer a list of roles that get a token. Keeping one here meant
// every role missing from it skipped the check entirely, and the list drifted
// between branches — School Admin was on it in one and not the other. The
// server decides now: it verifies the role for everyone, and returns a token
// only where one is configured.

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [error, setError] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // Wait for NextAuth session to resolve
    if (status === 'loading') return;
    if (isRedirecting) return;

    const userRole = sessionStorage.getItem('userRole');
    const dashboardUrl = sessionStorage.getItem('dashboardRedirectUrl');

    // Use Google-authenticated email (reliable) instead of typed email
    const userEmail = session?.user?.email || sessionStorage.getItem('userEmail');

    if (!userRole) {
      router.push('/');
      return;
    }

    setIsRedirecting(true);

    const targetUrl = dashboardUrl || ROLE_DASHBOARD_MAP[userRole];

    if (!targetUrl) {
      setError('Invalid role selected. Please contact administrator.');
      setIsRedirecting(false);
      return;
    }

    // SSO token handoff. Faculty and Parent dashboards identify the user from
    // a signed token in the redirect; the others still read sessionStorage.
    // Add a role here only once its dashboard verifies the token — an
    // unexpected ?token= on a dashboard that ignores it is harmless, but
    // there is no point minting one.
    // Every role goes through this, not only the ones whose dashboard reads a
    // token. Verifying the role and issuing a token are two different things:
    // the first must happen for everyone, or a person can pick any role on the
    // login page and be sent to that dashboard unchecked. The second only
    // makes sense where the dashboard verifies it.
    //
    // A 403 means the signed-in account does not hold this role. A 200 with no
    // token means the role is genuine but its dashboard has not adopted the
    // token yet — so redirect, as before, rather than locking those users out.
    {
      fetch('/api/sso-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: userRole }),
      })
        .then(async res => {
          if (res.status === 403 || res.status === 401) return { refused: true };
          return res.json().catch(() => ({}));
        })
        .then((data: { refused?: boolean; access_token?: string }) => {
          if (!data.refused && data.access_token) {
            window.location.href = `${targetUrl}?token=${encodeURIComponent(data.access_token)}`;
            return;
          }
          if (!data.refused) {
            // Authorised, but this dashboard does not take a token yet.
            window.location.href = targetUrl;
            return;
          }
          // No token means the server declined — wrong role for this account,
          // or no account at all. Previously this fell through and redirected
          // anyway, which left the dashboard to defend itself. Stop here.
          // isRedirecting deliberately stays true. It is a dependency of this
          // effect, so clearing it re-runs the effect, which asks again, is
          // refused again, and clears it again — an endless retry against
          // /api/sso-token for as long as the page is open. Leaving it set
          // makes the guard at the top stop the second pass.
          setError(
            'Your account is not authorised for the selected role. ' +
            'Please choose the correct role, or contact your administrator.'
          );
        })
        .catch(() => {
          setError('Could not complete sign-in. Please try again.');
        });
    }
  }, [router, isRedirecting, session, status]);

  if (error) {
    return (
      <InsideSurface>
      <div className="flex flex-col justify-center items-center h-screen">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-gray-600 mt-2">{error}</p>
        <button 
          onClick={() => router.push('/')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Go Back to Login
        </button>
      </div>
      </InsideSurface>
    );
  }

  return (
    <InsideSurface>
    <div className="flex justify-center items-center h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p>Redirecting to your dashboard...</p>
      </div>
    </div>
    </InsideSurface>
  );
}
