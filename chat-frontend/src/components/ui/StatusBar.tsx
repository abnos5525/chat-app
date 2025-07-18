import { getStatusText } from "../../utils";

const statusColor = (status: string) => {
  switch (status) {
    case "disconnected":
      return "bg-red-500 text-white";
    case "waiting":
      return "bg-yellow-500 text-white";
    case "connecting":
      return "bg-blue-500 text-white";
    case "connected":
      return "bg-green-500 text-white";
    default:
      return "bg-gray-300 dark:bg-gray-700 dark:text-gray-200";
  }
};

const StatusBar = ({ status }: { status: string }) => (
  <div
    className={`text-center py-2 mb-4 rounded font-bold text-lg transition-colors duration-300 ${statusColor(
      status
    )}`}
  >
    Status: {getStatusText(status)}
  </div>
);

export default StatusBar; 