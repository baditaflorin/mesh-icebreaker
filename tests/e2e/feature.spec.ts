import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
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
async function connect(page: import("@playwright/test").Page, name: string) {
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
    await connect(a, "Ana");
    await connect(b, "Bob");

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
    await connect(a, "Ana");
    await connect(b, "Bob");

    // Switch to anonymous mode from peer A; mode is shared, so B follows.
    await a.locator(".ice-controls details").first().click(); // open "Deck & mode"
    await a.locator(".ice-controls select").nth(1).selectOption("anonymous");

    // Both peers now see the anonymous answer box.
    await expect(a.locator(".ice-anon textarea")).toBeVisible();
    await expect(b.locator(".ice-anon textarea")).toBeVisible();

    // Before everyone locks in, no reveal is shown on either peer.
    await expect(b.locator(".ice-reveal")).toHaveCount(0);

    // Peer A locks in. Reveal must NOT appear yet (B hasn't answered).
    await a.locator(".ice-anon textarea").fill("answer-from-ana");
    await a.locator(".ice-lockin").click();
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
