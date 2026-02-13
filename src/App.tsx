import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import { AddMachine } from "./pages/AddMachine";
import { MachineDetail } from "./pages/MachineDetail";
import { MachineSettings } from "./pages/MachineSettings";
import { Settings } from "./pages/Settings";
import { Store } from "./pages/Store";
import { Checkout } from "./pages/Checkout";
import { Orders } from "./pages/Orders";
import { Incidents } from "./pages/Incidents";
import { NewIncident } from "./pages/NewIncident";
import { Tutorials } from "./pages/Tutorials";
import { Promotions } from "./pages/Promotions";
import { NewPromotion } from "./pages/NewPromotion";
import { Subscription } from "./pages/Subscription";
import { PaymentMethods } from "./pages/PaymentMethods";
import { Support } from "./pages/Support";
import { NotificationSettings } from "./pages/NotificationSettings";
import { AI } from "./pages/AI";
import { StockPrediction } from "./pages/StockPrediction";
import { ProfitabilityAnalysis } from "./pages/ProfitabilityAnalysis";
import { DailySummary } from "./pages/DailySummary";
import { NetworkDashboard } from "./pages/NetworkDashboard";
import NotFound from "./pages/NotFound";
import { useAndroidBackButton } from "./hooks/useAndroidBackButton";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mantener datos en caché por 5 minutos
      staleTime: 5 * 60 * 1000,
      // Mantener caché por 10 minutos incluso si no se usa
      gcTime: 10 * 60 * 1000,
      // No refetch automático al cambiar de ventana
      refetchOnWindowFocus: false,
      // No refetch al reconectar red (el usuario puede hacerlo manualmente)
      refetchOnReconnect: false,
      // Reintentar solo 1 vez
      retry: 1,
    },
  },
});

// Wrapper component to use hooks inside Router
const AppContent = () => {
  // Handle Android back button
  useAndroidBackButton();
  
  return (
    <div className="min-h-screen safe-area-top safe-area-bottom">
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/add-machine" element={<AddMachine />} />
        <Route path="/machine/:id" element={<MachineDetail />} />
        <Route path="/machine/:id/settings" element={<MachineSettings />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/store" element={<Store />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/incidents/new" element={<NewIncident />} />
        <Route path="/tutorials" element={<Tutorials />} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="/promotions/new" element={<NewPromotion />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/payment-methods" element={<PaymentMethods />} />
        <Route path="/support" element={<Support />} />
        <Route path="/notifications" element={<NotificationSettings />} />
        <Route path="/ai" element={<AI />} />
        <Route path="/ai/stock-prediction" element={<StockPrediction />} />
        <Route path="/ai/profitability" element={<ProfitabilityAnalysis />} />
        <Route path="/ai/daily-summary" element={<DailySummary />} />
        <Route path="/network" element={<NetworkDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
