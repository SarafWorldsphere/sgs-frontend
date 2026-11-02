import { NextRequest, NextResponse } from 'next/server';
import { withClient } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, user_role, module_name, activity_type, activity_details = "Viewed page" } = body;

    if (!user_id || !module_name || !activity_type) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, module_name, activity_type' },
        { status: 400 }
      );
    }

    const sessionId = String(Date.now()); // Generate quick tracking ID for the row

    await withClient(async (client) => {
      await client.query("BEGIN"); // Force transactional sync with AWS RDS
      try {
        if (activity_type === "feature_usage" || module_name.toLowerCase().includes("ai")) {
          // Requirement: Log AI features to sgs_ai_usage_logs table
          await client.query(
            `INSERT INTO sgs_ai_usage_logs 
             (user_email, module_name, created_at_ist) 
             VALUES ($1, $2, NOW())`,
            [user_id, module_name]
          );
        } else {
          // Requirement: Log standard module page visits to sgs_audit_log table
          // Note: Using changed_by column as userid per your previous schema logs
          await client.query(
            `INSERT INTO sgs_audit_log 
             (changed_by, table_name, action, created_datetime) 
             VALUES ($1, $2, $3, NOW())`,
            [user_id, module_name, activity_type]
          );
        }
        await client.query("COMMIT");
      } catch (insertError) {
        await client.query("ROLLBACK");
        console.error("Database insert failed:", insertError);
        throw insertError;
      }
    });

    return NextResponse.json({ success: true, message: 'Activity tracked successfully' });

  } catch (error) {
    console.error('Track activity error:', error);
    return NextResponse.json(
      { error: 'Internal server error while tracking activity' },
      { status: 500 }
    );
  }
}