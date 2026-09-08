# Ackerman Patient Payment Board - Version 4.2 Prototype

This is a static, clickable GitHub Pages prototype containing fictional patient names, fictional `DEMO-` MRNs, and fictional financial information only.

## Important: what GitHub Pages does and does not do

Publishing this folder with GitHub Pages makes the website interface available through a link. It does **not** create a shared patient database.

The prototype currently stores:

- patient, payment, adjustment, outcome, timeline, and saved-view data in the current browser's `localStorage`
- attached test documents in the current browser's IndexedDB

As a result, an entry made on one computer is not visible on another computer. A shared multi-office version requires a server/API, central database, and shared document storage.

Do not use real patient information on the public GitHub Pages prototype.

## Version 4.2 features

### Version 4.2 interface simplification

- Removed the redundant **More** dropdown from every active patient row
- Added a direct **View Details** button beside **Pay**, **Outcome**, and **Docs**
- Kept the row actions **Pay**, **Outcome**, **Docs**, and **View Details**
- Removed duplicate page-navigation buttons below the primary navigation
- Removed the duplicate Record Outcome action from Patient Details; new outcomes are entered from the row-level Outcome button
- Consolidated the summary cards so daily figures appear only in Today’s Operations
- Removed the user-facing Reset Demo button

### Last-updated information and printable summaries

- Every account now stores `createdAt` and `updatedAt` timestamps
- Active and completed patient rows show the most recent update time
- Patient Details shows both account-created and last-updated timestamps
- Active and Completed pages show when browser data was last refreshed
- CSV exports include account-created and last-updated timestamps
- Patient Details and Completed Details include **Print Summary**
- The printable summary includes the account overview, financial totals, installment schedule, payment ledger, adjustments, collection outcomes, document index, finance note, and activity timeline

### Payment Board (`index.html`)

- Responsive color-coded active work queue without page-level horizontal scrolling
- Automatic financial statuses rather than a manually selected status
- Renamed statuses, including **Upcoming Collection** and **Plan On Schedule**
- Secondary alerts for partially paid balances and payment plans that are due, in a grace period, or overdue
- Clickable status badges that open the patient activity timeline
- Daily operations dashboard with quick filters for:
  - due today
  - overdue
  - payment plans needing action
  - partially paid balances overdue
  - payments collected today
  - collection outcomes recorded today
  - follow-ups due
- Search, multi-field filtering, column sorting, and saved work-queue views
- Current-filter CSV export
- Compact row actions: **Pay**, **Outcome**, **Docs**, and **View Details**

### Activity timeline

Every patient can show a chronological history of:

- account creation and edits
- payments
- reversals, refunds, and payment corrections
- financial adjustments
- payment-plan changes
- collection outcomes and follow-ups
- document additions and deletions
- completion and restoration activity

Click a status badge to jump directly to the timeline. Click the patient name or **View Details** to open the complete patient record, including outcomes, the ledger, adjustments, documents, and activity history.

### Financial ledger and corrections

- Record payment transactions
- Reverse all or part of a payment
- Refund all or part of a payment
- Correct a payment by creating a reversal and a replacement transaction
- Preserve the original transaction rather than silently overwriting it
- Record adjustments, write-offs, financial assistance, and insurance reallocations
- Automatically calculate net collected and amount still owed

### Payment-plan controls

- Build 2-24 installments
- Generate weekly, biweekly, monthly, or quarterly due dates
- Edit individual dates and amounts
- Add a 0-30 day grace period
- Add a promise-to-pay date
- Shift all unpaid installment dates
- Skip/defer an installment with a required reason
- Rebalance all installments
- Redistribute the remaining amount over unpaid installments
- Lock completed installments
- Require a reason when an existing plan is changed
- Track plan renegotiations, repeated misses, days late, plan progress, and on-time performance

### Collection outcomes

Use **Outcome** to record:

- Patient Declined
- Patient Unable to Pay
- Card Declined
- Patient Disputed Balance
- Payment Plan Requested
- Sent to Finance
- Patient Not Present
- Follow-up Required
- Promise to Pay
- Other

