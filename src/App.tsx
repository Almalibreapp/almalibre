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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
