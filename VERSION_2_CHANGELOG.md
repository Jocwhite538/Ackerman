# Ackerman Patient Payment Board — Version 2 Change Log

**Prepared for company presentation — September 2026**

Version 2 is a major workflow simplification and usability update focused on making the Payment Board faster for the front desk to scan, easier for Finance to manage, and clearer about responsibility between Ackerman and UF.

---

## Executive Summary

Version 2 introduces a simpler payment-plan-centered workflow, clearer operational statuses, dedicated Ackerman-vs-UF responsibility tracking, a UF verification queue, improved completion/archive controls, better financial visibility, cleaner analytics, and formatted Excel reporting.

The main goals of this version were to:

- reduce unnecessary fields and clicks
- make the active patient board easier to scan
- clearly separate Ackerman responsibility from UF responsibility
- make overdue and due-today amounts obvious to front-desk staff
- give Finance a dedicated workflow for checking UF payments
- simplify payment-plan creation and maintenance
- improve completion/archive documentation
- improve reporting and export quality

---

# 1. Patient Workflow Simplification

## Physician removed

The Physician field was removed throughout the application, including:

- Add/Edit Patient
- Active Patient Board
- Completed Patients
- filters and sorting
- Statistical Analysis
- Excel exports
- printable patient summaries

## Outcome / follow-up workflow removed

The previous collection Outcome workflow was removed, including:

- Outcome button
- Outcome dialog
- outcome history
- follow-up tracking
- outcome-related analytics

This keeps the application focused on payment status, responsibility, UF verification, notes, and completion.

## Direct patient actions simplified

Each active patient now has a consistent four-button action area:

- **Pay**
- **Docs**
- **View Details**
- **Complete**

The buttons are arranged consistently across rows so staff do not have to search for actions.

If no Ackerman-responsible balance is available to collect, the Pay button remains visible but is disabled so the layout does not shift.

## Status / Action Note added

A short editable note appears directly below each patient's status.

Examples:

- Call patient
- Waiting on card
- Check with UF
- Patient coming Friday

The note is preserved in the patient record, Patient Details, Completed Patients, and exports.

---

# 2. Treatment Types and Treatment Sites

## Updated Treatment Types

Treatment Type is now limited to:

- **Proton**
- **Radiation (Linac/HDR/Other)**
- **Imaging**
- **Clinic**
- **Women's Imaging**

Older prototype treatment values are mapped into the new categories where possible.

## Updated Treatment Sites

Treatment sites now include:

- **Jacksonville**
- **Amelia Island**
- **St. Augustine**
- **Urology World Golf Village**
- **Urology Middleburg**

**Orange Park was removed.**

Older Orange Park prototype records are mapped to Urology Middleburg so Orange Park does not reappear in dynamic filters.

---

# 3. Payment Plans Are Now the Standard Workflow

## Standard Collection removed

The former **Standard Collection** arrangement was removed.

The only account arrangements are now:

- **Payment Plan**
- **No Payment Responsibility**

A patient with only one required payment is still treated as a **one-payment payment plan**.

## New patients default to Payment Plan

When adding a new patient, Payment Plan is selected by default.

## Payment plans now support 1–24 payments

A payment plan can contain:

- 1 payment
- multiple scheduled payments
- up to 24 payments

This removes the need for a separate one-time collection workflow.

---

# 4. Payment-Plan Editor Simplified

The payment-plan editor was redesigned to be more manual and easier to understand.

## Removed controls

The following controls were removed:

- Rebalance All
- Redistribute Unpaid
- Grace Period
- Skip / Defer
- required plan-change reason
- Promise-to-Pay Date
- Shift Unpaid Dates

## Build Schedule made more prominent

**Build / Generate Payment Schedule** is now more visually prominent.

The generated schedule is only a starting point.

Staff can manually edit each installment's:

- due date
- amount
- responsibility assignment

The schedule no longer has to exactly match the reference target before it can be saved.

---

# 5. Ackerman vs UF Responsibility

Every scheduled payment must be assigned to exactly one party:

- **Ackerman responsible**
- **UF responsible**

This responsibility is visible throughout the payment-plan workflow.

## Ackerman-responsible payments

Ackerman-responsible installments drive:

- overdue status
- overdue-payment count
- due-today amount
- past-due amount
- Ackerman outstanding amount
- Ackerman on-time performance
- Pay workflow limits

The Pay workflow is limited to the amount that remains assigned to Ackerman.

## UF-responsible payments

UF-responsible installments are tracked separately from Ackerman collections.

A verified UF payment:

- reduces total outstanding responsibility
- does **not** increase Ackerman's collected-dollar total
- is shown as verified in the payment-plan record

---

# 6. UF Verification Queue

Version 2 adds a dedicated Finance workflow for confirming UF payments.

## Check UF flag

When a UF-responsible installment passes its due date and has not been verified, the patient receives a neutral blue:

**⚑ Check UF**

