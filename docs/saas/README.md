# School SaaS runbooks

These are the steps for turning the school portals into one product that can host many schools. They are written for developers to implement. No application code is changed by this document set.

| Document | Use it for |
| --- | --- |
| [01-saas-conversion.md](./01-saas-conversion.md) | Change the existing apps so the school is chosen from the domain, every query is isolated, files sit under that school in S3, and the school name and logo come from one JSON document. |
| [02-school-provisioning.md](./02-school-provisioning.md) | Add a new school after the conversion is in place. No code change, no new deploy. |
| [03-saas-sample-conversion.md](./03-saas-sample-conversion.md) | Build the old databases and the shared database, then run branch `saas`. The login-app code is already on that branch. |

The table definitions, indexes, and the row-level security migration live in [saraswati-tenant-kit](https://github.com/SarafWorldsphere/saraswati-tenant-kit). This folder is the runbook for the apps. Do not copy either one into the other repositories.
