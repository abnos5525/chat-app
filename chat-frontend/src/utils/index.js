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
};

export const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

// Status display text
export const getStatusText = (status) => {
  switch (status) {
    case statuses.disconnected:
      return statuses.disconnected;
    case statuses.joining:
      return statuses.joining;
    case statuses.waiting:
      return statuses.waiting;
    case statuses.connecting:
      return statuses.connecting;
    case statuses.connected:
      return statuses.connected;
    case statuses.closed:
      return statuses.closed;
    default:
      return status.toUpperCase();
  }
};
