import { App, Button, Input } from "antd";
import { getStatusText, statuses } from "./utils";
import Chat from "./components/chat";
import { useChatConnection } from "./hooks/useChatConnection";

const AppChat = () => {
  const { notification } = App.useApp();
  const {
    state,
    joinRoom,
    sendMessage,
    handleKeyPress,
    setRoomId,
    setMessage,
  } = useChatConnection({ notification });

  return (
    <div className="container mx-auto max-w-3xl bg-white p-6 rounded-xl shadow-md">
      <h1 className="text-2xl font-bold text-center text-blue-800 mb-6">
        Web App Chat
      </h1>

      {state.status === "disconnected" && (
        <div className="flex gap-2 mb-6">
          <Input
            value={state.roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter room ID"
            className="flex-1 border border-gray-300 rounded px-4 py-2"
          />
          <Button
            onClick={joinRoom}
            type="primary"
            className="bg-blue-500 hover:bg-blue-600"
          >
            Join Room
          </Button>
        </div>
      )}

      <div
        className={`text-center py-2 mb-4 rounded font-bold ${
          state.status === "disconnected"
            ? "bg-red-500 text-white"
            : state.status === "waiting"
            ? "bg-yellow-500 text-white"
            : state.status === "connecting"
            ? "bg-blue-500 text-white"
            : state.status === "connected"
            ? "bg-green-500 text-white"
            : "bg-gray-300"
        }`}
      >
        Status: {getStatusText(state.status)}
      </div>

      {state.error && (
        <div className="p-3 mb-4 bg-red-100 text-red-800 rounded border border-red-300">
          {state.error}
        </div>
      )}

      {state.status !== "disconnected" && (
        <Chat
          messages={state.messages}
          message={state.message}
          setMessage={setMessage}
          handleKeyPress={handleKeyPress}
          sendMessage={sendMessage}
          status={state.status}
        />
      )}
    </div>
  );
};

export default AppChat;
