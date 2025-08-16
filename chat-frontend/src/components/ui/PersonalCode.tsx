import { useState } from "react";
import { Input, Button, Tooltip, Typography } from "antd";
import { CopyOutlined, UserOutlined, LinkOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface PersonalCodeProps {
  personalCode: string;
  onConnect: (targetCode: string) => void;
  loading: boolean;
}

const PersonalCode = ({ personalCode, onConnect, loading }: PersonalCodeProps) => {
  const [targetCode, setTargetCode] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(personalCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handleConnect = () => {
    if (targetCode.trim()) onConnect(targetCode.trim());
  };

  const isDisabled = !targetCode.trim() || loading;

  return (
    <div className="mb-6 flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <Text strong className="text-lg">Your Code:</Text>
        <Input
          value={personalCode}
          readOnly
          prefix={<UserOutlined />}
          className="w-40 text-center font-mono bg-gray-100 dark:bg-gray-800 border-none"
          size="large"
        />
        <Tooltip title={copied ? "Copied!" : "Copy code"}>
          <Button icon={<CopyOutlined />} onClick={handleCopy} size="large" />
        </Tooltip>
      </div>
      <div className="flex items-center gap-2 w-full mt-2">
        <Input
          value={targetCode}
          onChange={e => setTargetCode(e.target.value)}
          placeholder="Enter friend's code"
          prefix={<UserOutlined />}
          className="flex-1"
          size="large"
        />
        <Button
          type="primary"
          icon={<LinkOutlined />}
          onClick={handleConnect}
          loading={loading}
          disabled={isDisabled}
          size="large"
          className={
            isDisabled
              ? "!bg-gray-200 !text-gray-400 dark:!bg-gray-700 dark:!text-gray-500 border-none cursor-not-allowed"
              : ""
          }
        >
          Connect
        </Button>
      </div>
    </div>
  );
};

export default PersonalCode; 