export interface PendingConnection {
  initiatorCode: string;
  targetCode: string;
  initiatorSocketId: string;
  timestamp: number;
}

export interface ActiveConnection {
  initiatorSocketId: string;
  targetSocketId: string;
}

export interface RequestTracking {
  timestamp: number;
  count: number;
  rejected: boolean;
}

export interface ConnectionRequest {
  targetCode: string;
  fromCode: string;
}

export interface ConnectionResponse {
  requestId: string;
  accepted: boolean;
}

// WebRTC Types
export interface RTCSessionDescription {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface RTCIceCandidate {
  candidate: string;
  sdpMLineIndex: number;
  sdpMid: string;
  usernameFragment?: string;
}

export interface WebRTCOffer {
  connectionId: string;
  offer: RTCSessionDescription;
}

export interface WebRTCAnswer {
  connectionId: string;
  answer: RTCSessionDescription;
}

export interface WebRTCIceCandidatePayload {
  connectionId: string;
  candidate: RTCIceCandidate;
}
