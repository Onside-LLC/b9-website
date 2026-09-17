# Open items before b9baseball.com goes live

Every gap on this site renders as a visible `[TK: ...]` marker on the page it
belongs to, rather than as an invented number. That is deliberate
(`patterns/small-business-web-platform.md`): a missing rate is a question for
the client, and a made-up rate is a lie a parent will find out about.

Find every remaining marker with:

    grep -rn "\[TK:" --include="*.html" .

Nothing in this file is a blocker on merging the site branch. Most of it is a
blocker on cutover (b9-website#2).

---

## 1. Blocks cutover

| Item | Who | Notes |
|---|---|---|
| **Lead endpoint live** | Onside | `onside-rails#109` must merge and deploy. Until it does, every form on this site disables itself and shows the phone number. Do not cut over with a dead form. |
| **Client id=8 configured** | Onside | In the onside-rails dashboard: `form_origin = https://b9baseball.com`, `lead_recipient_emails = [bottomoftheninthbaseball@gmail.com]` plus an Onside fallback. |
| **End-to-end form test** | Onside | From the live `b9baseball.com` origin: submission lands as a row in onside-rails, email reaches Zak, entry visible in the dashboard. |
| **Kamal hosting merged** | Onside | PRs #6 -> #4 -> #5, in that order. #6 rewrote the `Dockerfile` to copy the whole build context, so the new directories are already covered; nothing has to be hand-edited at merge time. |
| **Privacy notice** | Zak + Onside | The lesson form collects a **minor's** name and age along with a parent's name, email and phone, and posts them to Onside's servers. The site has no privacy page and no footer link to one. Not written here on purpose: it is a statement Zak makes about his own business and needs his sign-off. `onside.llc/privacy` is the nearest model. |
| **Canonical phone number** | Zak | The site, the brief and this build all use **(832) 384-5503**. Directories carry **409-539-2515**. One of them is wrong and GBP plus NAP cleanup cannot start until Zak says which. |

## 2. Content Zak owes us

| Page | Item |
|---|---|
| `/programs/` | Private lesson price and length; small-group price and size; package pricing if offered; cage rental rate. "From $X" floor rates are an acceptable fallback and still beat an empty page. |
| `/programs/`, `/coaches/` | Sub-lease coach roster: names, specialty, ages served, consent to be listed, and whether inquiries route to the coach or back to Zak. |
| `/coaches/` | Who coaches softball, what is offered and for what ages. "Softball pitching coach near me" is a live search term in the market brief and the site currently answers it with nothing. |
| `/coaches/` | Current high-resolution interior facility photos, or a booked shoot. The two interior shots in the repo are under 450px wide. |
| `/teams/` | Which season the 17U 10-6-1 record covers; direct Perfect Game team-page URLs for 16U and 17U; which age groups are fielded this season; tryout dates, roster sizes and team fees. |
| `/teams/` | What the archive photos actually show. The file names suggest a 14U fall state championship, but nothing corroborates the title, year or league, so the captions stay neutral until Zak confirms. |
| `/teams/`, `/` | The real alumni wall: per player, name, high school, graduating class, the college or organization signed with, and written permission to publish. Minors need parent consent. The three cards live today are the **coaching staff's** college program records and are labeled that way on purpose. |
| `/` | Age range served. Concept B said 8U to 18U; nothing verifies it, so the site says "baseball and softball" until Zak confirms. |
| `/lessons/` | Typical callback time, what players should bring, and whether parents watch from the side of the cage. |
| `/lessons/` | Where parents park and which door reaches the second floor. |
| `/camps/` | Whether registration is deposit-then-balance or pay-in-full. |

## 3. Operator provisioning

### GA4
Not provisioned. No measurement ID has been invented anywhere in this repo.

1. Create the GA4 property in the Onside GA4 account for `b9baseball.com`.
2. Replace `G-XXXXXXXXXX` in the commented block in `index.html` (both
   occurrences) and uncomment it.
3. Copy the same block into every other page: `programs/`, `coaches/`,
   `teams/`, `camps/`, `camps/*/`, `lessons/`. Each of those pages carries a
   one-line marker pointing back here.
4. Mark the `/lessons/` thank-you state as the conversion event.

### Google Search Console
Not verified. DNS TXT is the preferred method because it survives deploys; the
`<head>` of `index.html` has a marked slot if HTML-tag verification is used
instead. Submit `https://b9baseball.com/sitemap.xml` after cutover.

### Google Business Profile
Claim the listing at 1115 S Gordon St., Alvin TX 77511 (second floor of Cash
Cow Pawn), set the category to Baseball or Sports training, and unify the phone
number. Once the listing is live, add its URL to the `sameAs` array in the
`LocalBusiness` and `SportsActivityLocation` JSON-LD in `index.html`, and
confirm the `geo` coordinates there against what GBP reports. The coordinates
currently in the file are read off the Google Maps place marker used by the
embed, not off a claimed profile.

### Stripe Payment Links (per camp)
Out of scope for the site build: creating them is a live-account mutation.

Per `feedback-one-off-collections-payment-links`, camp registration is a
**Stripe Payment Link per event**, never an invoice and never a booking system.
For each real camp the operator creates one link in the Onside Stripe account
with:

- the camp name and dates in the product name
- the deposit amount (or the full price, once the model in section 2 is settled)
- a quantity cap matching the roster limit
- player name and parent phone collected as custom fields at checkout

Then, on that camp's page, replace the placeholder

    <span class="btn btn-disabled">Registration not open</span>

with an anchor pointing at the link:

    <a class="btn btn-primary" href="https://buy.stripe.com/...">Register</a>

No Payment Link exists today because no camp has a date or a price.

---

## Adding a real camp

1. `cp -r camps/tk-winter-hitting-camp camps/<real-slug>`
2. Replace every `[TK: ...]` marker on the page.
3. In the `SportsEvent` JSON-LD, replace the sentinel `1970-01-01` dates with
   the real ISO 8601 start and end, and the `0.00` price with the real one.
4. Delete the `<meta name="robots" content="noindex, nofollow">` tag and the
   placeholder notice.
5. Point the registration button at that camp's Stripe Payment Link.
6. Add the URL to `sitemap.xml` and link the camp from `camps/index.html`.
7. When the camp is over, move its card into the "Past Camps" list on
   `camps/index.html`, swap the badge and the registration panel for the archive
   versions (see `camps/tk-summer-skills-camp/`), and set
   `offers.availability` to `SoldOut`. **Do not delete the page.** Past camp
   pages keep serving and keep their search equity; that is the whole reason the
   camps surface is built as real URLs.
8. Once real camps exist, delete both `camps/tk-*` placeholder directories.

## Note for whoever merges PR #4

Merge order is **#6 -> #4 -> #5** and there is nothing to hand-resolve.

The old warning here said the `Dockerfile` on `feature/kamal-hosting` copied
only `index.html` and `images/`, and that whichever branch merged second had to
extend the `COPY` lines by hand. PR #6 replaced those enumerated `COPY`s with a
copy of the build context plus a `.dockerignore`, so adding a page no longer
touches the `Dockerfile` at all. The `README.md` conflict between the two
branches has also been resolved on #5.
