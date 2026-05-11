---
status: accepted
date: 2026-05-12
---

# 0002 — Decks are static JSON, bundled at build

## Context

The app needs prompt content. There are three reasonable places to put it: bundled into the build, fetched from a server, or pasted/uploaded by the user at runtime. The app is Mode A (pure GitHub Pages — see ADR 0001), which already forecloses a server. So the choice is between baked-in decks and a runtime upload path.

## Decision

Decks are **static JSON files in `src/features/icebreaker/decks/`**, imported at build time via Vite's JSON import. Adding or editing a deck is a code change: drop a JSON file with shape `{ name, prompts: string[] }`, import it from `decks/index.ts`, rebuild, deploy.

Four decks ship in v1:

- `first-30-days.json` — onboarding prompts
- `creative-pairings.json` — collaboration prompts
- `the-last-bug.json` — recent-incident retro prompts
- `what-made-you-laugh.json` — levity / morale prompts

## Consequences

- **Pros.** The deploy artifact is a single static bundle. No backend, no API to authenticate against, no user-content moderation surface. The decks are the same on every device that loads the same version of the app.
- **Pros.** Decks are reviewable in git history. A team can fork the repo, add their own decks, deploy their own Pages site.
- **Pros.** Prompts are vetted before they ship. There's no "someone pasted an offensive prompt mid-meeting" failure mode.
- **Cons.** Adding a deck requires a code change and a rebuild. For most teams this is fine because the four bundled decks already cover the common cases; for teams that want their own custom prompts, forking is the path.
- **Cons.** No mid-meeting deck customization. If the team wants to riff on a prompt, they have to do it verbally; the app's content is fixed.

## Alternatives considered

- **User-pasted decks via textarea.** Considered. Would broaden the use case but adds a UI for paste, validation, sharing the pasted deck across peers (would need to go into the Yjs doc), and a small content-moderation problem if the pasted content is offensive. Punted to v2.
- **Decks fetched from a CDN at first load.** Considered. Would let decks be updated without redeploying the app, but adds a runtime fetch dependency on an external resource. Mode A's whole point is "no external dependencies after the static load." Rejected.
- **Decks editable in Settings, persisted to localStorage.** Considered. Useful for one person's recurring use, but breaks the "everyone in the room sees the same deck" contract — the deck for the room would have to live in the Yjs doc, which lands us back at the user-paste design.

## Future variant

If user-supplied decks ship in v2, the right shape is probably: paste JSON or a URL into Settings, deck goes into the Yjs doc keyed by content hash, peers fetch deck content from the doc rather than from imports. Backwards-compatible with bundled decks (they'd just be the default).
