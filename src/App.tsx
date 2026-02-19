import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import CyberMap from "@/pages/CyberMap";
import Dashboard from "@/pages/Dashboard";
import Organizations from "@/pages/Organizations";
import OrgDetail from "@/pages/OrgDetail";
import AlertsPage from "@/pages/Alerts";
import AlertDetail from "@/pages/AlertDetail";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Incidents from "@/pages/Incidents";
import Compliance from "@/pages/Compliance";
import CertAdvisories from "@/pages/CertAdvisories";
import ThreatMap from "@/pages/ThreatMap";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm font-mono">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/organizations" element={<Organizations />} />
        <Route path="/organizations/:id" element={<OrgDetail />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/alerts/:id" element={<AlertDetail />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/cert" element={<CertAdvisories />} />
            <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Landing />} />
            <Route path="/public" element={<Landing />} />
            <Route path="/cyber-map" element={<CyberMap />} />
            <Route path="/threat-map" element={<ThreatMap />} />
            <Route path="/dashboard" element={<ProtectedRoutes />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
