import { useEffect, useState } from "react";
import { MeshShell } from "@baditaflorin/mesh-common";
import { Icebreaker } from "./features/icebreaker/Icebreaker";
import { SettingsExtras } from "./features/settings/SettingsExtras";
import { appConfig } from "./shared/config";

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

  useEffect(() => {
    localStorage.setItem(STORAGE.room, roomId);
  }, [roomId]);
  useEffect(() => {
    localStorage.setItem(STORAGE.name, myName);
  }, [myName]);

  return (
    <MeshShell
      config={appConfig}
      roomId={roomId}
      onRoomChange={setRoomId}
      settingsExtras={<SettingsExtras myName={myName} onNameChange={setMyName} peerId={peerId} />}
    >
      <Icebreaker roomId={roomId} peerId={peerId} myName={myName} onNameChange={setMyName} />
    </MeshShell>
  );
}
