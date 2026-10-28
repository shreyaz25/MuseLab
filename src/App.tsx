import { NavLink, Route, Routes } from "react-router-dom";
import { Logo } from "./components/ui";
import { useBackend } from "./context/Backend";
import Compare from "./pages/Compare";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Progress from "./pages/Progress";
import Results from "./pages/Results";
import SessionPage from "./pages/SessionPage";
import Settings from "./pages/Settings";
import Studio from "./pages/Studio";

const LINKS: [string, string][] = [
  ["/", "Dashboard"],
  ["/studio", "Analysis Studio"],
  ["/history", "Practice History"],
  ["/progress", "Progress"],
  ["/settings", "Settings & Privacy"],
];

export default function App() {
  const { status } = useBackend();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo />
        <nav className="nav" aria-label="Main">
          {LINKS.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="status-pill" role="status">
          <span className={`dot ${status}`} aria-hidden="true" />
          {status === "online" ? "Python API online" : status === "offline" ? "Python API offline" : "Checking API…"}
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/results" element={<Results />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<SessionPage />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
