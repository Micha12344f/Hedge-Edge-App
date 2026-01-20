import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ScrollToTop } from "@/components/ScrollToTop";
import Home from "./pages/Home";
import Overview from "./pages/Overview";
import Analytics from "./pages/Analytics";
import HedgeCalculator from "./pages/HedgeCalculator";
import Brokers from "./pages/Brokers";
import FAQ from "./pages/FAQ";
import Legal from "./pages/Legal";
import Booking from "./pages/Booking";
import NotFound from "./pages/NotFound";

const App = () => (
  <TooltipProvider>
    <BrowserRouter>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/hedge-calculator" element={<HedgeCalculator />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/brokers" element={<Brokers />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/legal/:type" element={<Legal />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
