# Ackerman Patient Payment Board — Version 2.1.6 Prototype

Version 2.1.3 is a static, clickable workflow prototype for Ackerman Cancer Center patient-responsibility tracking. It uses fictional patient names, fictional `DEMO-` MRNs, and fictional financial information only.



## Version 2.1.6 — Browser Cache Busting

- Added a release-version query string to every local CSS and JavaScript asset reference on Payment Board, Statistical Analysis, and Completed Patients.
- Browsers now request URLs such as `styles.css?v=2.1.6` and `board.js?v=2.1.6` instead of reusing the prior release URL.
- Future releases should update the query-string version when the package version changes. This prevents coworkers who previously opened the GitHub Pages site from continuing to use an older cached CSS/JavaScript bundle after a deployment.
- No patient, payment, status, or workflow logic changed in this release.

## Version 2.1.5 — Collapsible Patient Rows

- Every active patient row now has an arrow beside the patient name to collapse or expand that patient individually.
- Added a **Collapse All / Expand All** control above the active work queue for all currently visible patients.
- Collapsed rows retain the operational summary needed for scanning: status, patient name, treatment flags, site, actionable amount, total outstanding, next due information, and all four action buttons.
- Detailed financial responsibility blocks, progress bars, insurance detail, update timestamp, and quick note are hidden only while a row is collapsed.
- Collapse state is presentation-only and does not change patient data, filters, statuses, payments, or exports.

## Demo coverage in Version 2.1.3

The fictional demo dataset was expanded and audited so the presentation includes multiple examples of the major workflows. A fresh/reset dataset now contains 28 fictional patients (23 active and 5 completed), including at least two examples of each major operational case: UF Checks Due, red 2+ overdue accounts, Due Today, No Responsibility, active Paid in Full, Completed with an outstanding balance, and multi-treatment patients. It also includes two UF-only schedules, two completed accounts with financial adjustments, and at least two patients for every treatment flag and treatment site.

When upgrading from an earlier Version 2 browser dataset, the new coverage patients are appended automatically if they are missing; existing demo records and edits are not overwritten. See `DEMO_COVERAGE.md` for the presentation matrix.

## What changed in Version 2.1

Version 2.1 incorporates company feedback after the Version 2 review and moves the application to a simpler **assigned schedule + actual payment ledger** model.

### Treatment flags

Treatment is now multi-select. A patient can have more than one treatment category at the same time:

- Proton
- Radiation (Linac/HDR/Other)
- Imaging
- Clinic
- Women's Imaging

Selected treatments are displayed as compact flags/badges on the active and completed boards and can be filtered individually in reporting.

### Financial responsibility model

The Financials / Plan column now separates planned responsibility from actual collections:

- Total Patient Responsibility — total, collected, outstanding
- ACC Assigned Patient Responsibility — assigned, collected, outstanding
- UF Assigned Patient Responsibility — assigned, collected, outstanding

The payment schedule defines what is **assigned**. The payment ledger records what was **actually collected**. Recording a payment does not automatically rewrite the assigned schedule.

### Version 2.1.2 UI hotfix

- Widened the Payments workspace so the full schedule is easier to work with.
- The schedule now preserves a dedicated Action column for **Record Payment** and **Remove**.
- The Action column remains visible while horizontally scrolling on narrower screens.
- Adjusted the main-board **Payments** button sizing so the label does not clip.

### Payments workspace

The active-board actions are now:

- **Payments**
- **Docs**
- **View Details**
- **Complete**

The Payments workspace is the financial editing area. It includes the editable payment schedule and the payment ledger.

Each saved scheduled payment has a **Record Payment** action. The payment form is prepopulated with the scheduled payment context and requires:

- collected amount
- username / staff member
- office site
- payment method
- collection date

A collected amount can be less than or greater than the scheduled amount. The ledger records the actual amount while the assigned schedule remains unchanged unless staff intentionally edit and save the schedule.

### ACC and UF payment recording

ACC and UF payments use the same ledger model. Each payment record is linked to the applicable scheduled payment and records the assigned party.

For UF payments, the ledger is now the source of truth. Once a positive UF payment is recorded against an overdue UF scheduled payment, the **Check UF** verification flag clears automatically. Older prototype UF-verification checkboxes are migrated into linked UF payment records when possible.

### Read-only View Details

**View Details** is now a read-only summary. Financial edits are handled in **Payments**, document changes in **Docs**, and archive actions in **Complete**.

The summary includes responsibility totals, treatment flags, payment schedule, payment ledger, notes, adjustments, documents, and activity history.

### Reporting

Active and Completed Excel exports use the new responsibility model. Completed exports still append chronological payment-history pairs at the end of each row:

- Payment 1 Date / Payment 1 Amount
- Payment 2 Date / Payment 2 Amount
- and so on

## Prototype office-site list

The current payment-entry office-site choices are:

- ACC Mandarin
- ACC Amelia Island
- ACC St. Augustine
- Urology World Golf Village
- Urology Middleburg
- Other

These are prototype values and can be changed to the final company list later.

## Important: browser-only prototype

Publishing this folder with GitHub Pages makes the interface available through a link. It does **not** create a shared patient database.

The prototype currently stores:

- patient, payment, adjustment, activity, payment-plan, and saved-view data in the current browser's `localStorage`
- attached test documents in the current browser's IndexedDB

An entry made on one computer is therefore not visible on another computer. A production multi-office version using real patient information would require an approved secure architecture with authentication, authorization, centralized storage/database services, audit controls, backups, and other required organizational/security safeguards.

**Do not use real patient information in the browser-only prototype.**

## Running locally

Extract all files from the ZIP and open `index.html` from the extracted folder. Do not open `index.html` while it is still inside the ZIP archive.


## Version 2.1.2 UI polish

- View Details now always opens at the top instead of retaining a prior scroll position.
- View Details uses a taller, wider anchored-header/footer layout.
- Schedule and ledger tables scroll horizontally inside the modal instead of clipping columns.
- Spacing, section hierarchy, and footer button alignment were refined.
