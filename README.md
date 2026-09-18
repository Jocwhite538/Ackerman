# Ackerman Patient Payment Board - Version 2 Prototype

This is a static, clickable GitHub Pages prototype for the Ackerman patient-payment workflow. It uses fictional patient names, fictional `DEMO-` MRNs, and fictional financial information only.

## Important: what GitHub Pages does and does not do

Publishing this folder with GitHub Pages makes the interface available through a link. It does **not** create a shared patient database.

The prototype currently stores:

- patient, payment, adjustment, activity, payment-plan, and saved-view data in the current browser's `localStorage`
- attached test documents in the current browser's IndexedDB

An entry made on one computer is therefore not visible on another computer. A shared multi-office version still requires a server/API, central database, authentication/authorization, and shared document storage.

Do not use real patient information on the public GitHub Pages prototype.


## Version 5.7 follow-up changes

### Collapsible analytics plan table

The **Payment Plan Performance** section on Statistical Analysis is now collapsed by default. A clear arrow/Show control expands the table when Finance wants patient-level detail and collapses it again when the page needs to stay compact.

### More readable active work queue

- Increased the active-board status, treatment, treatment-site, insurance, date, and supporting text sizes slightly for easier front-desk scanning.
- Overdue rows now show the exact **Past due** dollar amount directly under the overdue-payment count.
- Due-today rows show the exact **Due today** dollar amount in the same area.
- The four row actions are visually organized as **Pay / Docs / View Details / Complete**. Pay remains visible but disabled when there is no Ackerman-responsible balance to collect, keeping the action layout consistent across patients.


## Version 5.2 follow-up changes

### Safer Add/Edit Patient dialog

The Add/Edit Patient window no longer closes when the user clicks the shaded area outside the dialog or presses Escape. The top-right X was removed from this dialog so unfinished patient or payment-plan work is not lost accidentally. The dialog closes only with **Cancel** or after a successful **Save Patient**. Other dialogs keep their normal close behavior.

### Simplified active-board status

The active Payment Board keeps simple operational row statuses such as **Overdue**, **Due Today**, **Upcoming Collection**, **Paid in Full**, and **No Responsibility**. The Status filter includes a combined **Overdue and Due Today** option that intentionally uses OR logic, so it returns every patient who is either overdue or due today. It also includes **UF Checks Due** and **Payment Plans** views. The existing red/yellow/green Ackerman-overdue color logic and separate **Check UF** flag remain in place.


## Version 5.5.1 follow-up changes

### Combined overdue / due-today filter

The active-board **Overdue and Due Today** filter is now a combined work list, not a logical-AND state. Selecting it returns every active patient who is either overdue **or** due today. Individual patient rows still show their actual timing status as **Overdue** or **Due Today**.

### Payment plans are now the only collection arrangement

The Add/Edit Patient form now offers only:

- **Payment Plan**
- **No Payment Responsibility**

A single scheduled payment is still a Payment Plan. Legacy Standard Collection accounts are automatically treated as one-payment plans when loaded.

### Payment Plans status filter

The active-board Status filter now includes **Payment Plans** so Finance can isolate every active account using the payment-plan workflow.

### Completed Excel payment history

The Completed Patients **Export Current View Excel** appends chronological payment-history columns to the end of each row:

- Payment 1 Date
- Payment 1 Amount
- Payment 2 Date
- Payment 2 Amount
- and so on, up to the largest payment count in the exported view.

Refunds/reversals export as negative payment amounts so the payment record remains financially interpretable.

## Version 5.0 workflow changes

Version 5.0 simplifies the front-office workflow and changes payment-plan responsibility tracking.

### Physician removed

Physician has been removed from:

- Add/Edit Patient
- active and completed tables
- search/filter controls
- sorting
- analytics filters/grouping
- Excel/CSV exports as applicable
- printable account summaries

Older Version 4 records migrate without the physician field.

