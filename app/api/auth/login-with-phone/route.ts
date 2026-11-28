// app/api/auth/login-with-phone/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withClient } from '@/lib/db';
import { getRoleMapping, getDashboardUrl } from '@/lib/role-mapping';
import { studentAccessSql, STUDENT_ACCESS_DENIED } from '@/lib/student-identifiers';

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\.]/g, '');
}

function phoneLookupValues(phone: string): string[] {
  const cleaned = normalizePhone(phone);
  if (!cleaned) return [];

  const values = [cleaned];
  if (cleaned.length === 10) {
    values.push(`+91${cleaned}`);
  }
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    values.push(cleaned.slice(2));
  }
  return Array.from(new Set(values));
}

function isSafeIdentifier(identifier: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, role } = body;

    if (!phone || !role) {
      return NextResponse.json(
        { success: false, message: 'Phone number and role are required.' },
        { status: 400 }
      );
    }

    const mapping = getRoleMapping(role);
    if (!mapping) {
      return NextResponse.json(
        { success: false, message: 'Invalid role selected.' },
        { status: 400 }
      );
    }

    const phoneValues = phoneLookupValues(phone);
    if (phoneValues.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid phone number.' },
        { status: 400 }
      );
    }

    const { table, phoneColumn, nameColumn } = mapping;
    if (!isSafeIdentifier(table) || !isSafeIdentifier(phoneColumn)) {
      return NextResponse.json(
        { success: false, message: 'Phone login is not configured correctly.' },
        { status: 500 }
      );
    }

    const placeholders = phoneValues.map((_, index) => `$${index + 1}`).join(', ');
    const query = `
      SELECT *
      FROM ${table}
      WHERE REGEXP_REPLACE(COALESCE(${phoneColumn}::text, ''), '[^0-9+]', '', 'g') IN (${placeholders})
      ${studentAccessSql(role)}
      LIMIT 1
    `;

    // Use withClient for automatic connection management
    const result = await withClient(async (client) => {
      return await client.query(query, phoneValues);
    });

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: role === 'Student' ? STUDENT_ACCESS_DENIED : `No ${role} found with this phone number.`
      });
    }

    const user = result.rows[0];
    const dashboardUrl = getDashboardUrl(role);

    return NextResponse.json({
      success: true,
      message: 'Login successful.',
      user: {
        id: user.user_id || user.teacher_id || user.student_id,
        name: user[nameColumn] || user.full_name || user.name,
        email: user.email || user.email_id || user.student_email,
        phone: user[phoneColumn],
        role: role,
        dashboardUrl: dashboardUrl,
      },
    });
  } catch (error) {
    console.error('Phone login error:', error);
    return NextResponse.json(
      { success: false, message: 'Unable to login. Please try again.' },
      { status: 500 }
    );
  }
}
