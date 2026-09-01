# Working in this repo

A two hour hands-on workshop: attendees describe an object, an agent builds it,
and they publish it streaming. React + Vite, not Next. The App Router cannot run
in WebContainer, which is where attendees run this, so the port is deliberate.

## The two halves

`app/` is the attendee's. `stage.tsx` is the file they edit all session, and the
sidebar writes into it between the `miris:` marker comments. It must stay
byte-identical to `miris/stage.template.tsx`, which the reset action restores
from. `main.tsx` they touch once, at step 5.2.

`miris/` is the workshop's machinery: the guide, curriculum copy, snippets, the
dev API, config. Nothing in it needs editing to complete the workshop.

Attendees read these files by hand, so keep comments to roughly one line per
file. The curriculum's WHY texts already explain the concepts; a comment
repeating one is noise in front of the code it explains.

## Publishing is a filtered push, and `origin` is not it

`origin` is the **private** repo. The public one attendees clone,
`dex-honsa-miris/miris-workshop-starter-public`, is deliberately **not** a
configured remote, so that no one can `git push public` and get it wrong.

Publishing rewrites history to strip internal files, then force-pushes:

```sh
git clone --single-branch -b <branch> . /tmp/pub && cd /tmp/pub
git filter-repo --force --invert-paths \
  --path docs --path miris-web-kit --path miris/kit --path dist \
  --path-glob '*SKILL.md' --path-glob '*voice.md'
git remote add pub https://github.com/dex-honsa-miris/miris-workshop-starter-public.git
git push --force pub <branch>:main
```

Two reasons it has to be this and not a plain push. `docs/miris-web-kit/` holds
internal brand docs naming an employee; it is gitignored now, but older commits
in this history still contain it, so a clean tip is not enough. And filtering by
directory alone is not enough either: those files have lived at `public/kit/`,
`miris/kit/` and `docs/miris-web-kit/`, so a `--path docs` filter leaves the
earlier copies behind. Filter by filename too, and verify against every commit
before pushing, not just `HEAD`.

## Other things that have bitten

The dev API (`miris/devApi.ts`) is a Vite `configureServer` middleware, so it
exists only under `npm run dev`. A built preview answers `/api/miris` with the
SPA fallback: **200 and `text/html`**, not a 404. Detect it by content type.

`@miris-inc/core` is a peer dependency of `@miris-inc/three`. Nothing imports it
directly, so it looks removable from `package.json`. It is not.

WebContainer drops binary files on import. Attendees running in bolt.new may see
the chooser artwork and fonts missing; that is the platform, not the repo.
