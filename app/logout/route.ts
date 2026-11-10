import { signOut } from "@/auth";

/**
 * The one place that actually ends a session.
 *
 * Each dashboard used to "log out" by clearing its own cookie and sending the
 * user back to the login page. The portal's own session was never touched, so
 * it still recognised them: the next sign-in skipped Google entirely and let
 * them straight into whichever role they picked. On a shared computer that
 * left the previous person's session usable by whoever sat down next.
 *
 * A GET, so a dashboard can send someone here with an ordinary link or a
 * redirect. That makes it reachable from another site, but the worst that
 * does is log somebody out, which is the safe direction to fail in.
 */
export async function GET() {
  await signOut({ redirectTo: "/" });
}
