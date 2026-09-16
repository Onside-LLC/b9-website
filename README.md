# b9baseball.com

The Bottom of the Ninth Baseball and Softball Academy marketing site. Static
HTML and one stylesheet. No build step, no framework, no bundler, no
server-side code.

```
index.html              home
programs/               programs and pricing
coaches/                coach bios, softball, sub-lease coaches
teams/                  travel teams, results, alumni wall
camps/                  camps and events index
camps/<slug>/           one page per dated event, SportsEvent JSON-LD
lessons/                lesson inquiry form (the only interactive surface)
css/site.css            the whole design system
js/lead-form.js         the Onside shared lead endpoint client
images/                 photography, logos, favicons
robots.txt
sitemap.xml             hand-maintained; there is nothing to generate it from
CONTENT-TODO.md         every open question, and who owes the answer
```

Design is concept B ("Family Friendly Local") from the B9 market brief, with
the results strip and alumni wall carried over from concept A per the decision
on b9-website#1.

## Working on it

Pages are plain files. Edit one and reload.

Links are root-relative (`/programs/`), so opening a file directly off disk
will not resolve them. Serve the directory instead:

```sh
python3 -m http.server 8000
# http://localhost:8000
```

URLs are directory-per-page. nginx serves `/programs/` from
`programs/index.html` and redirects `/programs` to it; the local server above
behaves the same way.

## Content rules

Two rules, and they are not style preferences.

**Never invent a number, a name, a date or a price.** Anything not traceable to
the market brief or `onside-os/clients/b9.md` renders as a visible
`[TK: ...]` marker, never as a plausible-looking fake. A parent can check a
record against Perfect Game and a rate against a phone call. Find the open ones
with `grep -rn "\[TK:" --include="*.html" .` and read `CONTENT-TODO.md` for who
owes each answer.

**Pure ASCII, and no em-dashes.** Client-facing HTML uses ASCII only, including
apostrophes and quotes.

## The lesson inquiry form

`js/lead-form.js` is the only JavaScript on the site. It talks to Onside's
shared multi-tenant lead endpoint on `onside.llc`: a token fetch on page load,
then a JSON POST. No Formspree, no mailto, no per-site handler. The tenant is
resolved from the request Origin, so there is no client token in the markup.

The endpoint contract is documented at the top of that file. **It is not
deployed yet** (onside-rails#109 is still a draft), so every form on the site
currently disables itself on load and shows the phone number instead. That is
the intended behaviour until the endpoint ships and `Client id=8` has
`form_origin = https://b9baseball.com`.

## Deploying

The site runs on Onside-operated infrastructure: an nginx container on the
`onside-web` droplet, deployed with Kamal 2 and fronted by kamal-proxy with
Let's Encrypt. That layer lands separately in PR #4; see `docs/hosting.md`
after it merges for the first deploy, the DNS cutover off DigitalOcean App
Platform, teardown of the old host, and rollback.

Whichever of the two branches merges second must extend the `COPY` lines in
`Dockerfile`: it currently copies only `index.html` and `images/`, which
predates every directory listed above.
