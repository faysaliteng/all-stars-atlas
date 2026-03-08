import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { warmUpServer } from "./lib/keep-alive";

// Warm up backend on first visit — zero latency for the visitor
warmUpServer();

createRoot(document.getElementById("root")!).render(<App />);
