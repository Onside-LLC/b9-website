# b9baseball.com

The Bottom of the Ninth Baseball and Softball Academy marketing site: one
static HTML page and its images. No build step, no framework, no server-side
code.

```
index.html          the whole site
images/             photography, logos, favicons
config/nginx.conf   server config baked into the container
config/deploy.yml   Kamal 2 deploy to onside-web
Dockerfile          nginx container
docs/hosting.md     hosting and cutover runbook
```

## Working on it

Open `index.html` in a browser. That is the whole development loop.

To check what actually ships, build the container:

```sh
docker build -t b9-baseball .
docker run --rm -p 8080:80 b9-baseball
# http://localhost:8080  and  http://localhost:8080/up
```

## Deploying

The site runs on Onside-operated infrastructure: an nginx container on the
`onside-web` droplet, deployed with Kamal 2 and fronted by kamal-proxy with
Let's Encrypt.

```sh
kamal deploy
```

Secrets are never committed. `.kamal/secrets` is gitignored; copy
`.kamal/secrets.example` and export the GHCR credentials in your shell.

See [docs/hosting.md](docs/hosting.md) for the full runbook: first deploy,
the DNS cutover off DigitalOcean App Platform, teardown of the old host, and
rollback.
