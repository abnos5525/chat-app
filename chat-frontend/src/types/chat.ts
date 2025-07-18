export interface Message {
  text: string;
  sender: "local" | "remote";
  timestamp: string;
} 