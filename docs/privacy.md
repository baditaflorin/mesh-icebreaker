# Privacy threat model — mesh-icebreaker

This app is _not_ anonymous by default. In round-robin mode the whole point is that everyone knows whose turn it is, which means names are visible. Anonymous mode adds limited unlinkability for answers, described below.

## What other peers in the same room can see

- The shared **state** (`{ deckId, promptIndex, mode }`).
- The shared **roster** (`Y.Map<peerId, { name, order }>`).
  - Your **display name** is visible to all peers in round-robin mode (that's the feature).
  - Your `peerId` is a `crypto.randomUUID()` persisted to localStorage; it's not tied to your name or IP at the app layer.
- The shared **answers** array (anonymous-mode lock-ins). The array is unkeyed — each entry is just `{ promptIdx, answer }` with no `peerId`. Once an answer is appended, the document state does not reveal who wrote it.

## What stays local

- Your `peerId` and your display name (localStorage).
- Your draft answer while you're typing (in component state, not published until you press "Lock in").
- Your room ID and infra overrides (localStorage).

## What the signaling server sees

`signaling-server` (https://github.com/baditaflorin/signaling-server) sees:

- The **room name** (`mesh-icebreaker:<roomId>`).
- Encrypted SDP blobs relayed between peers.
- The IP address of each peer's WebSocket connection.

It does **not** see prompt advancement, names, or answers.

## What the TURN server sees

`coturn-hetzner` (https://github.com/baditaflorin/coturn-hetzner) relays encrypted WebRTC data when peers can't connect directly. It sees IP addresses of the two relayed peers and encrypted bytes it cannot decrypt.

## Permissions asked

None. No camera, microphone, motion, or notifications.

## Anonymous mode caveats

- **Order of arrival is observable on the wire.** A peer with packet-capture tooling, watching the WebRTC DataChannel in real time, could attribute the first answer to the first peer that transmitted. The Yjs `Y.Array` insertion is naturally ordered; the document doesn't record "who" but the network does, in the moments before the reveal.
- **Mitigation:** the simplest is to wait until the room is silent and everyone presses "Lock in" within a few seconds of each other; the practical correlation gets harder as the lock-in window narrows.
- **Stronger anonymity** would use a commit-reveal pattern with SHA-256 commitments published first and plaintexts revealed only after all commitments are in. That's a v2 feature; see `mesh-mafia/src/features/mafia/crypto.ts` for the primitives that would back it.

## Names are deliberately visible

The "whose turn is it" affordance in round-robin mode is the whole product. Hiding names there would defeat the purpose. If a team needs strict anonymity, switch to anonymous mode and accept the network-timing caveat above.
