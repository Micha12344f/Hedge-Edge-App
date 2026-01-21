import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

// Auth page
import Auth from "./pages/Auth";

// Dashboard pages
import DashboardOverview from "./pages/app/DashboardOverview";
import Accounts from "./pages/app/Accounts";
import DashboardAnalytics from "./pages/app/DashboardAnalytics";
import TradeCopier from "./pages/app/TradeCopier";
import Journal from "./pages/app/Journal";
import DashboardCalculator from "./pages/app/DashboardCalculator";
import Settings from "./pages/app/Settings";
import Help from "./pages/app/Help";

const App = () => (
  <AuthProvider>
    <TooltipProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Toaster />
        <Routes>
          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to="/app/overview" replace />} />
          
          {/* Auth */}
          <Route path="/auth" element={<Auth />} />
          
          {/* Dashboard routes */}
          <Route path="/app" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/app/overview" replace />} />
            <Route path="overview" element={<DashboardOverview />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="analytics" element={<DashboardAnalytics />} />
            <Route path="copier" element={<TradeCopier />} />
            <Route path="journal" element={<Journal />} />
            <Route path="calculator" element={<DashboardCalculator />} />
            <Route path="settings" element={<Settings />} />
            <Route path="help" element={<Help />} />
          </Route>

          {/* Catch all - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/app/overview" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </AuthProvider>
);

export default App;
