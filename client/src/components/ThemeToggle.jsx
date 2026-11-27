import { useTheme } from "../ThemeContext";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-icon sun">☀️</span>
        <span className="theme-toggle-icon moon">🌙</span>
        <span className="theme-toggle-thumb" />
      </span>
    </button>
  );
}
