# Provision a new school

Use this after the conversion in [01-saas-conversion.md](./01-saas-conversion.md) is deployed. The person doing these steps needs database access as the provisioning role, DNS access, and write access to the S3 bucket. They do not change application code and they do not start a new server.

A school is ready when a browser opened on its domain shows that school's name and logo, a user of that school can sign in, and a user of another school cannot see this school's students.

## What you collect first

Fill this in before touching the database. The slug is permanent. Use lowercase letters and digits, short enough to be a hostname label (`sss`, `sgs`, `greenwood`).

| Field | Example | Notes |
| --- | --- | --- |
| School name | Shiva Satya Sai School | Shown in the header |
| Short name | SSS | Shown where the layout is narrow |
| Place | Shreeramnagar | Shown under the name on the login page. Leave blank if the school has none |
| Slug | `sss` | Becomes `{slug}.swais.in` |
| Custom domain | `portal.school.edu` | Optional. Leave blank to use only `{slug}.swais.in` |
| Isolation | `rls` or `database` | `rls` puts the school in the shared database. `database` creates a separate Postgres database. Default is `rls` |
| Primary color | `#0F172A` | Header and sidebar |
| Accent color | `#6366F1` | Buttons and the active nav item |
| Support email | `office@school.edu` | Shown in help |
| SMS sender name | SSS School | Goes into the OTP text. Keep it short |
| First admin name, email, phone | | This person receives the first login |
| Logo file | PNG or JPEG, at least 256 px | Square works best |
| Favicon | PNG, 32 px or 48 px | |

Generate the tenant id once and reuse it in every step:

```bash
TENANT_ID=$(uuidgen | tr 'A-Z' 'a-z')
echo "$TENANT_ID"
```

## Roles

| Role | Used for | Can bypass RLS |
| --- | --- | --- |
| App role (`swais_app_user`) | The running websites | No |
| Provisioning role | The steps in this document | Yes, so it can insert the first rows before a school session exists |

Do not run these steps as the app role. Do not put the provisioning password in the app environment.

## Step 1 — Insert the school

Connect to the control database (the shared database, schema `platform`) as the provisioning role.

`config` is the JSON the browser renders. It must not contain a database URL, a password, or a bucket name.

The `:names` below are placeholders. In `psql`, set them first (`\set tenant_id '...'`) and write `:'tenant_id'`, or paste the values in. Use the same tenant id from the `uuidgen` command above.

```sql
INSERT INTO platform.tenants (tenant_id, slug, status, isolation, config)
VALUES (
    :tenant_id,
    :slug,
    'active',
    'rls',
    jsonb_build_object(
        'schoolName', :school_name,
        'shortName', :short_name,
        'place', :place,
        'logoUrl', '/public/brand/logo',
        'faviconUrl', '/public/brand/favicon',
        'theme', jsonb_build_object(
            'primary', :primary,
            'accent', :accent,
            'background', '#F8FAFC'
        ),
        'smsSenderName', :sms_sender_name,
        'supportEmail', :support_email
    )
);
```

Status stays `active` only after step 8 passes. If you are preparing the school before DNS is ready, insert it as `suspended` and set `active` at the end. A suspended school resolves the host and then returns HTTP 403, so nobody can use a half-built school.

## Step 2 — Attach the domain

The default hostname is `{slug}.swais.in`.

```sql
INSERT INTO platform.tenant_domains (domain, tenant_id, verified_at)
VALUES (:slug || '.swais.in', :tenant_id, now());
```

Add a custom domain only after the school controls it. Create a one-time token and ask them to publish a TXT record before you insert the row:

```text
TXT  _swais-verify.portal.school.edu  =  <token>
```

Confirm the TXT record, then:

```sql
INSERT INTO platform.tenant_domains (domain, tenant_id, verified_at)
VALUES ('portal.school.edu', :tenant_id, now());
```

An unverified custom domain must not be inserted. Anyone who can point a domain at the load balancer would otherwise attach it to a school.

One domain belongs to one school. The primary key on `domain` enforces that.

## Step 3 — Choose where the data lives

### Default: shared database (`isolation = 'rls'`)

Do not create a database. The next inserts go into the shared `public` tables.

Open a transaction, set the school, and leave the transaction open until the seed rows are committed. `set_config(..., true)` lasts for that transaction only.

```sql
BEGIN;
SELECT set_config('app.tenant_id', :tenant_id, true);

-- seed rows go here (step 6)

COMMIT;
```

RLS is forced on these tables. The provisioning role can bypass it, so you must set `app.tenant_id` yourself and you must set `tenant_id` on every inserted row to the same value. The stamp trigger will reject a mismatch.

### Alternate: a separate database (`isolation = 'database'`)