The flag:

- does not appear on the actual due date
- appears beginning the day after the due date
- does not turn the patient red or yellow
- remains separate from Ackerman overdue status

## UF verification from View Details

UF-responsible installments can be marked directly from Patient Details using a **Check UF** checkbox.

## UF Checks Due filter

The active-board Status filter includes:

**UF Checks Due**

This allows Finance to isolate all patients requiring UF verification.

## UF check aging

The system now shows how long UF verification has been outstanding.

Examples:

- 1 day past due
- 4 days past due
- 10 days past due

The board also shows the age of the oldest pending UF check.

## UF sorting

Finance can sort by:

- **UF check: oldest first**
- **UF check: newest first**

Selecting UF Checks Due automatically prioritizes the oldest checks first.

## UF analytics

UF Checks Due is also included in Statistical Analysis.

---

# 7. Active-Board Status System

The front-page status system was simplified to focus on operational timing.

## Main row statuses

The board uses:

- **Overdue**
- **Due Today**
- **Upcoming Collection**
- **Paid in Full**
- **No Responsibility**

## Status filters

The Status filter includes:

- **Overdue**
- **Due Today**
- **Overdue and Due Today**
- **Upcoming Collection**
- **Paid in Full**
- **No Responsibility**
- **UF Checks Due**
- **Payment Plans**

### Overdue and Due Today

**Overdue and Due Today** is a combined work-list filter using OR logic.

It displays:

- all overdue patients
- all patients due today

Individual patient rows still show their actual status as Overdue or Due Today.

---

# 8. Red / Yellow / Green Operational Color System

The old purple payment-plan coloring was removed.

Ackerman-responsible overdue payments now control the operational color:

- **Green** — no Ackerman-responsible payments overdue
- **Yellow** — exactly 1 Ackerman-responsible payment overdue
- **Red** — 2 or more Ackerman-responsible payments overdue

UF verification remains a separate neutral blue flag.

## Overdue-payment count

The active board shows the exact number of overdue Ackerman payments beneath the status.

Examples:

- 1 payment overdue
- 2 payments overdue
- 3 payments overdue

## Past-due amount

The board also shows the amount required to catch the patient up.

Example:

**Past due: $1,666.67**

## Due-today amount

For patients with payments due today, the board shows:

**Due today: $833.34**

This allows front-desk staff to see the actionable amount without opening Patient Details.

---

# 9. Financial Visibility Improved

Payment-plan accounts now clearly separate financial responsibility.

## Active Patient Board

The board can show:

- Total responsibility
- Ackerman responsibility / outstanding
- UF responsibility / outstanding
- Total outstanding
- Plan progress
- Percentage remaining

## View Details

The top financial snapshot was simplified to focus on:

- **Total Responsibility**
- **Ackerman Outstanding**
- **UF Outstanding**
- **Total Outstanding**
- **Complete %**
- **Remaining %**

The Payment Plan Performance area then focuses on:

- Ackerman Overdue
- Due Today
- UF Checks Due
- Ackerman On-Time

This reduces duplicated information and makes the most important figures easier to find.

---

# 10. Completion and Archive Workflow

## Complete button added directly to the board

Complete is available directly beside View Details.

## Patients may be completed with an outstanding balance

A patient can be moved off the active board even if the full balance has not been satisfied.

This supports situations such as:

- patient cancelled treatment
- patient deceased
- transferred / referred elsewhere
- administrative closure
- other operational reasons

Outstanding balances are preserved in Completed Patients.

## Completion Reason required

When Complete is selected, a Completion Reason is required.

Available reasons include:

- **Treatment completed**
- **Patient cancelled treatment**
- **Patient deceased**
- **Transferred / referred elsewhere**
- **Administrative closure**
- **Other**

An optional Completion Note can also be entered.

If **Other** is selected, a note is required.

## Completion information preserved

Completion Reason and Completion Note are included in:

- Completed Patients
- Patient Details
- activity history
- printable summary
- Completed Patients Excel export

## Restore to Active retained

Completed patients can still be restored to the active Payment Board.

---

# 11. Add/Edit Patient Window Protection

The Add/Edit Patient dialog is protected against accidental data loss.

It no longer closes when:

- clicking outside the window
- pressing Escape

The top-right X was also removed from this dialog.

The window closes only when:

- **Cancel** is selected
- **Save Patient** completes successfully

---

# 12. Active Board Readability and Layout

The active board was adjusted for easier front-desk scanning.

Font sizes were increased for important information, including:

- status
- treatment type
- treatment site
- insurance
- due dates
- supporting status information
- financial plan details

The goal was to improve readability while keeping the board compact enough for a large patient queue.

The action buttons were also reorganized into a cleaner horizontal layout.

---

# 13. Statistical Analysis Improvements

The Statistical Analysis page continues to provide high-level financial and operational reporting.

Current analysis includes:

