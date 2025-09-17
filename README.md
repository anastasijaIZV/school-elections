# school election system to manage paper ballots

# Paper-Ballot School Elections – Tally & Live Results

A tiny Node.js app for **manual paper vote counting** with a clean **admin tally** tool and a **public results** page (bar charts + table).

- **Admin (private):** `/tally.html` — add/remove votes with big buttons or keyboard, **Import CSV**, or **Sync** from a CSV file on disk.
- **Results (public):** `/results.html` — compact cards with colored charts; click **Refresh** to update.
- **Storage:** SQLite (file at `data/elections.db`).

---

## Features
- Positions (President, Vice President, and ministries) with candidates (name + class).
- **+ / −** tally buttons and **keyboard shortcuts** (`+` and `-` after selecting a candidate).
- **CSV import (upload)** each time + **Sync** from `data/candidates.csv`.
- **Merge** (add, keep existing) or **Replace** (mirror CSV exactly) modes.
- Public **live results** page with multi-color bar charts (Chart.js).
- Safe for **multiple admins at once** (SQLite WAL + atomic updates).
- Grouped admin layout: **one row per position**, all its candidates on the same line.

---

## Tech Stack
- **Backend:** Node.js + Express + SQLite (`sqlite3`)
- **Frontend:** HTML, CSS, vanilla JS + Chart.js

---

## Quick Start

```bash
# 1) Install deps
npm install

# 2) Configure env (create .env in project root) — change the password!
echo "ADMIN_PASS=change-me
PORT=3000" > .env

# 3) Run
node server.js
# Tally:   http://localhost:3000/tally.html
# Results: http://localhost:3000/results.html
```

---

## Positions (ministries)

Default seeded keys/titles (edit in `server.js` → inside `init()`):

- president       → "Prezidents"
- vice_president  → "Vice Prezidents"
- min_tech        → "Tehnikas ministrs"
- min_media       → "Mēdiju ministrs"
- min_art         → "Mākslas ministrs"
- min_culture     → "Kultūras ministrs"
- min_internal    → "Iekšlietu ministrs"

If you change these and want a clean DB:
```bash
rm -f data/elections.db
node server.js
```
> Important: Candidate CSV rows must use one of the position keys above.

---
## CSV: add participants
Two ways:

**A) Upload a CSV (UI)**
 On **/tally.html**: choose a file → pick **Merge** or **Replace** → **Import CSV**.
**B) Sync from a file on disk**
Place `data/candidates.csv` in the project, then click **Sync candidates** on **/tally.html**.
**CSV format** (no header, one per line):

```
name,class,position_key
```
Example:
```
Alice,10A,president
Bob,11B,vice_president
Eva,10C,min_tech
Karlis,12A,min_media
Ilze,10B,min_art
Oto,11C,min_culture
Raitis,12C,min_internal
```
**Modes**
- **Merge** – add new candidates; keep existing (their vote totals stay).
- **Replace** – database becomes exactly the CSV; anyone not in the CSV is removed (and their tallies deleted). Use before counting.
**Duplicates**
A unique index prevents exact duplicates: `(position_key, name, class)`.

---

## Admin tally (keyboard & layout)

1. Click a candidate once to focus.
2. Press `+` to add a vote, `-` to subtract.
3. Use Reset per position, or **Reset All** to zero all tallies.
4. Admin table shows one **row per position** with all its candidates horizontally.

---

## Concurrency (multiple admins)
The app is safe with several admins tallying simultaneously.
In `server.js`, `init()` enables:
```
PRAGMA journal_mode = WAL;    -- many readers, one writer
PRAGMA synchronous = NORMAL;  -- good balance with WAL
PRAGMA busy_timeout = 3000;   -- wait briefly if locked
```
`UPDATE` operations are atomic; clicks from different admins won’t lose counts.

---
## Deploy / Share (originally for ngrok)
Run locally, then tunnel:
```
node server.js               # localhost:xxxx gives port number
ngrok http xxxx              # imput the port number and it yields a public https URL
```
Share:
- Public results: `https://<ngrok-id>.ngrok-free.app/results.html`
- Admin tally (private): `https://<ngrok-id>.ngrok-free.app/tally.html` + your admin password

> On other hosts: ensure you either deploy `data/candidates.csv` (for **Sync**) or use ` after deploy to load participants.

---
## Environment

Create `.env` in the project root:
```
ADMIN_PASS=change-me
PORT=3000
```
> Important: Change the password before sharing the admin URL.

---
## Troubleshooting
- **Charts show but no names** → Candidates not imported on that server. Upload/Import a CSV or Sync from `data/candidates.csv`.
- **FOREIGN KEY** constraint failed → A CSV row uses an unknown `position_key`. Check keys in `server.js` or the DB.
- **401 Unauthorized** → Admin password in the page doesn’t match `.env`. Set `ADMIN_PASS` and restart.
- **Port in use** → Change `PORT` in `.env` or stop the other process.
- **Hosted site empty** → Deployed server didn’t get the CSV. Use **Import CSV** on **/tally.html** or deploy `data/candidates.csv` and click **Sync**.





















