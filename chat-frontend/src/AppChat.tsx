import { App, Button, Input, ConfigProvider } from "antd";
import Chat from "./components/chat";
import { useChatConnection } from "./hooks/useChatConnection";
import { useTheme } from "./hooks/useTheme";
import ThemeSwitcher from "./components/ui/ThemeSwitcher";
import StatusBar from "./components/ui/StatusBar";

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

  const { isDark, getAntdAlgorithm, getAntdTokens } = useTheme();

  return (
    <ConfigProvider
      theme={{
        algorithm: getAntdAlgorithm(),
        token: getAntdTokens(),
      }}
    >
      <div
        className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-300 ${
          isDark
            ? "bg-gradient-to-br from-[#0a0f1a] via-[#181f2a] to-[#232b3a]"
            : "bg-gradient-to-br from-blue-100 via-white to-blue-200"
        }`}
      >
        <div className="w-full max-w-3xl bg-white dark:bg-[#181f2a] p-8 rounded-2xl shadow-2xl border border-gray-200 dark:border-[#2d3748] relative">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-extrabold text-blue-800 dark:text-blue-200 tracking-tight">Web App Chat</h1>
            <ThemeSwitcher />
          </div>

          {state.status === "disconnected" && (
            <div className="flex gap-2 mb-6">
              <Input
                value={state.roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room ID"
                className="flex-1 border border-gray-300 rounded px-4 py-2 dark:bg-[#232b3a] dark:text-white"
                size="large"
              />
              <Button
                onClick={joinRoom}
                type="primary"
                className="bg-blue-500 hover:bg-blue-600"
                size="large"
              >
                Join Room
              </Button>
            </div>
          )}

          <StatusBar status={state.status} />

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
      </div>
    </ConfigProvider>
  );
};

export default AppChat;
