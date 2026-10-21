# Pending conversion tasks

These are the items still open in [01-saas-conversion.md](./01-saas-conversion.md). Login host resolution and the parent API session are already on branch `saas`. They are not rows here.

One working day is 8 hours. A 16-hour task is two working days. Dates skip Saturday and Sunday. Phase 1 starts Monday 19 October 2026.

The team member is the last person who committed on that module. When the SGS repository and the SSS repository have different people, both names are in the cell. The reviewer is Murthy Pattisapu, who owns this runbook. His own rows have no reviewer in git.

## Phase 1

| Sl.No. | Module | Activity | Team member | Reviewer | Hours | Start | End | Depends on | Task details |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Platform | School column on the shared tables | Murthy Pattisapu | | 24 | 2026-10-19 | 2026-10-21 | | `tenant_id` is already on the kit tables. Copy SGS and SSS rows into those tables inside `set_config`. Student, faculty, headmaster, and admin still read `sgs_` / `sss_` names. This row is the data copy. The module rows below switch each app's SQL. |
| 2 | Login | After login, keep only this school's rows | Murthy Pattisapu, Anushka Gupta | | 16 | 2026-10-22 | 2026-10-23 | 1 | `sgs-frontend`: `lib/user-role-check.ts` and `lib/student-access.ts` still query `sgs_*` and fall back to a database name. Point them at `bindTenant`. SMS sender text comes from `config.smsSenderName`. Set `SGS_SSO_SECRET`, `SGS_PARENT_SSO_URL`, and `NEXT_PUBLIC_PARENT_DASHBOARD_URL` so a parent lands on the parent app with a token. Anushka last changed `sss_new_loginscreen`. |
| 3 | Admin | Admin dashboard, the sample module | Yaswanth | Murthy Pattisapu | 32 | 2026-10-22 | 2026-10-27 | 1 | Convert `sss-admin-dashboard` first. The other modules copy this shape. Unprefixed SQL, `name` → `full_name`, `roll_number` → `roll_no`, `sss_users_master` → `users_masters`, `SchoolMiddleware`, `apply_rls`, public config on the shell, logout to `/`. Copy `student-photos/`, root `father-` and `mother-` objects, and any `sss/admin/` key under `{tenant_id}/`, then write new keys with `build_key`. |
| 4 | Student | Bring SSS student screens into the SGS student app | Swati, Renuka Gudavalli | Murthy Pattisapu | 24 | 2026-10-19 | 2026-10-21 | | Port into `sgs-student-module` from `sss_student`: chapter PDF upload (`POST /chapter-pdf`), the assignments screen and typed-answer submission, and the assessments screen. Remove the hardcoded school name, logo path, and staging host in the same change. |
| 5 | Parent | Bring SSS parent voice into the SGS parent app | Bhuvan, Vaibhav | Murthy Pattisapu | 16 | 2026-10-19 | 2026-10-20 | | Port `voice-to-text` and `text-to-voice` from `sss-parent-dashboard` into `sgs-parent-module`. `TopBar` is already there. A missing session in `useDashboardState.ts` still redirects to `NEXT_PUBLIC_SGS_URL`. Send it to `/` on the current host. |
| 6 | Student | Student module, same session rules as the admin sample | Swati, Renuka Gudavalli | Murthy Pattisapu | 24 | 2026-10-28 | 2026-10-30 | 1, 3, 4 | `sgs-student-module`: `proxy.ts` calls `resolveTenant`. `get_connection` uses `open_school_session`. Queries use the kit table names and do not add `WHERE tenant_id`. Replace `sgslogo.jpeg` and the shell title with `schoolLogo` and `config.schoolName`. Logout goes to `/`. |
| 7 | Faculty API | Faculty API, same session rules as the admin sample | Bhuvan | Murthy Pattisapu | 32 | 2026-10-28 | 2026-11-02 | 1, 3 | `sgs-faculty-backend`: drop `sgs_` table names, `SchoolMiddleware`, `apply_rls` in `get_db`, `tenant_id` on the faculty JWT, reject a token from another school. Lesson-plan masthead reads `current_school().config["schoolName"]`. Delete `SCHOOL_NAME`. Copy `study-material/` and `assignments/` under `{tenant_id}/`, rewrite `file_storage_metadata.file_url`, and replace the local key builders with `build_key`. |
| 8 | Faculty UI | Faculty screens | Bhuvan | Murthy Pattisapu | 16 | 2026-11-03 | 2026-11-04 | 3, 7 | `sgs-faculty-frontend`: kit, theme, `schoolLogo`. Remove `/sgs-logo.png` and "SGS Portal". Logout goes to `/`. |
| 9 | Headmaster | Headmaster module, same session rules as the admin sample | Hari Sankar, Madhuri | Murthy Pattisapu | 32 | 2026-10-28 | 2026-11-02 | 1, 3 | `sss-hm-dashboard`: replace `sss_*` SQL and the column renames in step 3 of the conversion doc. `SchoolMiddleware` and `apply_rls`. Turn `useAuthGuard` back on and reject a token from another school. Remove `/headmaster/school-logo.jpeg`, "SSS SCHOOL", and `https://staging.sss.swais.in`. Madhuri last changed the frozen SGS headmaster app. |
| 10 | All modules | Acceptance tests | Murthy Pattisapu | | 16 | 2026-11-05 | 2026-11-06 | 2, 5, 6, 7, 8, 9 | The nine checks in Step 8 of the conversion doc. Unknown host is 404. A cross-school token is rejected. `GET /public/tenant-config` has no database secret. A new S3 key starts with the tenant id. |
| 11 | Platform | Empty third school | Murthy Pattisapu | | 8 | 2026-11-09 | 2026-11-09 | 10 | Provision one school with no code change, using [02-school-provisioning.md](./02-school-provisioning.md). |

Phase 1 is 240 hours and finishes Monday 9 November 2026.

## Phase 2

Dates stay open until phase 1 is finished.

| Sl.No. | Module | Activity | Team member | Reviewer | Hours | Start | End | Depends on | Task details |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Platform | Feature activation table | Murthy Pattisapu | | 16 | | | Phase 1 | Add a `platform` table that turns a module on or off for one school. The key is the tenant already resolved from the host. A missing row stays off. Shells read it after `resolveTenant` / `resolve_school`. |
