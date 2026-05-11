import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { createRoomSync, type RoomSync } from "../sync/yjsRoom";
import { maybeFetchTurnCredentials } from "../sync/iceConfig";
import { DECKS, findDeck } from "./decks";

type Mode = "round-robin" | "anonymous";
type State = { deckId: string; promptIndex: number; mode: Mode };
type RosterEntry = { name: string; order: number };
type Answer = { promptIdx: number; answer: string };

type Props = {
  roomId: string;
  peerId: string;
  myName: string;
  onNameChange: (n: string) => void;
};

export function Icebreaker({ roomId, peerId, myName, onNameChange }: Props) {
  const [armed, setArmed] = useState(false);
  const [state, setState] = useState<State>({
    deckId: DECKS[0]!.id,
    promptIndex: 0,
    mode: "round-robin",
  });
  const [roster, setRoster] = useState<Map<string, RosterEntry>>(new Map());
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [peers, setPeers] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [locked, setLocked] = useState(false);

  const room = useMemo<RoomSync | null>(() => {
    if (!armed) return null;
    return createRoomSync(roomId);
  }, [armed, roomId]);

  useEffect(() => {
    if (!armed) return;
    void maybeFetchTurnCredentials();
  }, [armed]);

  useEffect(() => {
    return () => {
      room?.provider?.destroy();
    };
  }, [room]);

  const stateMapRef = useRef<Y.Map<unknown> | null>(null);
  const rosterMapRef = useRef<Y.Map<RosterEntry> | null>(null);
  const answersArrRef = useRef<Y.Array<Answer> | null>(null);

  useEffect(() => {
    if (!room) return;
    const doc = room.doc;
    const yState = doc.getMap<unknown>("state");
    const yRoster = doc.getMap<RosterEntry>("roster");
    const yAnswers = doc.getArray<Answer>("answers");
    stateMapRef.current = yState;
    rosterMapRef.current = yRoster;
    answersArrRef.current = yAnswers;

    doc.transact(() => {
      if (!yState.has("deckId")) yState.set("deckId", DECKS[0]!.id);
      if (!yState.has("promptIndex")) yState.set("promptIndex", 0);
      if (!yState.has("mode")) yState.set("mode", "round-robin");
    });

    const refreshState = () => {
      setState({
        deckId: (yState.get("deckId") as string) ?? DECKS[0]!.id,
        promptIndex: (yState.get("promptIndex") as number) ?? 0,
        mode: (yState.get("mode") as Mode) ?? "round-robin",
      });
    };
    const refreshRoster = () => {
      const next = new Map<string, RosterEntry>();
      yRoster.forEach((v, k) => next.set(k, v));
      setRoster(next);
    };
    const refreshAnswers = () => setAnswers(yAnswers.toArray());

    refreshState();
    refreshRoster();
    refreshAnswers();
    yState.observe(refreshState);
    yRoster.observe(refreshRoster);
    yAnswers.observe(refreshAnswers);

    // Join roster
    const existing = yRoster.get(peerId);
    const maxOrder = Math.max(0, ...Array.from(yRoster.values()).map((r) => r.order));
    if (!existing) {
      yRoster.set(peerId, { name: myName || `peer-${peerId.slice(0, 4)}`, order: maxOrder + 1 });
    } else if (myName && existing.name !== myName) {
      yRoster.set(peerId, { ...existing, name: myName });
    }

    const awareness = room.provider?.awareness;
    const updatePeerCount = () => {
      setPeers(awareness ? awareness.getStates().size : 1);
    };
    awareness?.on("change", updatePeerCount);
    updatePeerCount();

    return () => {
      yState.unobserve(refreshState);
      yRoster.unobserve(refreshRoster);
      yAnswers.unobserve(refreshAnswers);
      awareness?.off("change", updatePeerCount);
    };
  }, [room, peerId, myName]);

  // Update roster name when user edits name post-join
  useEffect(() => {
    const yRoster = rosterMapRef.current;
    if (!yRoster) return;
    const entry = yRoster.get(peerId);
    if (entry && myName && entry.name !== myName) {
      yRoster.set(peerId, { ...entry, name: myName });
    }
  }, [myName, peerId]);

  function setDeck(deckId: string) {
    const yState = stateMapRef.current;
    if (!yState) return;
    yState.doc?.transact(() => {
      yState.set("deckId", deckId);
      yState.set("promptIndex", 0);
    });
    clearAnswers();
  }
  function setMode(mode: Mode) {
    const yState = stateMapRef.current;
    if (!yState) return;
    yState.set("mode", mode);
    clearAnswers();
  }
  function nextPrompt() {
    const yState = stateMapRef.current;
    if (!yState) return;
    const cur = (yState.get("promptIndex") as number) ?? 0;
    yState.set("promptIndex", cur + 1);
    setLocked(false);
    setDraftAnswer("");
    clearAnswers();
  }
  function reshuffle() {
    const yRoster = rosterMapRef.current;
    if (!yRoster) return;
    const entries = Array.from(yRoster.entries());
    // Fisher-Yates
    const order = entries.map((_, i) => i + 1);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    yRoster.doc?.transact(() => {
      entries.forEach(([k, v], i) => {
        yRoster.set(k, { ...v, order: order[i]! });
      });
    });
  }
  function clearAnswers() {
    const yAnswers = answersArrRef.current;
    if (!yAnswers) return;
    yAnswers.doc?.transact(() => {
      if (yAnswers.length > 0) yAnswers.delete(0, yAnswers.length);
    });
  }

  function submitAnswer() {
    const yAnswers = answersArrRef.current;
    if (!yAnswers) return;
    const text = draftAnswer.trim();
    if (!text) return;
    yAnswers.push([{ promptIdx: state.promptIndex, answer: text }]);
    setLocked(true);
  }

  const deck = findDeck(state.deckId);
  const promptIdx = state.promptIndex % Math.max(1, deck.prompts.length);
  const prompt = deck.prompts[promptIdx] ?? "(no prompts in this deck)";

  // Round-robin speaker
  const rosterByOrder = useMemo(() => {
    return Array.from(roster.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.order - b.order);
  }, [roster]);
  const speaker = rosterByOrder[state.promptIndex % Math.max(1, rosterByOrder.length)];
  const lockedInCount = answers.filter((a) => a.promptIdx === state.promptIndex).length;
  const myAnswered = answers.some(
    (a) => a.promptIdx === state.promptIndex && a.answer === draftAnswer.trim() && locked,
  );

  if (!armed) {
    return (
      <div className="ice-arm">
        <h1>mesh-icebreaker</h1>
        <p>
          Curated prompt decks for team kickoffs, retros, year-end reviews, conflict resets. Pick
          round-robin (one speaker per prompt) or anonymous (everyone answers, lock-in reveals).
        </p>
        <label className="ice-name-input">
          <span>Your name</span>
          <input value={myName} onChange={(e) => onNameChange(e.target.value)} placeholder="Alex" />
        </label>
        <button
          type="button"
          className="ice-arm-button"
          onClick={() => setArmed(true)}
          disabled={!myName.trim()}
        >
          Connect
        </button>
        <p className="ice-hint">
          Room <code>{roomId}</code>
        </p>
      </div>
    );
  }

  return (
    <div className="ice-stage">
      <div className="ice-hud">
        <span>{peers} phones</span>
        <span>·</span>
        <span>{rosterByOrder.length} in roster</span>
        <span>·</span>
        <span>{deck.name}</span>
        <span>·</span>
        <span>
          {promptIdx + 1}/{deck.prompts.length}
        </span>
      </div>

      <section className="ice-prompt">
        <p className="ice-deck-name">{deck.name}</p>
        <h2 className="ice-prompt-text">{prompt}</h2>
        {state.mode === "round-robin" && speaker && (
          <p className="ice-speaker">
            <span className="ice-speaker-label">whose turn:</span>
            <span className="ice-speaker-name">{speaker.name}</span>
          </p>
        )}
      </section>

      {state.mode === "anonymous" && (
        <section className="ice-anon">
          <p className="ice-anon-help">
            Answers stay sealed until everyone locks in. {lockedInCount}/{rosterByOrder.length}{" "}
            locked.
          </p>
          {!myAnswered ? (
            <>
              <textarea
                value={draftAnswer}
                onChange={(e) => setDraftAnswer(e.target.value)}
                placeholder="Type your answer…"
                rows={3}
              />
              <button
                type="button"
                className="ice-lockin"
                onClick={submitAnswer}
                disabled={!draftAnswer.trim() || locked}
              >
                {locked ? "Locked in" : "Lock in"}
              </button>
            </>
          ) : (
            <p className="ice-locked-msg">You've locked in. Waiting for others…</p>
          )}
          {lockedInCount >= rosterByOrder.length && rosterByOrder.length > 0 && (
            <div className="ice-reveal">
              <h3>All answers</h3>
              <ul>
                {answers
                  .filter((a) => a.promptIdx === state.promptIndex)
                  .map((a, i) => (
                    <li key={i}>{a.answer}</li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="ice-actions">
        <button type="button" className="ice-next" onClick={nextPrompt}>
          Next prompt →
        </button>
      </div>

      <section className="ice-controls">
        <details>
          <summary>Deck & mode</summary>
          <label>
            <span>Deck</span>
            <select value={state.deckId} onChange={(e) => setDeck(e.target.value)}>
              {DECKS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Mode</span>
            <select value={state.mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="round-robin">Round-robin (one speaker per prompt)</option>
              <option value="anonymous">Anonymous (commit-reveal)</option>
            </select>
          </label>
          <button type="button" className="ice-shuffle" onClick={reshuffle}>
            Reshuffle order
          </button>
        </details>

        <details>
          <summary>Roster ({rosterByOrder.length})</summary>
          <ol className="ice-roster">
            {rosterByOrder.map((r) => (
              <li key={r.id} className={r.id === peerId ? "ice-roster-me" : undefined}>
                {r.name}
                {r.id === peerId ? " (you)" : ""}
              </li>
            ))}
          </ol>
        </details>
      </section>
    </div>
  );
}
