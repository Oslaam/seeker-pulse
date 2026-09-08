# Seeker Pulse

Unofficial daily activity checks for Solana Seeker and Seed Vault Wallet users.

Enter a `.skr` domain to see an estimated activity scorecard
for:

- Onchain Activity
- dApp Exploration
- Daily Use

The app also suggests natural ways to use the wallet when a category is not
complete.

## Important

Seeker Pulse is an independent tool. It reads public blockchain data and
calculates an estimate. It is not connected to Solana Mobile's private scoring
system, so its results are not official Seed Vault Wallet scores.

## Features

- Resolve `.skr` domains to wallet addresses.
- Reverse-check wallet addresses for associated `.skr` domains.
- Show activity from the last 30 days using Helius enhanced transactions.
- Suggest registered `.skr` domains while the user types.
- Display progress for daily transactions, protocol variety, and active streaks.
- Run locally with Express or deploy to Vercel serverless functions.
- Collect browser performance data with Vercel Speed Insights.

## How scoring works

The scorecard is an estimate based on public data:

| Category | Current estimate |
| --- | --- |
| Onchain Activity | Wallet-initiated transactions today, UTC |
| dApp Exploration | Distinct labeled protocols in the last 30 days |
| Daily Use | Consecutive days with wallet activity |

The app intentionally frames suggestions around genuine wallet use. Repeating
transactions only to increase a displayed count may not reflect Solana
Mobile's natural-use scoring.

## Requirements

- Node.js 18 or newer
- A Helius API key

## Local setup

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root:

```env
HELIUS_API_KEY=your-helius-api-key
# Optional:
# RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-helius-api-key
# PORT=3000
```

Build and start the app:

```bash
npm start
```

Open <http://localhost:3000>.

Production site: <https://seekerpulse.xyz/>.

## Vercel deployment

This repository includes `vercel.json` with the correct deployment settings:

- Build command: `npm run build`
- Static output directory: `public`
- Serverless API routes: `api/lookup.ts` and `api/domain-suggestions.ts`

In the Vercel project settings:

1. Add `HELIUS_API_KEY` as an environment variable for the deployment environment.
2. Set its environment scope to **Production** (and **Preview** if you test preview deployments).
3. Optionally add `RPC_URL` or `HELIUS_RPC_URL` if you use a custom Helius RPC endpoint.
4. Keep the output directory set to `public`, not `build`.
5. Redeploy after saving the variables. Environment changes do not apply to an existing deployment.

The local Express server and Vercel functions share their handlers in
`src/api.ts`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run build` | Compile the server and browser TypeScript |
| `npm start` | Build and start the local Express server |
| `npm run dev` | Build and watch the local server |
| `npm run sync:dapps` | Synchronize verified dApp records into PostgreSQL |
| `npm run sync:dapps -- --dry-run` | Discover and validate dApps without database writes |

## dApp catalog

The dApp catalog is deliberately empty until a complete, free, public source
can be verified. The official Solana Mobile documentation verifies the dApp
Store publishing workflow and deep-link format, but the official publishing
repository does not expose a documented public endpoint that enumerates every
store listing. Seeker Pulse therefore does not ship guessed dApp records or
package names. See [DAPP-CATALOG.md](DAPP-CATALOG.md) for the source analysis.

Available catalog endpoints are:

- `GET /api/dapps`
- `GET /api/dapps/search`
- `GET /api/dapps/:id`

## Project structure

```text
api/                 Vercel serverless function adapters
public/              HTML, CSS, generated browser output, and assets
src/
  api.ts             Shared API handlers
  server.ts          Local Express server
  lib/               Identity, activity, and scoring logic
  page/              Browser TypeScript entry point
types/               Local package type declarations
vercel.json          Vercel build and output configuration
tsconfig.json        TypeScript configuration
```

Generated JavaScript is ignored by Git and is created during the build. The
authored application source is TypeScript.

## Limitations

- Solana Mobile's official scoring formula is private and unavailable through
a public API.
- Activity lookups are capped at roughly 300 recent transactions for speed.
- Helius labels common protocols, but unknown programs do not count toward
dApp Exploration.
- The `.skr` autocomplete validates the exact name being typed. The current
TLD parser does not provide a public similar-name search endpoint.
- Public lookups do not prove that the person entering an address owns it.
Sign-In With Solana would be needed for authenticated ownership flows.

## Related resources

- [Solana Mobile Developers](https://solanamobile.com/developers)
- [Solana Mobile Documentation](https://docs.solanamobile.com/)
- [Solana Mobile dApp Store](https://docs.solanamobile.com/dapp-store/intro)
