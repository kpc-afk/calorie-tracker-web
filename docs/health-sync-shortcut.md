# Apple Health → Calorie Tracker sync (iOS Shortcut)

Syncs today's steps, active energy, and latest weight from Apple Health into
the app via `POST /api/health-sync`, once a day, with no manual entry.

## 1. Create the shortcut

1. Open **Shortcuts** → **+** → name it **Sync Health**.
2. Add **Find Health Samples Where** → Type: **Steps**, Date: **Today**,
   Sort: none → set **Limit** to all results.
3. Add **Calculate Statistics** → Operation: **Sum**, on the result of step 2
   → set the output variable name to `Steps`.
4. Repeat steps 2–3 for **Active Energy**:
   - Find Health Samples Where → Type: Active Energy, Date: Today
   - Calculate Statistics → Sum → save as `Energy`
5. Repeat for **Weight**:
   - Find Health Samples Where → Type: Weight, Date: Today (or "Last 7 Days"
     if you don't weigh in daily), Sort: **Newest First**, Limit: **1**
   - Calculate Statistics → **Minimum** (or just take the single sample's
     value) → save as `Weight`

## 2. Build the request body

6. Add a **Dictionary** action with three entries (type **Number** for each
   value):
   - `steps` = `Steps`
   - `active_energy_kcal` = `Energy`
   - `weight_kg` = `Weight`

## 3. Send the request

7. Add **Get Contents of URL**:
   - URL: `https://<your-vercel-url>/api/health-sync`
   - Method: **POST**
   - Headers: `Authorization` = `Bearer <HEALTH_SYNC_SECRET>`
   - Request Body: **JSON** → the Dictionary from step 6

A successful sync returns `{"ok":true,"date":"YYYY-MM-DD","applied":{...}}`.
A wrong/missing token returns `401 {"error":"unauthorized"}`.

## 4. Automate it

8. In Shortcuts → **Automation** → **+** → **Time of Day** → set a daily time
   (e.g. 21:30) → **Run Immediately** (so it doesn't prompt) → choose
   **Sync Health**.

## Notes

- The first run prompts for Health read permissions — allow **Steps**,
  **Active Energy**, and **Weight**.
- `steps` updates `daily_activity.steps_count` and recomputes
  `steps_calories`. `active_energy_kcal` is converted to `workout_calories`
  by subtracting the steps-derived calories (so walking isn't double-counted
  against a workout). `weight_kg` upserts today's `weight_entries` row.
- All fields are optional — send only what you have. Omit `date` to default
  to today (Europe/London).
- Chat-based workout logging (description or Apple Health screenshot) remains
  the way to log individual workouts with notes; this sync only covers the
  daily steps/active-energy/weight totals.
