import { expect, test, type Page } from "@playwright/test";
import { openNPeers, openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

// First deck ("First 30 days") — prompt 0 and prompt 1, copied verbatim so the
// assertion is exact, not a substring guess.
const PROMPT_0 = "What's something you expected to be hard that turned out to be easy?";
const PROMPT_1 = "What's a tool whose name is unintuitive — and what would you rename it to?";

/**
 * Load-bearing cross-peer assertions for the two advertised core actions:
 *
 *  1. Round-robin: the whole meeting state (deck, prompt index, mode) lives in
 *     a shared Yjs doc — "tapping Next prompt advances the index for everyone."
 *  2. Anonymous commit-reveal: each peer locks in an answer; once everyone has
 *     locked in, all answers reveal.
 *
 * Both peers must type a name before Connect (the button is disabled until a
 * name is set) — the openTwoPeers helper only seeds room+signaling, not name.
 */
/**
 * `openTwoPeers` opens both pages in ONE browser context, so they share
 * localStorage — including the persisted `<prefix>:peerId`. Without help, both
 * peers would land on the SAME roster identity and the room would think it has
 * a single participant, hiding the multi-peer roster / reveal behavior. We seed
 * a DISTINCT peerId into each page and reload so the room genuinely has two
 * separate roster slots — the real shape of two phones in a meeting.
 */
async function connect(page: Page, name: string, peerId: string): Promise<void> {
  await page.evaluate(({ id, prefix }) => localStorage.setItem(`${prefix}:peerId`, id), {
    id: peerId,
    prefix: storagePrefix,
  });
  await page.reload();
  const nameInput = page.locator(".ice-name-input input");
  await nameInput.fill(name);
  await page.getByRole("button", { name: /^connect$/i }).click();
  // Wait until armed: the prompt stage is shown.
  await expect(page.locator(".ice-prompt-text")).toBeVisible();
}

test("round-robin: Next prompt on peer A advances peer B's prompt", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await connect(a, "Ana", "peer-ana");
    await connect(b, "Bob", "peer-bob");

    // Both peers start on prompt 0.
    await expect(a.locator(".ice-prompt-text")).toHaveText(PROMPT_0);
    await expect(b.locator(".ice-prompt-text")).toHaveText(PROMPT_0);

    // Peer A taps "Next prompt".
    await a.getByRole("button", { name: /next prompt/i }).click();

    // The load-bearing cross-peer assertion: peer B — which never tapped
    // anything — sees the prompt advance because promptIndex lives in the
    // shared Y.Map("state"). Fails if the index went to local state only.
    await expect(b.locator(".ice-prompt-text")).toHaveText(PROMPT_1);
    await expect(a.locator(".ice-prompt-text")).toHaveText(PROMPT_1);
  } finally {
    await cleanup();
  }
});

