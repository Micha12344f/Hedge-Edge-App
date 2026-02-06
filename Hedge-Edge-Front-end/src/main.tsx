import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupGlobalErrorHandlers } from "@/lib/logger";
import { initDevUtils } from "@/lib/devUtils";

// Initialize global error handlers for uncaught errors
setupGlobalErrorHandlers();

// Initialize dev utilities (exposes __devUtils on window in dev mode)
initDevUtils();

// Load mock utilities in development (accessible via browser console)
if (import.meta.env.DEV) {
  import('@/mocks/mock-loader');
}

createRoot(document.getElementById("root")!).render(<App />);