Use this when the school requires its own database. Skip the `set_config` block. Do the following instead.

1. Create the database. Name it `school_<slug>`. Use the ASCII slug only.

   ```sql
   CREATE DATABASE school_greenwood;
   ```

2. Run the application schema migrations against that database. Do **not** run the RLS policy script there. Tables in a dedicated database have no `tenant_id` column.

3. Store the connection string in the secret manager. The secret value is the full URL, including the password. The name of the secret is what goes in Postgres:

   ```sql
   UPDATE platform.tenants
   SET isolation = 'database',
       database_secret = 'schools/greenwood/database-url'
   WHERE tenant_id = :tenant_id;
   ```

4. Run the seed SQL from step 6 against `school_greenwood`, not against the shared database.

5. When the application schema changes later, run that migration once for the shared database and once for every row where `isolation = 'database'`. A school database that misses a migration will break only that school.

S3 and the branding JSON are the same in both modes. A separate database does not mean a separate bucket or a separate website deploy.

## Step 4 — DNS and TLS

Point the hostname at the existing load balancer. Do not create a new service.

```text
sss.swais.in.            CNAME   <existing load balancer>
portal.school.edu.       CNAME   <existing load balancer>
```

The certificate must cover `*.swais.in`. For a custom domain, add that name to the certificate and wait until it is issued before marking the domain verified.

The load balancer already routes by path. Those paths stay:

| Path | App |
| --- | --- |
| `/` | Login (`sgs-frontend`) |
| `/student` | Student |
| `/faculty` | Faculty |
| `/headmaster` | Headmaster |
| `/parent` | Parent |
| `/admin` | Admin |
| `/api`, `/api/student`, `/api/v1`, `/api/headmaster`, `/api/admin` | The matching API |

No new nginx `server_name` line is required for `{slug}.swais.in` when the vhost uses `*.swais.in`. A custom domain needs one `server_name` entry, or a wildcard catch-all that still forwards the original `Host` header. The app reads `Host`. If the proxy replaces `Host` with an internal name, every school will 404.

## Step 5 — Logo and favicon

Upload into the existing bucket. The key starts with the tenant id.

```bash
aws s3 cp logo.png "s3://${BUCKET}/${TENANT_ID}/brand/logo" \
  --content-type image/png

aws s3 cp favicon.png "s3://${BUCKET}/${TENANT_ID}/brand/favicon" \
  --content-type image/png
```

The objects stay private. The site serves them through `/public/brand/logo` and `/public/brand/favicon`, which presign the object for the school in the host. Do not mark the objects public, and do not paste an `s3://` URI into `config`.

Check:

```bash
aws s3api head-object --bucket "$BUCKET" --key "${TENANT_ID}/brand/logo"
```

## Step 6 — First people and an empty academic year

Still inside the transaction from step 3 (shared database), or connected to `school_<slug>` (separate database).

Create, in this order:

1. One academic year and one class, so the admin screen has somewhere to put students. Use the class columns the admin API already reads: `class_name`, `section_name`, `academic_year` (`sss-admin-backend` `GET /classes`).
2. The first school-admin user in `users_masters`, role `School Admin`, with the email and phone collected above.
3. No students, unless the school handed you a file. Bulk student import is a later admin-screen action, not part of provisioning.

Match the real column names in the kept schema (`email_id`, `mobile_no`, `full_name` on `users_masters`, from `sgs-frontend/lib/role-mapping.ts`). Set `tenant_id` to `:tenant_id` on every row when using the shared database. Omit `tenant_id` when using a separate database.

Do not copy students from SGS or SSS into the new school.

Give the admin a one-time OTP login. Do not set a shared default password. The login app sends the OTP to the phone or email you inserted, using `smsSenderName` from this school's config.

## Step 7 — Smoke test

Replace the host with the school's domain. Every check is done twice: once on the new school, once on an existing school (`sgs.swais.in` or `sss.swais.in`), to prove they did not get crossed.

### Config

```bash
curl -sS -D - -H "Host: greenwood.swais.in" \
  https://greenwood.swais.in/public/tenant-config
```

Expect HTTP 200 and JSON whose `schoolName` is the name you inserted. The body must not contain `database_secret`, `postgres://`, or `AWS_SECRET`.

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -H "Host: not-a-school.swais.in" \
  https://not-a-school.swais.in/public/tenant-config
```

Expect `404`.

### Brand

Open `https://greenwood.swais.in/` in a browser. The login page shows the new logo, the school name, and the place line. View source and confirm the HTML does not contain `SGS Senior Secondary School` or `SSS SCHOOL`.

Open `/student`, `/faculty`, `/headmaster`, `/parent`, and `/admin` on the same host. Each header shows the same logo and school name. The subtitle may differ (`Faculty`, `Headmaster Dashboard`).