test("anonymous: answers reveal on the opposite peer once everyone locks in", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await connect(a, "Ana", "peer-ana");
    await connect(b, "Bob", "peer-bob");

    // Two distinct roster slots are present — the reveal gate must wait for
    // BOTH, not fire after a single lock-in.
    await expect(a.locator(".ice-hud")).toContainText("2 here");
    await expect(b.locator(".ice-hud")).toContainText("2 here");

    // Switch to anonymous mode from peer A; mode is shared, so B follows.
    await a.locator(".ice-controls details").first().click(); // open "Deck & mode"
    await a.locator(".ice-controls select").nth(1).selectOption("anonymous");

    // Both peers now see the anonymous answer box.
    await expect(a.locator(".ice-anon textarea")).toBeVisible();
    await expect(b.locator(".ice-anon textarea")).toBeVisible();

    // Before everyone locks in, no reveal is shown on either peer.
    await expect(b.locator(".ice-reveal")).toHaveCount(0);

    // Peer A locks in. Reveal must NOT appear yet — with two present peers the
    // gate is "1/2 locked", so B's answer is still pending.
    await a.locator(".ice-anon textarea").fill("answer-from-ana");
    await a.locator(".ice-lockin").click();
    await expect(b.locator(".ice-anon-help")).toContainText("1/2");
    await expect(b.locator(".ice-reveal")).toHaveCount(0);

    // Peer B locks in. Now every peer in the roster has locked in.
    await b.locator(".ice-anon textarea").fill("answer-from-bob");
    await b.locator(".ice-lockin").click();

    // Load-bearing cross-peer assertion: peer B sees BOTH answers revealed —
    // including Ana's, which only crosses via the shared Y.Array("answers").
    const bReveal = b.locator(".ice-reveal");
    await expect(bReveal).toBeVisible();
    await expect(bReveal.getByText("answer-from-ana")).toBeVisible();
    await expect(bReveal.getByText("answer-from-bob")).toBeVisible();

    // And peer A sees both too (reciprocal direction).
    const aReveal = a.locator(".ice-reveal");
    await expect(aReveal.getByText("answer-from-ana")).toBeVisible();
    await expect(aReveal.getByText("answer-from-bob")).toBeVisible();
  } finally {
    await cleanup();
  }
});

/**
 * Regression: the roster Y.Map is durable and never pruned, so a peer who
 * joined and then closed their tab lingers in it forever. The anonymous reveal
 * gate must wait for everyone *present* to lock in — NOT everyone who ever
 * joined — otherwise a single drop-out seals the answers permanently and the
 * advertised "reveals once every peer has locked in" silently never fires.
 *
 * Three peers join (roster grows to 3). The third leaves. The remaining two
 * lock in and the reveal must appear — it would hang at "2/3 locked" forever
 * if the gate counted the ghost.
 */
test("a departed peer does not block the anonymous reveal for those still present", async ({
  browser,
  baseURL,
}) => {
  const { peers, cleanup } = await openNPeers(browser, baseURL ?? "", {
    storagePrefix,
    count: 3,
  });
  try {
    const [a, b, c] = peers as [Page, Page, Page];
    await connect(a, "Ana", "peer-ana");
    await connect(b, "Bob", "peer-bob");
    await connect(c, "Cay", "peer-cay");

    // All three are present and in the roster.
    await expect(a.locator(".ice-hud")).toContainText("3 here");

    // Switch to anonymous mode (shared via Y.Map state).
    await a.locator(".ice-controls details").first().click();
    await a.locator(".ice-controls select").nth(1).selectOption("anonymous");
    await expect(a.locator(".ice-anon textarea")).toBeVisible();
    await expect(b.locator(".ice-anon textarea")).toBeVisible();

    // The third peer leaves the room. Navigating away unmounts the React tree,
    // which runs the cleanup effect `provider.destroy()` → y-webrtc removes the
    // peer's awareness state cleanly. Its roster entry stays in the durable
    // Y.Map, but awareness drops it from the present set.
    await c.goto("about:blank");

    // The two survivors converge on "2 here" — the ghost is gone from presence.
    await expect(a.locator(".ice-hud")).toContainText("2 here");
    await expect(b.locator(".ice-hud")).toContainText("2 here");

    // Both present peers lock in. The reveal gate is now 2/2, not 2/3.
    await a.locator(".ice-anon textarea").fill("ana-answer");
    await a.locator(".ice-lockin").click();
    await b.locator(".ice-anon textarea").fill("bob-answer");
    await b.locator(".ice-lockin").click();

    // The load-bearing assertion: the reveal fires for the present peers even
    // though a roster member departed. Before the present-set fix this would
    // stay sealed at "2/3 locked" indefinitely.
    const reveal = b.locator(".ice-reveal");
    await expect(reveal).toBeVisible();
    await expect(reveal.getByText("ana-answer")).toBeVisible();
    await expect(reveal.getByText("bob-answer")).toBeVisible();
  } finally {
    await cleanup();
  }
});
