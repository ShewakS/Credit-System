# Smart Credit Ledger Management System (Frontend Only)

Desktop-only fintech dashboard prototype built with HTML, CSS, and minimal JavaScript. No backend, auth, or persistence; all data is in-memory and resets on reload. Designed to visually simulate a full credit workflow for SMEs.

## Highlights
- Dashboard KPIs, credit vs payment trends, recovery bars, aging distribution, watchlist
- Customer management with risk tags, limits, balances, overdue amounts
- Credit entry with limit warnings; payment management with partial/full and ledger history
- Overdue buckets (1–7, 8–30, 30+), reminder schedules and history simulation
- Analytics with reliability distribution, recovery rate, overdue trends
- Risk analysis with computed reliability scores and utilization
- Ledger/audit trail with running balance; settings page for profile/rules/theme preview

## Run (Windows)
- Double-click `index.html`, or run:

```powershell
Start-Process "c:\Users\shewa\Desktop\Payment tracking\index.html"
```

## Notes
- Desktop only; no responsive behavior implemented.
- All interactions are DOM-only and use dummy data. Reload clears state.
