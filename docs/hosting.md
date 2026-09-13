# Hosting and cutover runbook

`b9baseball.com` moves from DigitalOcean App Platform to an nginx container on
`onside-web` (`167.99.1.144`) under Kamal 2, per the Onside hosting rule in
`patterns/small-business-web-platform.md` (onside-os#141).

## What is where today

| | Current | Target |
|---|---|---|
| Origin | DO App Platform app `b9-app` (`d2cb4773-f0ef-4b98-8d1f-482e3b54dcb6`, region `sfo`), auto-deploying on push to `main` | `b9-baseball` Kamal service on `onside-web` |
| TLS | DO-managed | kamal-proxy, Let's Encrypt HTTP-01 |
| Registrar | Onside's GoDaddy account | unchanged |
| DNS | DigitalOcean (`ns1/ns2/ns3.digitalocean.com`) | unchanged |
| Rollback | redeploy on DO | previous image tag (`kamal rollback`) |

**The Cloudflare in front of the site today is DigitalOcean's, not Onside's.**
Verified 2026-09-12: `b9baseball.com` resolves to Cloudflare anycast addresses
and responses carry `server: cloudflare` alongside `x-do-app-origin`, but the
authoritative nameservers are DigitalOcean's and there is no Onside Cloudflare
zone in the path. That edge belongs to App Platform and disappears with it.
So the cutover is **a DigitalOcean DNS record change**, not a Cloudflare origin
repoint, and the site loses its CDN at cutover. That is an accepted tradeoff
for a 12 KB page plus images served from a Dallas-adjacent droplet; putting a
real CDN in front later is a separate decision, never bundled into a cutover
(same pattern doc).

`www.b9baseball.com` has no DNS record and is not in `proxy.hosts`. If www is
wanted, create the record first, then add the host and redeploy — a host that
cannot answer HTTP-01 is a permanently failing certificate order.

## One-time setup (operator)

1. GHCR credentials in the deploying shell (the same ones onside-rails and
   captain-rails use), then `cp .kamal/secrets.example .kamal/secrets`:
   ```sh
   export KAMAL_REGISTRY_USERNAME=<github-username>
   export KAMAL_REGISTRY_PASSWORD=<github PAT with write:packages>
   ```
2. SSH access to `167.99.1.144` as root, the same key used for the other
   services on that host.
3. In DigitalOcean DNS, add the verification hostname:
   `b9.onside.llc  A  167.99.1.144`.

## Deploy

```sh
docker build -t b9-baseball .              # optional local smoke test
docker run --rm -p 8080:80 b9-baseball     # then hit localhost:8080 and /up

kamal setup                                # first deploy only
kamal deploy                               # every deploy after
```

`kamal setup` installs Docker and kamal-proxy if they are missing; both are
already present on `onside-web`, so it is effectively a first `deploy`.

Expect the first deploy to log a certificate failure for `b9baseball.com`.
That is correct: the name still points at App Platform, so HTTP-01 cannot
complete. kamal-proxy keeps retrying and issues the certificate on its own
once DNS moves.

## Verify before touching DNS

```sh
curl -sSI https://b9.onside.llc/up        # 200, valid Let's Encrypt cert
curl -sS  https://b9.onside.llc/ | head   # the B9 page
kamal app logs -n 50
```

Load the page in a browser and confirm the hero, gallery images, the coaches
and contact sections, and the embedded map all render.

## Cutover (DNS)

1. In DigitalOcean DNS, replace the apex `b9baseball.com` records with a
   single `A  167.99.1.144`. Set TTL to 300 first if you want a fast retreat.
2. Wait for propagation: `dig +short b9baseball.com` returns `167.99.1.144`.
3. Watch kamal-proxy pick up the certificate:
   ```sh
   curl -sSI https://b9baseball.com/up
   ```
   Issuance is usually under a minute. Until it lands, browsers will show a
   certificate warning — this is the only user-visible risk window, so cut
   over outside academy hours (Mon-Fri 4-10 PM CT).
4. Confirm the page over HTTPS with no App Platform headers present
   (`x-do-app-origin` gone, `server: nginx` suppressed by `server_tokens off`).

## Teardown — only after verification

Do not start this until the site has served correctly from `onside-web` for at
least 24 hours.

1. Remove the domain from the DO App Platform app (Settings → Domains), so DO
   stops managing certificates for it.
2. Destroy app `b9-app` (`d2cb4773-f0ef-4b98-8d1f-482e3b54dcb6`). This also
   ends `deploy_on_push` from this repo — from then on, `kamal deploy` is the
   only way the site changes.
3. Separately, confirm the two dormant Heroku apps
   (`blooming-bastion-04114`, `b9baseball-staging`) are actually destroyed.
   They were handed to the client for teardown in May 2026 and never
   confirmed. Tracked in b9-website#2.

## Rollback

- **Bad deploy, DNS already cut over:** `kamal rollback <version>`, or
  `kamal app boot --version=<previous-sha>`. `kamal app containers` lists what
  is available on the host.
- **Cutover itself is going badly:** point the apex records back to the App
  Platform values recorded before step 1 of the cutover. **Write those records
  down before changing them** — they are DO-managed anycast addresses and are
  not otherwise recoverable. This is why `b9-app` is not destroyed until after
  the soak.
- **Total loss of the host:** the site is 12 KB of HTML plus images in this
  repo. Any nginx anywhere can serve it.
