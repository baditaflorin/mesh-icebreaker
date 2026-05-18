export const appConfig = {
  appName: "mesh-icebreaker",
  storagePrefix: "mesh-icebreaker",
  description:
    "Curated icebreaker prompt decks with round-robin and anonymous commit-reveal modes. Kickoffs, retros, year-end reviews, conflict resets.",
  accentHex: "#C97CC9",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
  repositoryUrl: "https://github.com/baditaflorin/mesh-icebreaker",
  pagesUrl: "https://baditaflorin.github.io/mesh-icebreaker/",
  signalingUrl:
    (import.meta.env.VITE_WEBRTC_SIGNALING as string | undefined) ?? "wss://turn.0docker.com/ws",
  turnTokenUrl:
    (import.meta.env.VITE_TURN_TOKEN_URL as string | undefined) ??
    "https://turn.0docker.com/credentials",
  paypalUrl: "https://www.paypal.com/paypalme/florinbadita",
} as const;
