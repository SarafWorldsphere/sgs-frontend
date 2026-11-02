// app/api/auth/check-phone/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withClient } from '@/lib/db';
import { getRoleMapping } from '@/lib/role-mapping';
import { sendOtpSms } from '@/lib/nimbus-sms'; 

// Normalize phone number
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\.]/g, '');
}

// Validate phone number - Rewritten to avoid copy-paste symbol errors
function isValidPhone(phone: string): boolean {
  const cleaned = normalizePhone(phone);
  const isIndianMobile = /^[6-9]\d{9}$/.test(cleaned);
  const isGenericPhone = /^[0-9]{10,15}$/.test(cleaned);
  
  if (isIndianMobile) {
    return true;
  }
  
  if (isGenericPhone) {
    return true;
  }
  
  return false;
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
        { valid: false, message: 'Phone number and role are required' },
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

    const phoneValues = phoneLookupValues(phone);
    if (phoneValues.length === 0 || !isValidPhone(phone)) {
      return NextResponse.json(
        { valid: false, message: 'Please enter a valid phone number.' },
        { status: 400 }
      );
    }

    const { table, phoneColumn } = mapping;
    if (!isSafeIdentifier(table) || !isSafeIdentifier(phoneColumn)) {
      return NextResponse.json(
        { valid: false, message: 'Phone login is not configured correctly.' },
        { status: 500 }
      );
    }

    const placeholders = phoneValues.map((_, index) => `$${index + 1}`).join(', ');
    const query = `
      SELECT *
      FROM ${table}
      WHERE REGEXP_REPLACE(COALESCE(${phoneColumn}::text, ''), '[^0-9+]', '', 'g') IN (${placeholders})
      LIMIT 1
    `;

    const result = await withClient(async (client) => {
      return await client.query(query, phoneValues);
    });

    if (result.rows.length === 0) {
      return NextResponse.json({
        valid: false,
        message: `No ${role} found with this phone number. Please contact your administrator.`
      });
    }

    // --- NEW OTP LOGIC ---
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await withClient(async (client) => {
      // The table is part of the tenant kit's schema, applied by
      // scripts/apply.sh. Creating it here fails anyway: the app role has no
      // rights to create tables, and a table created at runtime would have no
      // tenant_id and so sit outside row-level security entirely.
      //
      // tenant_id is left out of the insert on purpose — the stamp_tenant
      // trigger fills it from the school bound to this request. The unique key
      // is (tenant_id, phone, role), not phone alone, because the same phone
      // number can belong to a person at two different schools.
      await client.query(`
        INSERT INTO otp_verifications (phone, role, otp, expires_at)
        VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')
        ON CONFLICT ON CONSTRAINT otp_verifications_phone_role_key
        DO UPDATE SET otp = $3, expires_at = NOW() + INTERVAL '10 minutes'
      `, [phone.trim(), role, otp]);
    });

    // 3. Send SMS via Nimbus
    const smsResult = await sendOtpSms(phone.trim(), otp);

    if (!smsResult.success && process.env.NODE_ENV !== "production") {
      // LOCAL ONLY — no SMS gateway on a laptop. Print it instead of failing.
      console.log(`\n  OTP for ${phone.trim()} (${role}): ${otp}\n`);
      return NextResponse.json({
        valid: true,
        message: "OTP generated (check the server terminal)",
        user: result.rows[0],
      });
    }

    if (!smsResult.success) {
      return NextResponse.json(
        { valid: false, message: 'Failed to send OTP via SMS. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: 'OTP sent successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Phone validation error:', error);
    return NextResponse.json(
      { valid: false, message: 'Unable to validate phone number. Please try again.' },
      { status: 500 }
    );
  }
}