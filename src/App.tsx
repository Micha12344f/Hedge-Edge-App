import { lazy, Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Loader2 } from "lucide-react";

// Lazy load pages for code splitting
const DashboardOverview = lazy(() => import("./pages/app/DashboardOverview"));
const Accounts = lazy(() => import("./pages/app/Accounts"));
const DashboardAnalytics = lazy(() => import("./pages/app/DashboardAnalytics"));
const TradeCopier = lazy(() => import("./pages/app/TradeCopier"));
const DashboardCalculator = lazy(() => import("./pages/app/DashboardCalculator"));
const Settings = lazy(() => import("./pages/app/Settings"));
const Help = lazy(() => import("./pages/app/Help"));

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <AuthProvider>
    <TooltipProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Toaster />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/app/overview" replace />} />
            
            {/* Dashboard routes */}
            <Route path="/app" element={<DashboardLayout />}>
              <Route index element={<Navigate to="/app/overview" replace />} />
              <Route path="overview" element={<DashboardOverview />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="analytics" element={<DashboardAnalytics />} />
              <Route path="copier" element={<TradeCopier />} />
              <Route path="calculator" element={<DashboardCalculator />} />
              <Route path="settings" element={<Settings />} />
              <Route path="help" element={<Help />} />
            </Route>

            {/* Catch all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/app/overview" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </AuthProvider>
);

export default App;
