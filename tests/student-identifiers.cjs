// Run with TEST_DATABASE_URL pointing to a disposable PostgreSQL database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { Client } = require('pg');
const compiled = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../lib/student-identifiers.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const helper = {};
new Function('exports', compiled)(helper);

async function run() {
  assert.ok(process.env.TEST_DATABASE_URL, 'Set TEST_DATABASE_URL to a disposable local database');
  for (const role of ['Faculty', 'Parent', 'Headmaster', 'School Admin']) {
    assert.equal(helper.studentAccessSql(role), '');
  }
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  try {
    for (const [roll, admission, allowed] of [
      ['12', 'SSS-TEST-798', true], [' 12 ', ' ADM12 ', true],
      [null, 'ADM12', false], ['12', null, false],
      ['', 'ADM12', false], ['12', '', false],
      [' \t\n', 'ADM12', false], ['12', ' \t\n', false],
    ]) {
      // Exercise the same SQL condition for both email and phone lookups.
      for (const identityColumn of ['student_email', 'student_phone']) {
        const result = await db.query(
          `WITH student_master AS (
             SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid AS tenant_id, $1::text AS roll_no, $2::text AS admission_no,
                    'test@example.com'::text AS student_email, '9999999999'::text AS student_phone
           ) SELECT 1 FROM student_master WHERE ${identityColumn} = $3${helper.studentAccessSql('Student')}`,
          [roll, admission, identityColumn === 'student_email' ? 'test@example.com' : '9999999999'],
        );
        assert.equal(result.rows.length > 0, allowed, JSON.stringify({ roll, admission, identityColumn }));
      }
    }
    const sgs = await db.query(`SELECT 1 FROM (SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid AS tenant_id, NULL::text AS roll_no, NULL::text AS admission_no) student_master WHERE TRUE${helper.studentAccessSql('Student')}`);
    assert.equal(sgs.rows.length, 1, 'Existing SGS access policy is preserved');
    console.log('PASS: email/phone eligibility, missing/blank identifiers, other roles unchanged');
  } finally {
    await db.end();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