### Login and isolation

Sign in as the new admin. You land on `/admin/students` (the relative path in `lib/role-mapping.ts`). The student list is empty.

Sign in as an existing SGS user on `https://greenwood.swais.in/`. The login must fail. That person is not a user of this school.

Sign in as the new admin on `https://sgs.swais.in/`. The login must fail the same way.

### Database

As the provisioning role:

```sql
BEGIN;
SELECT set_config('app.tenant_id', :tenant_id, true);
SELECT count(*) FROM student_master;
ROLLBACK;
```

The count is the number of students you seeded (zero for a new school). Repeat with the SGS tenant id and confirm the SGS count did not change.

Then connect as the **app** role, which cannot bypass RLS, and run the same select with no `set_config`. The count must be 0.

### Files

```bash
aws s3 ls "s3://${BUCKET}/${TENANT_ID}/brand/"
```

Expect `logo` and `favicon`. Upload a throwaway student photo through the admin screen and confirm the new key starts with `${TENANT_ID}/admin/students/`.

### Separate-database extra check

If `isolation = 'database'`:

```sql
SELECT datname FROM pg_database WHERE datname = 'school_greenwood';
```

Connect to that database and confirm the seeded admin exists. Connect to the shared database, set `app.tenant_id` to this school's id, and confirm `student_master` has no row for them.

## Step 8 — Hand over

Send the admin:

- The URL `https://{slug}.swais.in/`
- The custom URL, if you added one
- The email and phone that will receive the OTP
- No password

Set the row to active if you inserted it as suspended:

```sql
UPDATE platform.tenants
SET status = 'active'
WHERE tenant_id = :tenant_id;
```

Watch the first real login. A 404 on the school's own host means the domain row is missing or the proxy dropped `Host`. A 403 means the school is still suspended. An empty brand image means the S3 key is not `{tenant_id}/brand/logo`.

## Suspend or remove a school

Suspend. This is the normal off switch. DNS and files stay, so turning it back on is one update.

```sql
UPDATE platform.tenants
SET status = 'suspended'
WHERE slug = :slug;
```

The resolver returns 403 for every app on that host. Other schools are unaffected. To restore, set `status` back to `active`.

Remove a school only when the contract says the data must go.

Shared database:

```sql
BEGIN;
SELECT set_config('app.tenant_id', :tenant_id, true);
-- delete child rows first, in FK order, all inside this transaction
DELETE FROM student_master WHERE tenant_id = :tenant_id::uuid;
-- repeat for the other school tables, children before parents
DELETE FROM platform.tenant_domains WHERE tenant_id = :tenant_id::uuid;
DELETE FROM platform.tenants WHERE tenant_id = :tenant_id::uuid;
COMMIT;
```

Then delete the prefix:

```bash
aws s3 rm "s3://${BUCKET}/${TENANT_ID}/" --recursive
```

Separate database:

```sql
DROP DATABASE school_greenwood;
DELETE FROM platform.tenant_domains WHERE tenant_id = :tenant_id;
DELETE FROM platform.tenants WHERE tenant_id = :tenant_id;
```

Drop the secret from the secret manager as well, and delete the same S3 prefix. `DROP DATABASE` will fail if the app still has a pooled connection. Suspend the school first and restart the app processes so they drop that engine, then drop the database.

## First two schools

SGS and SSS are provisioned with this same checklist, once, as part of the conversion. They are not special in the software.

| | SGS | SSS |
| --- | --- | --- |
| Slug | `sgs` | `sss` |
| Domain | `sgs.swais.in` | `sss.swais.in` |
| Also accept, until DNS is cut over | the current SGS host | `staging.sss.swais.in` |
| `schoolName` | SGS Senior Secondary School | Shiva Satya Sai School |
| `place` | SHREERAMNAGAR | |
| `shortName` | SGS | SSS |
| `smsSenderName` | SGS School | SSS School |
| Isolation | `rls` | `rls` |
| Rows | the existing SGS tables, backfilled with the SGS tenant id | the existing SSS tables, copied in with the SSS tenant id |
| Logo | the file served today as `/assets/sgs-logo.png` and `public/sgslogo.jpeg`, uploaded to `{tenant_id}/brand/logo` | `school-logo.jpeg` from the headmaster app, and `SSS_logo.jpeg` from the student app if they differ. Pick one, upload it, and stop shipping both |

Keep `staging.sss.swais.in` as a second row in `platform.tenant_domains` for the SSS tenant until every hardcoded link is gone and users have moved. Delete that extra domain row when step 7 on `sss.swais.in` passes and nobody is using the staging host.

Do not create a third database or a third set of `sgs_` tables for these two schools.