### Treatment types

Treatment type is now limited to:

- Proton
- Radiation (Linac/HDR/Other)
- Imaging
- Clinic
- Women's Imaging

Older values migrate automatically where possible:

- `Proton Therapy` -> `Proton`
- `Radiation Therapy` -> `Radiation (Linac/HDR/Other)`
- `Consultation` -> `Clinic`

### Direct Complete action

The active patient row now includes:

- Pay
- Docs
- View Details
- Complete

**Complete** archives the account when its balance is satisfied or when the account is legitimately marked No Responsibility.

### Collection Outcome workflow removed

The former Outcome button, outcome dialog, outcome timeline section, follow-up workflow, and outcome-based analytics were removed.

The daily operations area now includes **UF Checks Due** instead.

### Red / yellow / green payment status

Payment-plan colors no longer use purple.

For Ackerman-responsible payment-plan installments:

- **Red** = 2 or more payments overdue
- **Yellow** = exactly 1 payment overdue
- **Green** = no Ackerman-responsible payments overdue

A standard non-plan overdue balance is treated as one overdue obligation and displays yellow. Paid, current, upcoming, and No Responsibility accounts display green.

The underlying account arrangement can still be Payment Plan, but the visible plan status color reflects the overdue count.

### Quick status/action note

Every active patient has a small editable text box directly under Status.

Examples:

- `Call patient`
- `Waiting on card`
- `Check with UF`
- `Patient coming Friday`

The note is saved to the patient record, appears in Patient Details, is retained in the Completed archive, and is included in exported workbooks/reports.

### Manual payment-plan editor

The payment-plan editor was simplified.

Removed:

- grace period
- Rebalance All
- Redistribute Unpaid
- Skip / Defer
- required plan-change reason

The **Build / Generate Payment Schedule** button is now more prominent.

The generated schedule is only a starting point. Staff can manually change each payment's:

- due date
- amount
- responsibility assignment

The schedule total is shown against the account's reference target, but a difference no longer blocks saving. This is intentionally more manual than Version 4.

### Ackerman vs UF responsibility

Each payment-plan row now requires one responsibility assignment:

- **Ackerman responsible**
- **UF responsible**

Exactly one is selected for every scheduled payment.

Ackerman-responsible installments drive the red/yellow/green overdue status.

### UF payment verification

A UF-responsible installment includes a **UF payment checked / went through** checkbox.

When a UF-responsible payment is past its due date and has not been checked:

- the schedule row displays a **UF check due** flag
- the patient displays a UF check badge
- the daily operations dashboard includes the patient under **UF Checks Due**
- analytics counts the outstanding UF verification checks

UF verification does not increase Ackerman collected dollars, but a verified UF-responsible amount is treated as satisfied when calculating what is still outstanding on the account.


### Version 5.1 workflow refinements

- New patients now default to **Payment Plan**
- A payment plan can contain a single payment
- The active board shows **Total responsible**, **Ackerman owes**, **UF owes**, **Total outstanding**, and **% still remaining** for payment-plan accounts
- Patient Details shows the same responsibility split plus overall plan progress
- UF-responsible rows can be checked directly from Patient Details after Finance confirms the payment went through
- Patients with overdue UF verification show a clickable **⚑ Check UF** flag on the active board that opens the payment-plan section
- Verified UF responsibility reduces the amount still outstanding without being counted as Ackerman collected dollars
- Ackerman payment entry is limited to the remaining Ackerman-responsible amount on a plan


## Version 5.3 follow-up changes

- **UF Checks Due** is now an option in the active-board Status filter so Finance can isolate every patient needing UF verification.
- The blue **⚑ Check UF** flag appears only after a UF-responsible installment's due date has passed; it does not appear on the due date itself.
- UF verification remains a neutral blue flag and does not turn the patient red.
- Every overdue account now shows the exact number of overdue Ackerman-responsible payments directly under the main status.
- **Complete** can archive an account even when a balance remains, supporting situations such as canceled treatment or other reasons an account must leave the active board.
- Completed accounts retain their outstanding balance and can still be restored from Completed Patients.
- Two fictional demo patients were added with overdue UF-responsible payments so the **Check UF** workflow is visible during testing.

