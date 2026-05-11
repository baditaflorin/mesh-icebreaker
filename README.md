# mesh-icebreaker

[![Live](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh--icebreaker-c97cc9?style=flat-square)](https://baditaflorin.github.io/mesh-icebreaker/)
[![Version](https://img.shields.io/github/package-json/v/baditaflorin/mesh-icebreaker?style=flat-square&color=c97cc9)](https://github.com/baditaflorin/mesh-icebreaker/blob/main/package.json)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![No backend](https://img.shields.io/badge/backend-none-1a160a?style=flat-square)](docs/adr/0001-deployment-mode.md)

> Curated icebreaker prompt decks with round-robin and anonymous commit-reveal modes. Kickoffs, retros, year-end reviews, conflict resets.

**Live:** https://baditaflorin.github.io/mesh-icebreaker/

Four bundled decks — _First 30 days_, _Creative pairings_, _The last bug_, _What made you laugh_ — each 8–10 prompts written to sound like questions a team would actually use rather than placeholder filler. Everyone in a room sees the same prompt, big and centered, on their phone. In **round-robin** mode the app derives whose turn it is from the join order; tapping "Next prompt" advances the index for everyone. In **anonymous** mode, each peer types into their own phone and locks in; the app reveals all answers once every peer has locked in.

The decks are static JSON, bundled at build time. The app's one mode-A trick is that the entire meeting state (deck, prompt index, mode, roster, anonymous answers) lives in a shared Yjs document — anyone can press "next" or change the deck, no designated host.

## How it works

- One Yjs document per room. `Y.Map("state")` holds `{ deckId, promptIndex, mode }`. `Y.Map("roster")` holds `{ name, order }` keyed by peerId. `Y.Array("answers")` holds anonymous lock-ins.
- Speaker = `roster[promptIndex mod roster.length]` after sorting by `order`. Order is assigned at first join time as `max(existing) + 1`. A "Reshuffle" button generates a new random ordering if the join order produces awkward sequences.
- `peerId` is `crypto.randomUUID()` persisted to localStorage so reloads keep your slot in the roster.

## Privacy threat model

See [docs/privacy.md](docs/privacy.md). Names are _not_ anonymous — that's the point of round-robin mode. Anonymous mode keeps answer-to-peer mapping out of the UI but the underlying `Y.Array` is unkeyed and append-only, which means the peer who _wrote_ an answer cannot be derived from the document state once the reveal happens.

## Architecture

- **Mode A** — pure GitHub Pages.
- **WebRTC** — Yjs + y-webrtc with self-hosted signaling and TURN.

## Run it locally

```bash
git clone https://github.com/baditaflorin/mesh-icebreaker.git
cd mesh-icebreaker
npm install
npm run dev
```

## Adding a deck

Drop a new JSON file in `src/features/icebreaker/decks/` with shape `{ name, prompts: string[] }`, import it in `decks/index.ts`, rebuild. No backend, no auth — decks are part of the static bundle. See [ADR 0002](docs/adr/0002-decks-are-static.md).

## Self-hosted infrastructure

| Repo                                                                   | Endpoint                               | Role                      |
| ---------------------------------------------------------------------- | -------------------------------------- | ------------------------- |
| [signaling-server](https://github.com/baditaflorin/signaling-server)   | `wss://turn.0docker.com/ws`            | y-webrtc protocol fan-out |
| [turn-token-server](https://github.com/baditaflorin/turn-token-server) | `https://turn.0docker.com/credentials` | HMAC TURN creds           |
| [coturn-hetzner](https://github.com/baditaflorin/coturn-hetzner)       | `turn:turn.0docker.com:3479`           | TURN relay                |

## ADRs

- [0001 — Deployment mode](docs/adr/0001-deployment-mode.md)
- [0002 — Decks are static JSON, bundled at build](docs/adr/0002-decks-are-static.md)
- [0003 — Round-robin order from roster join time](docs/adr/0003-round-robin-order.md)
- [0010 — GitHub Pages publishing](docs/adr/0010-pages-publishing.md)

## License

[MIT](LICENSE) © 2026 Florin Badita
