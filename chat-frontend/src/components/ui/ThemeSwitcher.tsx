import { Dropdown, Button } from "antd";
import { BulbOutlined, BgColorsOutlined, SettingOutlined } from "@ant-design/icons";
import { useTheme, ThemeMode } from "../../hooks/useTheme";

const themeOptions = [
  { key: "light", label: "Light", icon: <BulbOutlined /> },
  { key: "dark", label: "Dark", icon: <BgColorsOutlined /> },
  { key: "system", label: "System", icon: <SettingOutlined /> },
];

const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();
  return (
    <Dropdown
      menu={{
        items: themeOptions.map((opt) => ({
          key: opt.key,
          label: (
            <span className="flex items-center gap-2">
              {opt.icon} {opt.label}
            </span>
          ),
        })),
        selectable: true,
        selectedKeys: [theme],
        onClick: ({ key }) => setTheme(key as ThemeMode),
      }}
      placement="bottomRight"
      arrow
    >
      <Button icon={<SettingOutlined />} shape="circle" size="large" aria-label="Change theme" />
    </Dropdown>
  );
};

export default ThemeSwitcher; 