## Payment Board (`index.html`)

The Payment Board is the active work queue.

It includes:

- active patient count
- amount outstanding
- collection rate
- active payment-plan count
- daily operational quick filters
- search and filtering
- sorting
- saved views
- formatted Excel export
- direct patient status/action notes
- Pay, Docs, View Details, and Complete row actions

### Today's Operations

Quick-filter cards include:

- Due Today
- Overdue
- Plan Installments Due
- Partial Balances Overdue
- Collected Today
- UF Checks Due

## Financial ledger and corrections

The prototype can:

- record payments
- reverse all or part of a payment
- refund all or part of a payment
- correct a payment with reversal/replacement transactions
- preserve the original transaction
- record adjustments, write-offs, financial assistance, and insurance reallocations
- calculate net collected and amount still owed

## Payment-plan controls

Version 5 supports:

- 1-24 scheduled payments (a one-payment account is still treated as a payment plan)
- weekly, biweekly, monthly, or quarterly schedule generation
- manual due-date changes
- manual amount changes
- Ackerman/UF responsibility assignment per payment
- UF verification tracking
- promise-to-pay date
- shifting open payment dates
- plan progress
- Ackerman on-time performance
- overdue payment count
- UF checks due
- payment-plan edit history

Payments recorded in the Payment Board are allocated to Ackerman-responsible plan installments in order.

## Validation

The prototype still checks for core data integrity problems such as:

- duplicate MRNs
- invalid or excessive payments
- excessive adjustments
- required No Responsibility reason
- payment plans with fewer than one valid row
- missing payment-plan responsibility assignment
- invalid operational dates
- completing an account while an actual balance remains

The Version 4 schedule-total balancing rule was intentionally removed so due dates and amounts can be managed manually.

## Statistical Analysis (`analytics.html`)

The analysis page includes:

- patient responsibility
- total collected
- amount outstanding
- dollar collection rate
- patients paying
- paid-in-full rate
- average and median payment
- Ackerman payment-plan on-time rate
- plans needing attention
- adjustments
- critical patients with 2+ Ackerman payments overdue
- UF checks due
- monthly collections
- outstanding balance by status
- collection rate by location
- payment-method distribution
- payment-plan performance
- sortable grouped breakdowns
- operational highlights
- saved analysis views
- CSV export

## Completed Patients (`completed.html`)

The Completed archive includes:

- search
- completion-date filtering
- treatment-site filtering
- treatment-type filtering
- completion-type filtering
- sorting
- account details
- payment ledger
- adjustments
- payment-plan history
- Ackerman/UF responsibility history
- UF verification state
- activity timeline
- attached documents
- restore-to-active workflow
- saved archive views
- formatted Excel export

## Documents

The prototype can attach fictional test files including:

- PDF
- Word
- Excel
- CSV
- text
- PNG/JPG/WebP images

Limits:

- 10 MB per file
- 20 files per patient

Files stay only in the current browser's IndexedDB and are not uploaded to GitHub.

## Website files

```text
index.html              Active Payment Board
analytics.html          Statistical Analysis
completed.html          Completed Patient Archive
styles.css              Shared responsive design
data.js                 Records, migration, ledger, statuses, and plan engine
documents.js            Browser-local prototype attachment manager
excel-export.js         Styled Excel .xlsx export helper
board.js                Payment Board workflow behavior
analytics.js            Statistical Analysis behavior
completed.js            Completed Patients behavior
VERSION_5_CHANGELOG.md  Version 5 implementation notes for the release email
README.md               Setup and usage instructions
.nojekyll               Tells GitHub Pages to serve files directly
.gitignore              Common files excluded from Git
```