An outcome can include an outcome date, location, follow-up date, promise-to-pay date, and note.

### Validation

The prototype includes checks for:

- duplicate MRNs
- negative or excessive payments
- excessive adjustments
- missing required reasons
- invalid installment totals
- skipped installments without a reason
- installment amounts lower than amounts already paid
- implausible operational dates
- responsibility changes on accounts that already have payment history
- completing an account while a balance remains

### Saved views

Named filter/sort views can be saved separately on:

- Payment Board
- Statistical Analysis
- Completed Patients

Saved views remain in the current browser only.

### Statistical Analysis (`analytics.html`)

Includes:

- responsibility, collected, outstanding, collection-rate, participation, average, and median metrics
- payment-plan on-time rate and plans needing attention
- adjustments, collection outcomes, and follow-ups due
- monthly collections
- outstanding balance by status
- collection rate by location
- payment-method distribution
- detailed payment-plan performance
- sortable grouped breakdowns
- operational highlights
- saved analysis views and current-analysis CSV export

### Completed Patients (`completed.html`)

- Separate archive page
- Search and filters by completion date, treatment site, physician, treatment, and completion type
- Sorting by completion day, patient, site, treatment, physician, collected amount, or days to complete
- Completed-account details, ledger, adjustments, outcomes, plan performance, and activity timeline
- Document access and restore-to-active workflow
- Saved archive views and current-view CSV export

### Documents

- Attach multiple fictional PDF, Word, Excel, CSV, text, and image files
- Open, download, or delete an attachment
- Maximum 10 MB per file and 20 files per patient
- Files remain only in the current browser and are not uploaded to GitHub

## Website files

```text
index.html       Active Payment Board
analytics.html   Statistical Analysis
completed.html   Completed Patient Archive
styles.css       Shared responsive design
data.js          Fictional records, migration, ledger, statuses, and plan engine
documents.js     Browser-local prototype attachment manager
board.js         Payment Board and workflow behavior
analytics.js     Statistical Analysis behavior
completed.js     Completed Patients behavior
README.md        Setup and usage instructions
.nojekyll        Tells GitHub Pages to serve the files directly
.gitignore       Common files excluded from Git
```

Keep all files directly in the repository root next to `index.html`.

## Publish the update from Codespaces

1. Download and extract the Version 4.2 ZIP.
2. In Codespaces, drag all files from inside the extracted folder into `/workspaces/Ackerman`.
3. Approve replacement of the earlier files.
4. Confirm that `index.html`, `analytics.html`, and `completed.html` are directly under `Ackerman`, not inside another folder.
5. Run:

```bash
git status
git add .
git commit -m "Add timestamps, printable summaries, and streamlined navigation"
git push origin main
```

GitHub Pages should rebuild automatically. Allow several minutes, then hard-refresh with `Ctrl+Shift+R`.

Expected pages:

```text
https://jocwhite538.github.io/Ackerman/
https://jocwhite538.github.io/Ackerman/analytics.html
https://jocwhite538.github.io/Ackerman/completed.html
```

## Test locally in Codespaces

From the repository terminal:

```bash
python3 -m http.server 8000
```

Open port `8000` from the **Ports** tab. Stop the server with `Ctrl+C`.

## Existing browser data

Version 4.2 attempts to migrate Version 4, Version 3, Version 2, and Version 1 prototype records. The user-facing Reset Demo control has been removed. To clear fictional browser data manually, use the browser site-data controls only after confirming that no prototype work needs to be retained.

## Production architecture still required

To make finance and front-office users see the same records, the future production version needs:

```text
Browser interface
      +
Server/API
      +
Central database
      +
Shared document storage
```

The Version 4.2 interface is structured so those browser-storage functions can later be replaced with server API calls while preserving most of the visible workflow.

## Data-use restriction

GitHub Pages is public. Use only fictional test patients, fictional MRNs, fictional documents, and fictional financial information. Do not enter or attach real patient, insurance, treatment, billing, or payment information.
