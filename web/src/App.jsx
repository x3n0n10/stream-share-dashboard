import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import Overview from "./pages/Overview.jsx";
import Live from "./pages/Live.jsx";
import History from "./pages/History.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Users from "./pages/Users.jsx";
import Instances from "./pages/Instances.jsx";
import Vpn from "./pages/Vpn.jsx";
import { api } from "./lib/api.js";

export default function App() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    api
      .config()
      .then((c) => {
        setConfig(c);
        document.title = c.title;
      })
      .catch(() => setConfig({ title: "Stream Share Dashboard", pollIntervalMs: 15000 }));
  }, []);

  const pollIntervalMs = config?.pollIntervalMs || 15000;

  return (
    <Routes>
      <Route path="/" element={<Overview pollIntervalMs={pollIntervalMs} />} />
      <Route path="/live" element={<Live pollIntervalMs={pollIntervalMs} />} />
      <Route path="/history" element={<History pollIntervalMs={pollIntervalMs} />} />
      <Route path="/leaderboard" element={<Leaderboard pollIntervalMs={pollIntervalMs} />} />
      <Route path="/users" element={<Users pollIntervalMs={pollIntervalMs} />} />
      <Route path="/instances" element={<Instances pollIntervalMs={pollIntervalMs} />} />
      <Route path="/vpn" element={<Vpn pollIntervalMs={pollIntervalMs} />} />
    </Routes>
  );
}
