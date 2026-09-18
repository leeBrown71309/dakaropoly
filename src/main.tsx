import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installAudioUnlock } from "./audio/sounds";
import "./index.css";

installAudioUnlock();

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
