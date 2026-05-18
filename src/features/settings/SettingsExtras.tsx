type Props = {
  myName: string;
  onNameChange: (next: string) => void;
  peerId: string;
};

export function SettingsExtras({ myName, onNameChange, peerId }: Props) {
  return (
    <>
      <label>
        <span>Your name</span>
        <input value={myName} onChange={(e) => onNameChange(e.target.value)} />
      </label>

      <p className="settings-help">
        Deck, mode, and reshuffle live on the main screen — they're shared with the room.
      </p>

      <p className="settings-help">
        Your peer id is <code>{peerId.slice(0, 8)}…</code> (random, persisted to this device).
      </p>
    </>
  );
}
