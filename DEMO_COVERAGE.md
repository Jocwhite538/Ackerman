# Ackerman Patient Payment Board — Demo Coverage Matrix

**Version 2.1.3**

This file documents the fictional presentation scenarios included in a fresh/reset demo dataset. The purpose is to make sure a presenter can quickly demonstrate the major workflows without manually creating test accounts.

## Dataset summary

- **28 total fictional patients**
- **23 active patients**
- **5 completed patients**
- Existing browser demo edits are preserved during upgrades. Version 2.1.3 appends missing coverage patients rather than resetting the dataset.

## Operational workflow coverage

| Scenario | Demo coverage | Example patients |
| --- | ---: | --- |
| UF Checks Due | 4 patients | Riley Morgan, Jordan Hayes, Maya Lopez, Caleb Wright |
| UF-only schedules | 2 patients | Maya Lopez, Caleb Wright |
| Red — 2+ ACC payments overdue | 3 patients | Benjamin Scott, Natalie Reed, Marcus Bell |
| Yellow — exactly 1 ACC payment overdue | 5 patients | Multiple existing demo accounts |
| Due Today | 4 patients | Sofia Patel / existing due-today example, plus Emily Stone and Dylan Moore |
| Upcoming / on-track plans | 3 patients | Multiple existing demo accounts |
| Active Paid in Full | 2 patients | Noah Bennett, Andrew Hall |
| No Responsibility | 2 patients | Mia Thompson, Sarah Coleman |
| Mixed ACC / UF responsibility | 2+ patients | Riley Morgan, Jordan Hayes |
| Multi-treatment flags | 8 active patients | Maya Lopez, Caleb Wright, Natalie Reed, Marcus Bell, Emily Stone, Dylan Moore, Sarah Coleman, Andrew Hall |
| Completed, paid/satisfied | 3 patients | Existing completed demo accounts |
| Completed with outstanding balance | 2 patients | Rachel Green, Thomas Young |
| Completed with adjustment | 2 patients | Rachel Green, Thomas Young |

## Treatment flag coverage

Every treatment flag appears on multiple patients:

- Proton
- Radiation (Linac/HDR/Other)
- Imaging
- Clinic
- Women's Imaging

Version 2.1.3 also deliberately includes multiple patients with **more than one treatment flag**, matching the intended production workflow.

## Treatment-site coverage

The active demo queue contains multiple patients from each configured treatment site:

- Jacksonville
- Amelia Island
- St. Augustine
- Urology World Golf Village
- Urology Middleburg

## Version 2.1.3 purpose-built coverage patients

- **DEMO-1019 — Maya Lopez:** UF-only plan, Check UF due, Women's Imaging + Imaging.
- **DEMO-1020 — Caleb Wright:** second UF-only Check UF example, Clinic + Imaging.
- **DEMO-1021 — Natalie Reed:** red account with two ACC payments overdue, Proton + Imaging.
- **DEMO-1022 — Marcus Bell:** second red account with three ACC payments overdue, Radiation + Clinic.
- **DEMO-1023 — Emily Stone:** payment due today, Women's Imaging + Clinic.
- **DEMO-1024 — Dylan Moore:** second payment-due-today example, Radiation + Imaging.
- **DEMO-1025 — Sarah Coleman:** second No Responsibility example, Proton + Clinic.
- **DEMO-1026 — Andrew Hall:** second active Paid in Full example, Clinic + Imaging.
- **DEMO-1027 — Rachel Green:** completed with outstanding balance, cancellation reason, financial-assistance adjustment.
- **DEMO-1028 — Thomas Young:** completed with outstanding balance, transfer reason, write-off adjustment.

All names, MRNs, financial values, insurers, and payment records in this prototype are fictional.
