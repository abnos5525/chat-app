import { useEffect, useRef } from "react";
import { Button, Input } from "antd";
import { SendOutlined } from "@ant-design/icons";

const Chat = ({
  messages,
  message,
  setMessage,
  handleKeyPress,
  sendMessage,
  status,
}) => {
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const animationFrameId = requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight - container.clientHeight;
    });
    return () => cancelAnimationFrame(animationFrameId);
  }, [messages]);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white">
      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="h-96 overflow-y-auto p-4 bg-gray-50 flex flex-col gap-3"
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`max-w-[70%] px-4 py-2 rounded-lg break-words ${
              msg.sender === "local"
                ? "self-end bg-green-100 rounded-br-none"
                : "self-start bg-gray-200 rounded-bl-none"
            }`}
          >
            <div>{msg.text}</div>
            <div className="text-xs text-gray-500 text-right mt-1">
              {msg.timestamp}
            </div>
          </div>
        ))}
      </div>

      {/* Message Input Area */}
      <div className="flex items-center gap-2 p-3 border-t border-gray-200 bg-white">
        <Input.TextArea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          disabled={status !== "connected"}
          autoSize={{ minRows: 1, maxRows: 4 }}
          className="flex-1 rounded-full border border-gray-300 p-2 focus:ring focus:ring-blue-200"
        />
        <Button
          icon={<SendOutlined />}
          onClick={sendMessage}
          disabled={status !== "connected" || !message.trim()}
          className={`rounded-full px-4 py-2 ${
            status === "connected" && message.trim()
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        />
      </div>
    </div>
  );
};

export default Chat;
