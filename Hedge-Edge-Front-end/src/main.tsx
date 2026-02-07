import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupGlobalErrorHandlers } from "@/lib/logger";

// Initialize global error handlers for uncaught errors
setupGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);
