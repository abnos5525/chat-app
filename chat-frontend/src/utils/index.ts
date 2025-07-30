export const statuses = {
  disconnected: "disconnected",
  joining: "joining",
  joined: "joined",
  ready: "ready",
  offer: "offer",
  answer: "answer",
  ice_candidate: "ice-candidate",
  room_full: "room-full",
  peer_disconnected: "peer-disconnected",
  join_error: "join-error",
  waiting: "waiting",
  failed: "failed",
  connecting: "connecting",
  connected: "connected",
  closed: "closed",
} as const;

export const iceServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

export const getStatusText = (status: string): string => {
  return Object.values(statuses).includes(status as any)
    ? status
    : status.charAt(0).toUpperCase() + status.slice(1);
};

// Generate unique 10-character token for user
export const generateUniqueToken = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 15; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};
