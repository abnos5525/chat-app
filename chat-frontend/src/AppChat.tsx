import { App, Button, Input, ConfigProvider, Modal } from "antd";
import Chat from "./components/chat";
import { useChatConnection } from "./hooks/useChatConnection";
import { useTheme } from "./hooks/useTheme";
import ThemeSwitcher from "./components/ui/ThemeSwitcher";
import StatusBar from "./components/ui/StatusBar";
import { useState, useEffect } from "react";
import { generateUniqueToken } from "./utils";

const AppChat = () => {
  const { notification } = App.useApp();
  const {
    state,
    connectToPeer,
    sendMessage,
    handleKeyPress,
    setLocalSecretCode,
    setTargetSecretCode,
    setMessage,
    respondToRequest,
  } = useChatConnection({ notification });

  const { isDark, getAntdAlgorithm, getAntdTokens } = useTheme();

  // Generate and set a unique token on component mount
  useEffect(() => {
    if (!state.localSecretCode) {
      const uniqueToken = generateUniqueToken();
      setLocalSecretCode(uniqueToken);
    }
  }, [state.localSecretCode, setLocalSecretCode]);

  const handleGenerateNewToken = () => {
    const newToken = generateUniqueToken();
    setLocalSecretCode(newToken);
  };

  const handleCopyToken = () => {
    if (state.localSecretCode) {
      navigator.clipboard.writeText(state.localSecretCode).then(() => {
        notification.success({ message: "Token copied to clipboard!" });
      }).catch(err => {
        notification.error({ message: "Failed to copy token: " + err.message });
      });
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: getAntdAlgorithm(),
        token: getAntdTokens(),
      }}
    >
      <div
        className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-300 ${isDark
            ? "bg-gradient-to-br from-[#0a0f1a] via-[#181f2a] to-[#232b3a]"
            : "bg-gradient-to-br from-blue-100 via-white to-blue-200"
          }`}
      >
        <div className="w-full max-w-3xl bg-white dark:bg-[#181f2a] p-8 rounded-2xl shadow-2xl border border-gray-200 dark:border-[#2d3748] relative">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-extrabold text-blue-800 dark:text-blue-200 tracking-tight">Secret Chat</h1>
            <ThemeSwitcher />
          </div>

          {state.status === "disconnected" && (
            <div className="space-y-6 mb-6">
              {/* Token Section */}
              <div className="bg-blue-50 dark:bg-gray-800 p-4 rounded-xl border border-blue-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3">
                  Your Unique Token
                </h2>
                <div className="flex gap-2 items-center">
                  <Input
                    value={state.localSecretCode}
                    placeholder="Your unique token"
                    className="flex-1 border border-gray-300 rounded px-4 py-2 dark:bg-[#232b3a] dark:text-white"
                    size="large"
                    readOnly
                  />
                  <Button
                    onClick={handleCopyToken}
                    type="default"
                    size="large"
                  >
                    Copy
                  </Button>
                  <Button
                    onClick={handleGenerateNewToken}
                    type="primary"
                    size="large"
                  >
                    Generate New
                  </Button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Share this token with others so they can connect to you
                </p>
              </div>

              {/* Connection Section */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  Connect to Someone
                </h2>
                <div className="flex gap-2">
                  <Input
                    value={state.targetSecretCode}
                    onChange={(e) => setTargetSecretCode(e.target.value)}
                    placeholder="Enter their 10-character token"
                    className="flex-1 border border-gray-300 rounded px-4 py-2 dark:bg-[#232b3a] dark:text-white"
                    size="large"
                  />
                  <Button
                    onClick={connectToPeer}
                    type="primary"
                    className="bg-blue-500 hover:bg-blue-600"
                    size="large"
                  >
                    Connect
                  </Button>
                </div>
              </div>
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

          {/* Display your token when connected */}
          {state.status !== "disconnected" && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-gray-700">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <span className="font-medium">Your Token:</span> {state.localSecretCode}
              </p>
            </div>
          )}
        </div>

        {/* Connection Request Modal */}
        <Modal
          title="Connection Request"
          open={!!state.incomingRequest}
          onOk={() => respondToRequest(true)}
          onCancel={() => respondToRequest(false)}
          okText="Accept"
          cancelText="Reject"
          closable={false}
          maskClosable={false}
        >
          <p>
            User with token <span className="font-semibold">{state.incomingRequest?.fromCode}</span> wants to connect with you.
          </p>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Do you want to accept this connection request?
          </p>
        </Modal>
      </div>
    </ConfigProvider>
  );
};

export default AppChat;