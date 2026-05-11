---
status: accepted
date: 2026-05-12
---

# 0003 — Round-robin order from roster join time

## Context

In round-robin mode the app needs to assign "whose turn is it" without a designated host. Options:

1. **First-joiner designated as host**, host advances prompts and picks speakers.
2. **Lottery per prompt** — randomize speaker on each "Next."
3. **Stable per-peer ordinal** assigned at join time; speaker is `roster[promptIndex mod n]` after sorting by ordinal.

Mode A architecture argues against designated roles where reasonable — they create reload-fragility (host reloads → who's host now?) and add a permission system that's overkill for a 2-hour exercise.

## Decision

Option 3. When a peer joins, its `roster` entry gets `order = max(existing orders) + 1`. The roster is rendered sorted by `order`. The current speaker is `rosterByOrder[promptIndex mod rosterByOrder.length]`.

Anyone can press "Next prompt" — there's no role gating. The prompt index increments for everyone. The speaker advances naturally.

A **Reshuffle order** button generates a new random ordering (Fisher-Yates) over the existing roster, for when the implicit join order produces awkward sequences. The current `promptIndex` is preserved; only the role-to-ordinal mapping changes.

## Consequences

- **Pros.** No host role. A peer leaving doesn't break the experience for everyone else — their slot is skipped silently in the modulo arithmetic (well, technically their row stays in the roster until they explicitly leave; in a 2-hour exercise this is fine).
- **Pros.** Stable across reloads of any individual peer, because the `peerId` is persisted to localStorage and the `roster` entry survives.
- **Pros.** Reshuffle is a single button, opt-in, doesn't require a UI for manual reordering.
- **Cons.** A peer who leaves and rejoins gets a new high ordinal, putting them at the end of the rotation. For a one-meeting exercise this is fine; for a recurring tool used across days it'd be wrong.
- **Cons.** Multiple peers joining simultaneously can race the `max(orders) + 1` computation if there's no Yjs round-trip between them. Yjs CRDT semantics will converge on a single value per peer, but two peers might get the same ordinal. We accept this — the chart still works (two peers share a slot, both speak), and Reshuffle resolves it permanently.

## Alternatives considered

- **First-joiner host.** Rejected for the reload-fragility reason above.
- **Lottery per prompt.** Rejected because predictability matters in this context — "Alex, then Sam, then me" lets people prep their answer mentally. Random would feel like a quiz show, not a team exercise.
- **Manual reorder UI.** Rejected as too much UI for a feature that Reshuffle already covers in 99% of cases. If a v2 needs manual control, it's a small addition.
- **Hash of `peerId` as deterministic ordinal.** Rejected — would put peers in the same order across every meeting, which is the opposite of what Reshuffle is for, and would let someone gaming the `peerId` always go first.
