// app/api/auth/check-email/route.ts

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

    // Get the mapping for this role
    const mapping = getRoleMapping(role);
    if (!mapping) {
      return NextResponse.json(
        { valid: false, message: 'Invalid role selected' },
        { status: 400 }
      );
    }

    const { table, emailColumn } = mapping;
    const emailLower = email.trim().toLowerCase();

    // SELECT 1, not SELECT *. This endpoint takes no authentication — anyone
    // who can reach the login page can POST an address to it — so the answer
    // has to be a yes or a no and nothing else. It previously selected the
    // whole row and returned it to the browser, which handed every column of
    // a matching record to anyone who guessed an email address.
    const query = `SELECT 1 FROM ${table} WHERE ${emailColumn} = $1 LIMIT 1`;
    console.log('Query:', query, 'Email:', emailLower);

    // Use withClient for automatic connection management
    const result = await withClient(async (client) => {
      return await client.query(query, [emailLower]);
    });

    console.log('Result rows:', result.rows.length);

    if (result.rows.length === 0) {
      return NextResponse.json({
        valid: false,
        message: `No ${role} found with email: ${email}. Please contact your administrator.`
      });
    }

    // No user record in the response. This is a pre-check on the typed
    // address, before anyone has authenticated; the caller is entitled to
    // know whether to let them proceed, not to read the record.
    return NextResponse.json({
      valid: true,
      message: 'User validated successfully'
    });

  } catch (error) {
    console.error('Email validation error:', error);
    return NextResponse.json(
      { valid: false, message: 'Unable to validate email. Please try again.' },
      { status: 500 }
    );
  }
}
