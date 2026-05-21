# Study Schedule Tracker

A **mobile-style** web app (light UI, two bottom tabs) to plan about **10 hours** of study per day, split into blocks (up to **2 hours** each). **Dashboard** shows progress, schedule with clock times, weekly consistency, streak, and reminders. **Check-in** lists every block with Completed / Pending badges. **Manage courses & start time** lives in a collapsible section on the dashboard (no extra tab). Data stays in the browser (**localStorage**); old `studyPlan.v1` data is migrated automatically to `studyPlan.v2`.

## Run on localhost

From this folder, use **one** of these:

### Python (often already installed)

**Windows PowerShell:**

```powershell
Set-Location "c:\Users\Noor\Downloads\Regular_Study_Plan"
python -m http.server 8080
```

**macOS / Linux / Git Bash:**

```bash
cd "c:\Users\Noor\Downloads\Regular_Study_Plan"
python -m http.server 8080
```

Then open: **http://localhost:8080**

### Node.js (if you have npm)

```bash
cd "c:\Users\Noor\Downloads\Regular_Study_Plan"
npx --yes serve -l 8080
```

Then open the URL it prints (usually **http://localhost:8080**).

## Tips

- Open **Manage courses & start time** on the dashboard to rename subjects, set minutes, mark **compulsory**, and choose when the day starts (times stack from there).
- The default course list is already about **10 hours**; the banner warns if you are under **600 minutes**.
- Use the **calendar** in the header to pick another day; streak and weekly bars use the last 7 days ending on that date.
- **Check-in** tab: use checkboxes or tap **Study** on the dashboard — both update the same progress.
- **Clear day** only clears ticks for the selected date.

## Files

- `index.html` — page structure  
- `styles.css` — layout and theme  
- `app.js` — logic and storage  

No install step is required beyond a local static server (browsers handle `file://` inconsistently for some features; localhost is recommended).

## Deploy on Vercel (from a Git repo)

This project is **static** (`index.html`, `styles.css`, `app.js`). No build step is required.

1. Push this folder to a GitHub (or GitLab / Bitbucket) repository.
2. In [Vercel](https://vercel.com): **Add New… → Project** → import that repo.
3. Use defaults:
   - **Framework Preset:** Other (or “No framework”)
   - **Root Directory:** `./` (repository root)
   - **Build Command:** leave empty
   - **Output Directory:** leave empty (Vercel serves files from the repo root)
4. Click **Deploy**. Your app will be live at `https://<project>.vercel.app`.

Optional: install the [Vercel CLI](https://vercel.com/docs/cli) and run `vercel` from this folder to link and deploy without the dashboard.

**Note:** Data still lives in **each user’s browser** (localStorage), not on Vercel’s servers — same as on localhost.
