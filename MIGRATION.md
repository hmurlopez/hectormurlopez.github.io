# Going private: GitHub Pages → Vercel

Everything in the repo is already prepared. This file is the list of switches
you have to flip yourself, because they need access to your GitHub and Vercel
accounts.

Order matters: **set up Vercel first, then make the repo private.** Doing it the
other way around takes the live site down for however long the Vercel setup
takes.

---

## What this actually buys you

Making the repo private hides **the source and the commit history**. Nobody can
watch you iterate, read half-finished copy, or see that you rewrote the hero
four times. That was the thing you wanted, and this gets it.

It does **not** make the deployed site private. Anything Vercel serves is public
HTML on a public domain. The site-key gate in `js/gate.js` is a curtain, not a
lock — the key hash ships in the JavaScript, so it stops a casual visitor and
would not stop anyone who opens devtools. Keep that distinction straight and
don't put anything on the site you'd mind a stranger reading.

## Why not just make it private and keep GitHub Pages

GitHub Pages only serves from a private repo on a **paid** GitHub plan (Pro,
Team, or Enterprise). On the free plan, flipping this repo to private simply
turns the site off. Vercel's free Hobby tier serves private repos with custom
domains, which is why the migration is the move rather than an optional extra.

---

## Step 1 — Connect Vercel (site still live on Pages)

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project → Import** `hmurlopez/hectormurlopez.github.io`.
   You may need to grant the Vercel GitHub App access to the repo.
3. On the configure screen, leave everything at its default. `vercel.json`
   already sets the framework (none), the build command, and the output
   directory — Vercel reads it automatically.
4. **Deploy.** You'll get a `*.vercel.app` URL.
5. Open that URL and check it: the gate should appear, your key should unlock
   it, and `/projects` should load. Confirm this before touching DNS.

## Step 2 — Move the domain

1. In the Vercel project: **Settings → Domains → Add** `hectormurlopez.com`
   (and `www.hectormurlopez.com` if you want it to redirect).
2. Vercel will show you the exact DNS records to set. **Use the values Vercel
   displays**, not values from any guide including this one — they've changed
   their IPs before and the dashboard is the only current source.
3. Go to your domain registrar's DNS settings and replace the GitHub Pages
   records (the `185.199.x.x` A records, and/or the CNAME pointing at
   `hmurlopez.github.io`) with Vercel's.
4. Wait for propagation — usually minutes, occasionally a few hours. Vercel's
   domain panel shows a green check when it's live and the certificate is
   issued.

## Step 3 — Make the repo private

Only once the domain is serving from Vercel.

1. Repo **Settings → General →** scroll to **Danger Zone**.
2. **Change repository visibility → Make private.**

Two things to know before you click:

- **GitHub Pages will stop serving.** That's expected and fine — Vercel is
  serving the domain now. You can also explicitly disable Pages in
  Settings → Pages afterward to avoid confusion.
- **Existing forks are not deleted.** If anyone forked this repo while it was
  public, their fork stays public and gets detached into its own network. Going
  private cannot retroactively un-publish what was already public. Worth
  checking the fork count first if that matters to you.

## Step 4 — Verify the pipeline still works

1. Actions tab → **Sync Substack posts** → **Run workflow**.
2. Confirm it commits `posts.json` and that Vercel then builds and deploys.

This actually works *better* on Vercel. On GitHub Pages, the bot's push with
`GITHUB_TOKEN` didn't reliably retrigger the Pages build. Vercel deploys on
every push to `main` regardless of who pushed, so the daily sync now reaches the
live site on its own.

Note: GitHub Actions on a private repo draws from your free 2,000
minutes/month. This workflow runs about a minute a day, so roughly 30 minutes a
month. Not a concern.

---

## Things to know afterward

**Scheduled workflows go dormant after 60 days of no repo activity.** GitHub
emails you first, and re-enabling is one click in the Actions tab. This applies
whether the repo is public or private.

**`CNAME` is left in place on purpose.** It's a GitHub Pages file and Vercel
ignores it. Keeping it means rolling back to Pages is just flipping the repo
public again. Delete it if you're sure you're never going back.

**Preview deployments are public by default.** Every branch push gets its own
`*.vercel.app` URL, and on the Hobby tier those URLs aren't password-protected
— the link is just hard to guess. If you're going to push genuinely unfinished
work, either keep it on branches you don't mind having a live preview of, or
turn previews off in Settings → Git.

**Vercel's Hobby tier is for non-commercial use.** A personal portfolio is
squarely within that. If this site ever becomes a sales channel for Pest Tech
USA, that's when it needs a paid plan.

## When you're ready to launch publicly

Two things gate the site right now, and both come out together:

1. Delete the `<div id="gate">` block from `index.html`. `js/gate.js` becomes a
   no-op automatically when no gate element is present — the site boots
   straight through.
2. Set `"gated": false` in `projects.json` and run `node
   scripts/build-projects.mjs`. That strips the `noindex` tag off every
   generated project page.
3. Remove the `<meta name="robots" content="noindex">` line from `index.html`.
   (`404.html` never had one.)

Search engines can then index it, and the sitemap already lists every project
page.
