import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useRef } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import {
  fetchVentasResumen,
  fetchTemperatura,
  fetchOrdenes,
} from "@/services/api";

// Admin
import { AdminRoute } from "./components/admin/AdminRoute";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminMachines } from "./pages/admin/AdminMachines";
import { AdminMachineDetail } from "./pages/admin/AdminMachineDetail";
import { AdminFranchisees } from "./pages/admin/AdminFranchisees";
import { AdminStock } from "./pages/admin/AdminStock";
import { AdminSalesAnalytics } from "./pages/admin/AdminSalesAnalytics";
import { AdminIncidents } from "./pages/admin/AdminIncidents";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

// Prefetch store products via edge function
async function prefetchStoreProducts() {
  const { data, error } = await supabase.functions.invoke('woocommerce-products', { body: {} });
  if (error || data?.error) return [];
  return data?.products ?? [];
}

// Helper to prefetch sales for a machine via API for a given date
async function prefetchSalesForDate(imei: string, dateStr: string) {
  try {
    return await fetchOrdenes(imei, dateStr);
  } catch {
    return null;
  }
}

// Get array of date strings for the current month up to today
function getCurrentMonthDates(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const dates: string[] = [];
  for (let d = 1; d <= today; d++) {
    dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

// Fired once per session when auth is confirmed — prefetches store + machine data
const GlobalPrefetch = () => {
  const queryClientRef = useQueryClient();
  const prefetchedRef = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user || prefetchedRef.current) return;
      if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return;

      prefetchedRef.current = true;
      const userId = session.user.id;

      // CRITICAL: Use setTimeout to avoid Supabase deadlock when calling DB inside onAuthStateChange
      setTimeout(() => {
        // 1. Prefetch store products (background, fire-and-forget)
        queryClientRef.prefetchQuery({
          queryKey: ['store-products-v2'],
          queryFn: prefetchStoreProducts,
          staleTime: 15 * 60 * 1000,
        });

        // 2. Fetch user's machines, then prefetch ventas + temperatura + today's sales for each
        const fetchAndPrefetch = async () => {
          try {
            const { data: maquinas } = await supabase
              .from('maquinas')
              .select('id, mac_address')
              .eq('usuario_id', userId);

            if (maquinas && maquinas.length > 0) {
              const monthDates = getCurrentMonthDates();
              const todayStr = monthDates[monthDates.length - 1];

              maquinas.forEach(({ mac_address }) => {
                queryClientRef.prefetchQuery({
                  queryKey: ['ventas-resumen', mac_address],
                  queryFn: () => fetchVentasResumen(mac_address),
                  staleTime: 3 * 60 * 1000,
                });
                queryClientRef.prefetchQuery({
                  queryKey: ['temperatura', mac_address],
                  queryFn: () => fetchTemperatura(mac_address),
                  staleTime: 60 * 1000,
                });
                // Prefetch today's detailed sales
                queryClientRef.prefetchQuery({
                  queryKey: ['admin-dashboard-ventas-prefetch', todayStr, mac_address],
                  queryFn: () => prefetchSalesForDate(mac_address, todayStr),
                  staleTime: 2 * 60 * 1000,
                });
                // Prefetch monthly sales (all days of current month) — cached aggressively
                const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                queryClientRef.prefetchQuery({
                  queryKey: ['ventas-mes-api', mac_address, currentMonth],
                  queryFn: async () => {
                    const allSales = await Promise.all(
                      monthDates.map(async (fecha) => {
                        const detalle = await prefetchSalesForDate(mac_address, fecha);
                        return detalle?.ventas || [];
                      })
                    );
                    const seen = new Set<string>();
                    return allSales.flat().filter((v: any) => {
                      const key = `${v.id || v.numero_orden}-${v.fecha}`;
                      if (seen.has(key)) return false;
                      seen.add(key);
                      return (v.estado || '').toLowerCase() === 'exitoso';
                    });
                  },
                  staleTime: 5 * 60 * 1000,
                });
              });
            }
          } catch {
            // Prefetch failures are silent — the components will fetch on mount as fallback
          }
        };
        fetchAndPrefetch();
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, [queryClientRef]);

  return null;
};

const AppContent = () => {
  useAndroidBackButton();

  return (
    <div className="min-h-screen safe-area-top safe-area-bottom">
      <GlobalPrefetch />
      <Routes>
        {/* User routes */}
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

        {/* Admin routes */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="machines" element={<AdminMachines />} />
          <Route path="machine/:id" element={<AdminMachineDetail />} />
          <Route path="franchisees" element={<AdminFranchisees />} />
          <Route path="stock" element={<AdminStock />} />
          <Route path="sales" element={<AdminSalesAnalytics />} />
          <Route path="analytics" element={<AdminSalesAnalytics />} />
          <Route path="incidents" element={<AdminIncidents />} />
        </Route>

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

