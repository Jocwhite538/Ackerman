# Ackerman Patient Payment Board - Fictional Prototype

This folder contains a single-file, clickable HTML prototype. All included patient names and MRNs are fictional.

## What you need

- A web browser such as Chrome or Edge
- Spyder, Notepad, Visual Studio Code, or another text editor
- Anaconda/Python only if you want to serve the file from a local web address
- Optional: Git and GitHub Desktop for placing the source code in a private repository

No Python packages are required for this draft.

## Fastest way to open it

Double-click `index.html`.

The interface will open in your default browser. Changes are stored in that browser only.

## Run it through Anaconda/Python

Open **Anaconda Prompt**, change to this folder, and run:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Stop the server with `Ctrl+C` in Anaconda Prompt.

## Important limitation

This version uses browser `localStorage`. It is useful for reviewing the layout and workflow, but it is not a shared database:

- Different computers will not see the same entries.
- Clearing browser data removes that computer's changes.
- It is not suitable for real patient information.

A shared internal version needs a server-side application and central database.

## GitHub

Use GitHub as a source-code repository, preferably a private organization repository. Do not commit exported patient CSV files, databases, screenshots containing patient information, or real patient records.

Suggested repository contents:

```text
ackerman-payment-prototype/
  index.html
  README.md
```

GitHub Pages can display this static prototype, but it should contain fictional data only. The production patient-payment application should be hosted inside an approved internal environment rather than as an anonymous Pages site.

## About payments.ackerman.local

`payments.ackerman.local` cannot be created merely by naming the GitHub repository. It requires name resolution and a web server on Ackerman's network. The internal IT team would need to:

1. Choose an internal server.
2. Point the internal hostname to that server.
3. configure HTTPS and a certificate trusted by Ackerman workstations.
4. Deploy the application and its database to the server.

The `.local` suffix can conflict with multicast DNS on some systems. A hostname under an organization-owned domain is often more reliable, subject to IT approval.

## Prototype functions

- Fictional patient names and MRNs
- Add and edit patients
- Search by name or MRN
- Filter by status and site
- Sort by date, patient, MRN, or amount owed
- Color-coded rows
- Record a payment with today's date and site location
- Automatic remaining-balance calculation
- Complete and restore records
- Export fictional data to CSV
- Browser-only persistence
