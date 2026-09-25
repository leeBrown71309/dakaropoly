import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installAudioUnlock } from "./audio/sounds";
import { initAccount } from "./net/accountStore";
import "./index.css";

installAudioUnlock();
// Before the first render: the auth client reads Google's code from the
// address bar as it starts, and nothing else may tidy the URL first.
initAccount();

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
