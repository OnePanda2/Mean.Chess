# Deployment

Mean Chess is a static site. GitHub Actions builds and tests it on every push to `main` and
publishes `dist/` to GitHub Pages at **https://meanchess.siddheshthapa.com**.

## Pipeline (`.github/workflows/deploy.yml`)

1. Check out the code and set up Node (version from `.nvmrc`, with an npm cache).
2. `npm ci` → `npm run lint` → `npm run typecheck` → `npm run test:coverage` → `npm run build`.
3. Upload `dist/` as the Pages artifact and deploy it (pushes to `main` only).

Pull requests run the same checks without deploying. Nothing is published unless every check
passes.

## One-time setup

| Step | Who | How | Status |
|---|---|---|---|
| Enable Pages, source "GitHub Actions" | maintainer | `gh api -X POST repos/OnePanda2/Mean.Chess/pages -f build_type=workflow` | Done 2026-10-07 |
| Set the custom domain **before** DNS (takeover protection) | maintainer | `gh api -X PUT repos/OnePanda2/Mean.Chess/pages -f cname=meanchess.siddheshthapa.com` | Done 2026-10-07 |
| Add the DNS record | domain owner | Namecheap steps below | |
| Verify the apex domain with GitHub (recommended) | domain owner | Steps below | |
| Enforce HTTPS once the certificate exists | maintainer | `gh api -X PUT repos/OnePanda2/Mean.Chess/pages -F https_enforced=true` | |

`public/CNAME` contains the domain for clarity only: deployments through Actions ignore it. The
repository setting is what counts.

### Namecheap: the CNAME record

1. Sign in at namecheap.com.
2. In the left menu, click **Domain List**.
3. Click **Manage** next to `siddheshthapa.com`.
4. Open the **Advanced DNS** tab.
5. Under **Host Records**, click **Add New Record**.
6. Type: **CNAME Record**. Host: `meanchess`. Value: `onepanda2.github.io`. TTL: Automatic.
7. Click the green check mark (or **Save All Changes**).

Never use a wildcard (`*`) record, `@`, or a URL Redirect record for this.

### GitHub: verify the domain (recommended)

1. GitHub → profile picture → **Settings** → **Pages** (under *Code, planning, and automation*).
2. Click **Add a domain**, enter `siddheshthapa.com`, then click **Add domain**.
3. In Namecheap, add a **TXT Record** with Host `_github-pages-challenge-onepanda2` and Value set to
   the code GitHub shows.
4. Back on GitHub, click **Verify**. Keep the TXT record permanently.

Verifying the apex domain also protects its immediate subdomains (`meanchess`, `taxcal`).

## Checks

```bash
nslookup meanchess.siddheshthapa.com
gh api repos/OnePanda2/Mean.Chess/pages
gh run list -R OnePanda2/Mean.Chess -L 5
```

DNS usually propagates within minutes (Namecheap says to allow about 30). GitHub then issues a Let's
Encrypt certificate, usually within an hour and occasionally up to 24. `siddheshthapa.com` has no CAA
records, so nothing blocks issuance.

## Troubleshooting

- **The push of `.github/workflows/deploy.yml` is rejected for "workflow scope":** run
  `gh auth refresh -h github.com -s workflow`, then `gh auth setup-git`, and push again.
- **The deploy job says Pages is not enabled:** run the first setup step, then re-run the workflow
  (`gh run rerun <id>`).
- **The site loads without styles at `onepanda2.github.io/Mean.Chess/`:** expected. `base` is `/`
  for the custom domain, and that URL redirects there once DNS is live.

## Previewing a production build locally

```bash
npm run build
npm run preview
```
