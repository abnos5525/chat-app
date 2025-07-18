import { useEffect, useRef } from "react";
import { Button, Input } from "antd";
import { SendOutlined } from "@ant-design/icons";
import type { Message } from "../../types/chat";

// Props type
interface ChatProps {
  messages: Message[];
  message: string;
  setMessage: (msg: string) => void;
  handleKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  sendMessage: () => void;
  status: string;
}

const MessageBubble = ({ msg }: { msg: Message }) => (
  <div
    className={`max-w-[70%] px-5 py-3 rounded-2xl shadow-sm break-words transition-all duration-200 text-base font-medium select-text
      ${msg.sender === "local"
        ? "self-end bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-br-md"
        : "self-start bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-900 text-gray-900 dark:text-gray-100 rounded-bl-md border border-gray-300 dark:border-gray-700"
      }`}
  >
    <div className="whitespace-pre-line leading-relaxed">
      {msg.text}
    </div>
    <div className="text-xs mt-2 font-normal text-gray-500 dark:text-gray-400 text-right">
      {msg.timestamp}
    </div>
  </div>
);

const Chat = ({
  messages,
  message,
  setMessage,
  handleKeyPress,
  sendMessage,
  status,
}: ChatProps) => {
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const animationFrameId = requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight - container.clientHeight;
    });
    return () => cancelAnimationFrame(animationFrameId);
  }, [messages]);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-lg bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="h-96 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-800 flex flex-col gap-4"
      >
        {messages.map((msg, index) => (
          <MessageBubble key={index} msg={msg} />
        ))}
      </div>

      {/* Message Input Area */}
      <div className="flex items-center gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <Input.TextArea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          disabled={status !== "connected"}
          autoSize={{ minRows: 1, maxRows: 4 }}
          className="flex-1 rounded-2xl border border-gray-300 dark:border-gray-700 p-3 focus:ring-2 focus:ring-blue-400 bg-white text-gray-900 dark:bg-gray-800 dark:text-white transition-all duration-200 placeholder-gray-400 dark:placeholder-gray-500"
        />
        <Button
          onClick={sendMessage}
          disabled={status !== "connected" || !message.trim()}
          className={`rounded-full px-5 py-3 shadow-md text-lg flex items-center justify-center transition-all duration-200
            ${status === "connected" && message.trim()
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
            }`}
          size="large"
          type="primary"
          icon={<SendOutlined style={{ color: status === "connected" && message.trim() ? '#fff' : 'var(--gray-400, #9ca3af)' }} />}
        />
      </div>
    </div>
  );
};

export default Chat;