- Patient Responsibility
- Total Collected
- Amount Outstanding
- Dollar Collection Rate
- Patients Paying
- Paid in Full
- Average per Paying Patient
- Median Payment
- Ackerman payment-plan on-time rate
- Plans needing attention
- Adjustments
- Critical patients with multiple Ackerman payments overdue
- UF Checks Due
- Collections by month
- Outstanding balance by status
- Collection rate by location
- Payment-method distribution
- detailed payment-plan performance
- grouped breakdowns
- operational highlights

## Payment Plan Performance is collapsible

The Payment Plan Performance table is now:

- collapsed by default
- opened or closed with an arrow / Show-Hide control

This prevents a large patient list from dominating the analytics page when Finance only needs summary information.

---

# 14. Completed Patients Improvements

Completed Patients remains a separate archive.

It includes:

- completed-patient search
- completion-date filters
- treatment-site filters
- treatment-type filters
- completion-type filters
- financial results
- payment-plan performance
- payment ledger
- adjustments
- documents
- activity history
- Completion Reason / Note
- Restore to Active

Outstanding balances remain visible after completion.

---

# 15. Excel Reporting

Active and Completed exports were upgraded from plain CSV files to formatted **Excel `.xlsx` workbooks**.

## Excel formatting

Exports now include:

- Ackerman-style navy/teal formatting
- colored status cells
- UF-check highlighting
- formatted currency
- formatted percentages
- formatted dates
- borders
- readable column widths
- frozen headings
- Excel filters

## Active Patient export

The Active Patients workbook includes operational fields such as:

- patient/status information
- treatment site/type
- responsibility
- Ackerman and UF information
- outstanding amounts
- status/action note
- overdue counts
- UF checks due
- oldest UF-check age
- account timestamps

## Completed Patient export

Completed Patients includes the completed-account summary plus chronological payment-history columns.

Examples:

- Payment 1 Date
- Payment 1 Amount
- Payment 2 Date
- Payment 2 Amount
- Payment 3 Date
- Payment 3 Amount

The export automatically adds enough payment-column pairs for the largest payment history in the current view.

Refunds and reversals are represented as negative amounts.

## Excel compatibility fix

The Excel exporter was corrected after Microsoft Excel identified an Open XML element-ordering problem.

Both Active and Completed `.xlsx` exports now use the corrected workbook structure.

---

# 16. Printable Patient Summaries

Printable summaries were updated to match the Version 2 workflow.

They include:

- account overview
- financial totals
- Ackerman / UF responsibility
- payment schedule
- payment ledger
- adjustments
- Status / Action Note
- documents index
- activity history
- Completion Reason / Note where applicable

Removed Outcome/Follow-up information is no longer included.

---

# 17. Data Migration and Prototype Compatibility

The application preserves compatibility with older prototype records where possible.

Migration behavior includes:

- older Payment Plan rows defaulting to Ackerman responsibility when no responsibility was previously stored
- older Proton Therapy values mapping to Proton
- older Radiation Therapy values mapping to Radiation (Linac/HDR/Other)
- older Consultation values mapping to Clinic
- legacy Standard Collection records converting to one-payment Payment Plans
- legacy Orange Park records mapping to Urology Middleburg
- removed Physician and Outcome information no longer being part of the active Version 2 workflow

Two fictional patients with overdue UF-responsible payments were also added to demonstrate the Check UF workflow during testing.

---

# 18. Current Version 2 Workflow at a Glance

For the front desk:

1. Open the active Payment Board.
2. See whether the patient is Overdue, Due Today, Upcoming, Paid in Full, or No Responsibility.
3. See how many payments are overdue and the total past-due amount.
4. See the amount due today without opening the patient.
5. Use the quick Status / Action Note when needed.
6. Use Pay, Docs, View Details, or Complete.

For Finance:

1. Filter to Payment Plans, Overdue, Due Today, or UF Checks Due.
2. Review Ackerman responsibility separately from UF responsibility.
3. Sort UF verification oldest first.
4. Check UF payments directly from View Details.
5. Review responsibility, outstanding amounts, progress, and payment history.
6. Use Statistical Analysis or formatted Excel exports for reporting.

---

# 19. Current Prototype Scope

Version 2 remains a **fictional-data browser prototype**.

Current browser storage is local to the computer/browser being used. Publishing the interface through GitHub Pages does not create a shared multi-user patient database.

A future production deployment using real patient information would require an approved secure architecture including authentication, role-based access, centralized database/storage, audit controls, backups, and other required organizational/security safeguards.

---

## Version 2 Key Takeaways

- Simpler front-desk workflow
- Payment Plan is now the standard collection model
- One-payment plans are supported
- Clear Ackerman-vs-UF responsibility
- Dedicated Check UF workflow
- Better overdue and due-today visibility
- Required completion documentation
- Cleaner Patient Details
- More readable active board
- Improved analytics
- Professional formatted Excel reports
- Completed accounts retain full history and can be restored
