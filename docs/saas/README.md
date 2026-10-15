# School SaaS runbooks

These are the steps for turning the school portals into one product that can host many schools. They are written for developers to implement. No application code is changed by this document set.

| Document | Use it for |
| --- | --- |
| [01-saas-conversion.md](./01-saas-conversion.md) | Change the existing apps so the school is chosen from the domain, every query is isolated, files sit under that school in S3, and the school name and logo come from one JSON document. |
| [02-school-provisioning.md](./02-school-provisioning.md) | Add a new school after the conversion is in place. No code change, no new deploy. |

This folder is the source of truth. Do not copy it into the other repositories.
