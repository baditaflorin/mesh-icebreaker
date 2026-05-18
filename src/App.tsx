import { useEffect, useState } from "react";
import { Icebreaker } from "./features/icebreaker/Icebreaker";
import { SettingsDrawer } from "./features/settings/SettingsDrawer";
import { appConfig } from "./shared/config";
import { InviteShareButton } from "@baditaflorin/mesh-common";

const STORAGE = {
  room: `${appConfig.storagePrefix}:room`,
  peerId: `${appConfig.storagePrefix}:peerId`,
  name: `${appConfig.storagePrefix}:name`,
};

function readString(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback;
}

function ensurePeerId(): string {
  const existing = localStorage.getItem(STORAGE.peerId);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  localStorage.setItem(STORAGE.peerId, fresh);
  return fresh;
}

export function App() {
  const [roomId, setRoomId] = useState(() => readString(STORAGE.room, "default"));
  const [peerId] = useState(() => ensurePeerId());
  const [myName, setMyName] = useState(() => readString(STORAGE.name, ""));
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE.room, roomId);
  }, [roomId]);
  useEffect(() => {
    localStorage.setItem(STORAGE.name, myName);
  }, [myName]);

  return (
    <div className="app-root">
      <Icebreaker roomId={roomId} peerId={peerId} myName={myName} onNameChange={setMyName} />

      <InviteShareButton appName={appConfig.appName} roomId={roomId} />
      <button
        type="button"
        className="settings-fab"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
      >
        ⚙
      </button>

      <div className="self-ref">
        <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
          source
        </a>
        <span aria-hidden="true">·</span>
        <a href={appConfig.paypalUrl} target="_blank" rel="noreferrer">
          tip ♥
        </a>
        <span aria-hidden="true">·</span>
        <span>
          v{appConfig.version} · {appConfig.commit}
        </span>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomId={roomId}
        onRoomChange={setRoomId}
        myName={myName}
        onNameChange={setMyName}
        peerId={peerId}
      />
    </div>
  );
}
