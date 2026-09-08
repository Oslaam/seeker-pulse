# dApp catalog status

Seeker Pulse keeps dApp records in its own PostgreSQL database through Prisma.
The provider boundary is `DappCatalogProvider`, so discovery can be replaced
without changing search, ranking, or the API.

## Verified source investigation

The official Solana Mobile documentation verifies the dApp Store deep-link
format and the publishing workflow. The official `solana-mobile/dapp-publishing`
repository documents portal-backed publishing and publishing metadata, but it
does not expose a public, complete catalog feed or a documented public
enumeration endpoint for all store listings.

Because a complete free catalog source could not be verified, the current
`VerifiedSolanaMobileCatalogProvider` returns an empty list. This is deliberate:
the application must not present guessed package names, releases, ratings,
compatibility, or store identities as facts.

Future verified imports can implement `DappCatalogProvider` and provide source
provenance for each record. The sync service validates, normalizes, upserts, and
logs those records idempotently.

## Verified file import

Reviewed records can be supplied as a JSON array without changing application
code. Use the official metadata URL as `metadataUri`, the reviewed source page
as `sourceUrl`, and only copy the Android package from verified metadata.

```json
[
	{
		"source": "verified-import",
		"sourceId": "stable-source-id",
		"sourceUrl": "https://verified-source.example/app",
		"metadataUri": "https://verified-source.example/metadata.json",
		"verifiedAt": "2026-09-08T00:00:00.000Z",
		"name": "Verified app name",
		"packageName": "com.example.app",
		"status": "active"
	}
]
```

Run an import in dry-run mode first:

```bash
npm run sync:dapps -- --file data/dapps.verified.json --dry-run
```

The checked-in file is intentionally empty until real records are reviewed.

## Optional bootstrap snapshot

SeekerTracker currently exposes a public catalog endpoint. Seeker Pulse can
download a snapshot from it, normalize the fields, and then import the local
JSON snapshot into PostgreSQL. This is a bootstrap/import workflow only: the
application does not call SeekerTracker during search or recommendations.

```bash
npm run dapps:snapshot:seekertracker
npm run sync:dapps -- --file data/dapps.seekertracker.snapshot.json --dry-run
npm run sync:dapps -- --file data/dapps.seekertracker.snapshot.json
```

The snapshot is marked `seekertracker-snapshot` in provenance. It is not
official Solana Mobile data, and its freshness depends on the endpoint's last
sync. Review or refresh the snapshot before relying on it as current catalog
data.

## Daily refresh

The repository includes `.github/workflows/dapps-refresh.yml`. It runs daily at
03:17 UTC and can also be started manually from the GitHub Actions tab. It
downloads a fresh snapshot, validates it, and upserts it into PostgreSQL.

Add these GitHub Actions repository secrets before enabling the schedule:

- `DATABASE_URL`
- `POSTGRES_URL`
- `PRISMA_DATABASE_URL`

The workflow uses PostgreSQL directly and does not call SeekerTracker from the
Seeker Pulse application. The external source is used only by the scheduled
import job.

## Cronjobs account refresh

The protected production endpoint is:

```text
https://seekerpulse.xyz/api/dapps-refresh
```

Create a secret locally with PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add that value to Vercel as an environment variable named `CRON_SECRET` for
the Production environment. Do not put it in frontend code, Git, or a public
`.env` file.

Configure your cronjobs account to call the endpoint every 24 hours using either
`GET` or `POST` and this request header:

```text
Authorization: Bearer YOUR_CRON_SECRET
```

Requests without the exact secret receive `401 Unauthorized`. The endpoint
returns `200` with sync statistics after a successful refresh.

## Commands

```bash
npm run sync:dapps
npm run sync:dapps -- --dry-run
```

The dry run discovers and validates records without writing PostgreSQL.

## LLM recommendation explanations

The dApp finder can optionally use an OpenAI-compatible model after PostgreSQL
retrieval. Add these variables to the server environment only:

```text
OPENAI_API_KEY=your-provider-key
OPENAI_MODEL=gpt-4o-mini
```

The model receives only the top database candidates and must return candidate
IDs. The backend rejects IDs that were not retrieved from PostgreSQL and always
resolves the final dApp metadata, package name, score, and deep link itself.
Without `OPENAI_API_KEY`, the deterministic catalog recommender remains active.
The model is never allowed to execute transactions or generate store links.