Keep all files directly in the repository root next to `index.html`.

## Publish the update

Replace the current repository-root files with the Version 5 files, then run:

```bash
git status
git add .
git commit -m "Version 5 payment workflow and UF responsibility tracking"
git push origin main
```

GitHub Pages should rebuild automatically. Allow several minutes, then hard-refresh with `Ctrl+Shift+R`.

Expected pages:

```text
https://jocwhite538.github.io/Ackerman/
https://jocwhite538.github.io/Ackerman/analytics.html
https://jocwhite538.github.io/Ackerman/completed.html
```

## Test locally

From the repository terminal:

```bash
python3 -m http.server 8000
```

Open port `8000` from the Codespaces **Ports** tab. Stop the server with `Ctrl+C`.

## Existing browser data

Version 5 uses a new browser-storage key and attempts to migrate Version 4, Version 3, Version 2, and Version 1 prototype records.

During Version 4 -> Version 5 migration:

- physician is discarded
- old collection outcomes are discarded from the active data model
- old treatment names are mapped to the Version 5 treatment list
- existing payment-plan rows default to Ackerman responsibility
- old grace-period and skip/defer fields are no longer used

Version 4 saved views are copied forward where possible; removed physician settings are ignored.

## Production architecture still required

A real shared version requires:

```text
Browser interface
      +
Authenticated server/API
      +
Central database
      +
Shared document storage
      +
Audit/security controls
```

The prototype should remain fictional-data-only until an approved production architecture is in place.

## Data-use restriction

GitHub Pages is public. Use only fictional test patients, fictional MRNs, fictional documents, and fictional financial information. Do not enter or attach real patient, insurance, treatment, billing, payment, or other protected health information.


## Version 5.5.1 export and site updates

- Active and Completed current-view exports now download formatted Excel `.xlsx` workbooks rather than plain CSV files.
- Exported workbooks include branded headers, status colors, UF-check highlighting, filters, frozen headings, and formatted financial/date fields.
- Status filtering includes Overdue, Due Today, and a combined Overdue and Due Today option.
- Treatment sites are Jacksonville, Amelia Island, St. Augustine, Urology World Golf Village, and Urology Middleburg. Orange Park is no longer used.

## Version 5.6 workflow refinements

### Completion reasons

Completing a patient now opens a required completion dialog. Staff select a reason such as treatment completed, patient cancelled treatment, patient deceased, transfer/referral, administrative closure, or Other. An optional completion note can be added, and Other requires a note. The completion reason is retained in Completed Patients, printable summaries, activity history, and the Completed Patients Excel export. Outstanding balances are preserved when a patient is completed.

### Better UF verification queue

- **Check UF** continues to appear only after a UF-responsible installment due date has passed.
- The active-board UF flag now shows the age of the oldest pending UF verification in days.
- The Today’s Operations UF card shows the oldest pending UF check age.
- Added **UF check: oldest first** and **UF check: newest first** sorting. Selecting **UF Checks Due** automatically sorts oldest first.
- View Details shows the age of each overdue UF verification.
- Active Excel export now includes **Oldest UF Check Days**.

### Simpler View Details

The top financial snapshot was reduced to the six most useful values: total responsibility, Ackerman outstanding, UF outstanding, total outstanding, percent complete, and percent remaining. Payment Plan Performance now focuses on operational exceptions: Ackerman overdue, due today, UF checks due, and Ackerman on-time rate.

### Simpler payment-plan editor

Removed the Promise-to-Pay and Shift Unpaid Dates controls. The plan editor now focuses on payment count, first due date, date generation, manual dates/amounts, and Ackerman-versus-UF responsibility.

### Readability

The active Payment Board received a modest desktop font-size increase for patient, financial, due-date, status, and plan-progress text. The change is intentionally small so the work queue remains compact while being easier to scan.
