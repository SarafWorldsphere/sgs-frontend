import { NextRequest, NextResponse } from 'next/server';
import { withClient } from '@/lib/db';
import { RoleMapping, getRoleMapping } from '@/lib/role-mapping';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, role } = body;

    console.log('Validation request:', { email, role });

    if (!email || !role) {
      return NextResponse.json(
        { valid: false, message: 'Email and role are required' },
        { status: 400 }
      );
    }

    const mapping = getRoleMapping(role);
    if (!mapping) {
      return NextResponse.json(
        { valid: false, message: 'Invalid role selected' },
        { status: 400 }
      );
    }

    const { table, emailColumn } = mapping;
    const emailLower = email.trim().toLowerCase();
    const sessionId = String(Date.now()); // Generate unique session ID

    // Wrap the entire validation and tracking process in ONE connection block
    return await withClient(async (client) => {
      // 1. Validation Query
      const query = `SELECT * FROM ${table} WHERE ${emailColumn} = $1`;
      const result = await client.query(query, [emailLower]);

      if (result.rows.length === 0) {
        return NextResponse.json({
          valid: false,
          message: `No ${role} found with email: ${email}. Please contact your administrator.`
        });
      }

      const user = result.rows[0];

      // 2. Guaranteed Tracking Transaction
      try {
        await client.query("BEGIN"); 
        await client.query(
          `INSERT INTO sgs_user_activity_logs 
           (user_id, user_role, session_id, module_name, activity_type, login_method) 
           VALUES ($1, $2, $3, '/dashboard', 'login', 'google')`,
          [emailLower, role, sessionId]
        );
        await client.query("COMMIT");
        console.log("✅ Google login explicitly tracked via check-email and committed.");
      } catch (insertError) {
        await client.query("ROLLBACK");
        console.error("❌ Failed to track Google login inside transaction:", insertError);
        // We do not throw here so the user can still log in even if tracking fails temporarily
      }

      // 3. Return Success
      return NextResponse.json({
        valid: true,
        message: 'User validated successfully',
        user: user
      });
    });

  } catch (error) {
    console.error('Email validation error:', error);
    return NextResponse.json(
      { valid: false, message: 'Unable to validate email. Please try again.' },
      { status: 500 }
    );
  }
}