# Student Planner

A Google-Calendar-style school planner PWA for desktop, mobile and a desk-side mini monitor — built for Gymnasium Oberwil / schulNetz (portal.sbl.ch), in Material 3 Expressive with a touch of liquid glass.

## Features

- **Calendar** — Day / Week / Month / Agenda views, swipe navigation on touch, Google-Calendar keyboard shortcuts (`T` today, `D` `W` `M` `A` views, `←` `→` navigate, `C` create), mini-month, now-line, double-click to create events.
- **School timetable import** — paste the Centerboard iCal link from portal.sbl.ch. Course codes like `E-2e-FiB` are recognised automatically: subject, class and teacher are extracted, and variants are merged (`EH` Halbklasse → Englisch, `CP` Praktikum → Chemie, `GL` → Geografie, `INH` → Informatik). Tests (`Prüfung …`, `Test …`) are detected and shown in *Upcoming*.
- **Microsoft / other calendars** — Outlook, Teams, Google or Apple via their ICS link, or a one-off `.ics` file. Recurring events and time zones are handled.
- **Subject pages** — grades with weights, weighted average, Swiss report-card rounding ("Zeugnis"), grade history chart, a *what do I need* calculator with a what-if table, upcoming tests & homework, and the weekly schedule derived from the timetable.
- **Colours** — pick a colour per subject in the calendar sidebar (or the palette button on mobile); every surface uses harmonised Material tones of it. Grades get their own continuous colour scale (red < 4, amber at 4, green towards 6).
- **Grades import from schulNetz** — paste the Noten page, or use the bookmarklet on *Settings → Import grades*. Duplicates are skipped.
- **Home** — live "now / next" lesson with wavy progress, today's lessons, upcoming tests & tasks, overall average and plus points.
- **Desk mode** (`/desk`) — glanceable full-screen dashboard for a small monitor: big clock, current lesson with countdown ring, next lesson, upcoming tests, a timeline of the day. Adapts to 16:9, ultra-wide bar displays (e.g. 1920×480) and portrait screens; keeps the screen awake; OLED burn-in drift.
- **PWA** — installable, works offline, data stored locally in IndexedDB. Backup / restore as JSON.

## Deploy (GitHub → Vercel)

1. Import this repo in Vercel (`Add New → Project`). Framework is detected as **Vite**; no settings needed.
2. Deploy. `api/ical.ts` becomes a serverless function that fetches calendar feeds server-side (portal.sbl.ch and Outlook don't allow browsers to fetch them directly).
3. Open the site → paste your iCal link → **Add & sync**. Install it via the browser's install button.

Your iCal link contains a personal token — it is only stored in your browser, never in this repo.

## Getting the calendar links

- **School (schulNetz):** the iCal subscription link from portal.sbl.ch (the `cindex.php?longurl=…` link).
- **Outlook / Microsoft 365:** Outlook on the web → Settings → Calendar → Shared calendars → *Publish a calendar* → choose the calendar, "Can view all details" → copy the **ICS** link.
- **Google:** Calendar settings → *Secret address in iCal format*.

## Desk mode on the mini monitor

Open `/desk` in a browser window on the small screen (Settings → Desk mode → *Open in new window*), then press the full-screen button. Installed as an app, the shortcut menu also offers "Desk mode".

## Development

```bash
npm install
npm run dev        # http://localhost:5173 (the /api/ical function runs locally too)
npm run build      # type-check + production build to dist/
node scripts/gen-icons.mjs   # regenerate the Material Symbols subset after adding icon names
```

Stack: React 19, TypeScript, Vite, motion, zustand + IndexedDB, ical.js, Material Color Utilities (2025 / M3 Expressive spec), Roboto Flex, Material Symbols Rounded.
