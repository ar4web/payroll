# Payroll Pro — Saudi Staffing Payroll Calculator (SAR)

A single-file, offline-first payroll calculator for staffing companies in Saudi Arabia.
25 client timesheets in, one verified payroll out — **no server, no install**.

## Run locally (double-click)
1. Download `index.html`.
2. Double-click it — it opens in your browser via `file://` and fully works.
3. Your master, timesheets, mappings, highlights and templates are saved in **localStorage** on that device.

## Deploy to GitHub Pages
1. Create a repository and add `index.html` (and this `README.md`) to the root.
2. Repo → **Settings → Pages → Build and deployment → Deploy from a branch**.
3. Pick branch `main`, folder `/ (root)`, Save.
4. Open `https://<your-user>.github.io/<repo>/`.

## Offline behaviour
- SheetJS and Chart.js load from CDN and are cached by the browser after the first online visit.
- If they are unavailable, the app automatically falls back to **built-in canvas charts** and **CSV export** (Excel opens CSV directly). Reading `.xlsx` requires SheetJS — open the app online once, or use `.csv` files.

## Monthly workflow
1. **⬇ Employee Template.xlsx** → fill the 15 columns → **Load Employee Master**.
2. **Load Timesheets** → select all 25 site files at once. First time per site: map ID / Name / Day columns and set rules (normal hours, OT rate/hr, OT rate/off-day, count type hours/days/both, absence rule, penalty, pay-period start 1/21/25/26, days in month). Mappings are remembered per site.
3. Fix issues in the **Upload check** dialog (duplicate IDs, unknown employees, >24 h cells, unreadable values) — or continue and keep them flagged.
4. Review the **Dashboard**: KPI cards with mini-charts, pay-by-site bar, OT-vs-deductions doughnut, and the expandable **flagged-employees panel**.
5. Verify in **Day Grid**: paint red (problem), yellow (review), green (verified), blue (OT), black (absent), add notes, bulk-verify or flag whole rows, filter flagged/unverified. Highlights persist per site + month and are included in exports.
6. **Payroll Results**: filter by site, search name/ID, sort any column, toggle columns, “Only flagged”. Flagged rows are always tinted and carry a Red Flag column.
7. **Export**: `Summary.xlsx`, `Day Detail.xlsx`, your custom named templates (column order, header text, total row, signature line), or clean Print/PDF.

## Cell inspector & draggable panels
- **Day Grid** defaults to the **Inspect** tool: click any day cell to open the floating **Cell Inspector**. Right-click or Alt-click works from any brush; double-click also opens it.
- In the inspector you can edit the recorded value, use quick-set buttons (normal / OT / absent / off / blank), see the calculated pay impact for that cell, choose a highlight colour, write a note, verify or flag the whole row, and step through days with Prev/Next or the arrow keys. Ctrl+Enter saves the value.
- The inspector is a real floating panel: **drag its header** to move it, resize it from the bottom-right corner, minimise it, or dock it back to the bottom-right. Position and size are saved in localStorage.
- **Dashboard**: click **Arrange panels**, then drag the ⠿ handle of any panel onto another to reorder the chart/overview cards. **Reset layout** restores the default order. The order is saved locally.

## Formulas
- **Net Pay** = Basic + OT Pay − Absence Deduction − Penalty − Advance Deduction
- **OT Pay** = OT Hours × OT Rate/hr + OT Off-Days × OT Rate/day
- **Absence Deduction** = Absent Days × (Basic ÷ Days in Month) *(or fixed/day, or none)*
- **Advance Deduction** = Advance Amount ÷ Advance Months

OT rate priority: site rate → employee OT Fixed Rate → base hourly rate × OT Multiplier.

## Day-cell codes
Numbers = hours (or day fractions when count type = Days) · `A` / `ABS` / `غياب` = absent · `OFF` / `R` / `راحة` = off day · `P` = present (normal hours) · blank = no entry · `8:30` = 8.5 h.

## Flags
- 🚩 **Duplicate** — ID repeated in the master or across timesheets
- 🚩 **Suspicious** — totals exceed the physically possible (period days × 24 h), or a single day > 24 h
- ⚠️ **Verify** — 0 OT **and** 0 absences (possible unsubmitted sheet), missing master record, no timesheet row, unreadable cells, red grid marks, negative net

## Employee Master columns (exact template)
Name · Employee ID · Site / Department / Branch · Position · Basic Salary · Pay By (Day/Hour) · Rate per Day · Rate per Hour · OT Multiplier · OT Fixed Rate · Days in Month · Off Day · Advance Amount · Advance Months · Penalty per Absence

## Privacy
All data stays in your browser (localStorage). Nothing is uploaded anywhere.
Use **Data & Settings → Backup** to move between machines.