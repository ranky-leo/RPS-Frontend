# Roshambo Frontend (Next.js)

## Run

```bash
npm install
npm run dev
```

Default URL: `http://localhost:3000`

Backend API URL env:

```bash
NEXT_PUBLIC_API_BASE=http://localhost:4001
```

For deployment:

- If frontend and backend are on the same domain, `NEXT_PUBLIC_API_BASE` can be omitted.
- If backend is on another domain, set:

```bash
NEXT_PUBLIC_API_BASE=https://your-backend-domain.com
NEXT_PUBLIC_WS_BASE=https://your-backend-domain.com
```

## Implemented UI scope

- Single-page lobby
- Top bar:
  - Left: game logo
  - Center: subscribers + currently playing count
  - Right: user avatar and balance
- Match price row (`$1, $2, $5, $10, $20`)
- Matching modal with cancel action
- Match modal with live countdown, move select, score, stake, fee
- Ongoing match viewer grouped by price for spectators
- Realtime updates through Socket.IO
- Register + mock deposit modules (modal-ready blocks)

## Notes

- Matchmaking standby matches are not listed to users
- Live match cards reveal moves only after server marks reveal
- Wallet lock/balance syncs from backend on join/cancel/finish/release
