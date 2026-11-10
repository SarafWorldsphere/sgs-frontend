import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { withClient } from "@/lib/db";
import { getRoleMapping } from "@/lib/role-mapping";

function phoneLookupValues(phone: string): string[] {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
  if (!cleaned) return [];

  const values = [cleaned];
  if (cleaned.length === 10) values.push(`+91${cleaned}`);
  if (cleaned.startsWith("91") && cleaned.length === 12) values.push(cleaned.slice(2));
  return Array.from(new Set(values));
}

function isSafeIdentifier(identifier: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier);
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  // Eight hours, not the thirty-day default. This is a school office session,
  // often on a shared machine; a month-long cookie means whoever sits down
  // next is still signed in as the last person.
  session: { maxAge: 8 * 60 * 60 },
  providers: [
    // prompt=select_account makes Google ask which account every time. Without
    // it Google silently reuses whatever session the browser already has, so
    // the second person at a shared computer is signed in as the first and is
    // never given the chance to choose.
    Google({ authorization: { params: { prompt: "select_account" } } }),
    Credentials({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone", type: "text" },
        otp: { label: "OTP", type: "text" },
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
        const phone = typeof credentials.phone === "string" ? credentials.phone.trim() : "";
        const otp = typeof credentials.otp === "string" ? credentials.otp.trim() : "";
        const role = typeof credentials.role === "string" ? credentials.role.trim() : "";
        const mapping = getRoleMapping(role);

        if (!phone || !/^\d{6}$/.test(otp) || !mapping) return null;
        if (
          !isSafeIdentifier(mapping.table) ||
          !isSafeIdentifier(mapping.phoneColumn) ||
          !isSafeIdentifier(mapping.nameColumn)
        ) return null;

        const phoneValues = phoneLookupValues(phone);
        if (phoneValues.length === 0) return null;

        return withClient(async (client) => {
          await client.query("BEGIN");
          try {
            const otpResult = await client.query(
              `SELECT phone FROM otp_verifications
               WHERE phone = $1 AND otp = $2 AND expires_at > NOW()
               FOR UPDATE`,
              [phone, otp]
            );
            if (otpResult.rows.length === 0) {
              await client.query("ROLLBACK");
              return null;
            }

            const placeholders = phoneValues.map((_, index) => `$${index + 1}`).join(", ");
            const userResult = await client.query(
              `SELECT * FROM ${mapping.table}
               WHERE REGEXP_REPLACE(COALESCE(${mapping.phoneColumn}::text, ''), '[^0-9+]', '', 'g') IN (${placeholders})
               LIMIT 1`,
              phoneValues
            );
            if (userResult.rows.length === 0) {
              await client.query("ROLLBACK");
              return null;
            }

            await client.query("DELETE FROM otp_verifications WHERE phone = $1", [phone]);
            await client.query("COMMIT");

            const user = userResult.rows[0];
            const id = user.user_id || user.teacher_id || user.student_id || phone;
            return {
              id: String(id),
              name: user[mapping.nameColumn] || user.full_name || user.name || phone,
              email: user.email || user.email_id || user.student_email || null,
              phone: user[mapping.phoneColumn] || phone,
              role,
            };
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          }
        });
      },
    }),
  ],
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider === "phone-otp") return true;
      if (account?.provider !== "google") return false;

      const email =
        typeof profile?.email === "string" ? profile.email.toLowerCase() : "";
      const isVerified = profile?.email_verified !== false;

      return isVerified && email.endsWith("@gmail.com");
    },
    jwt({ token, user }) {
      if (user) {
        const phoneUser = user as typeof user & { phone?: string; role?: string };
        token.phone = phoneUser.phone;
        token.role = phoneUser.role;
      }
      return token;
    },
    session({ session, token }) {
      const sessionUser = session.user as typeof session.user & { phone?: string; role?: string };
      sessionUser.phone = typeof token.phone === "string" ? token.phone : undefined;
      sessionUser.role = typeof token.role === "string" ? token.role : undefined;
      return session;
    },
    authorized({ auth: session, request }) {
      const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
      return isDashboard ? !!session : true;
    },
  },
});
