import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ScrollToTop from "@/components/ScrollToTop";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import TurnstileGate from "@/pages/TurnstileGate";
import Contact from "@/pages/Contact";
import Portfolio from "@/pages/Portfolio";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";

import CybersecurityCompliance from "@/pages/security/CybersecurityCompliance";
import RansomwareProtection from "@/pages/security/RansomwareProtection";
import SecureAppsApis from "@/pages/security/SecureAppsApis";
import DnsSecurity from "@/pages/security/DnsSecurity";
import ZeroTrust from "@/pages/security/ZeroTrust";
import DdosProtection from "@/pages/security/DdosProtection";
import BotProtection from "@/pages/security/BotProtection";
import IdentityAccess from "@/pages/security/IdentityAccess";

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

import UptimeMonitor from "@/pages/UptimeMonitor";
import DdosMonitor from "@/pages/DdosMonitor";
import EarlyWarning from "@/pages/EarlyWarning";
import ThreatIntelligence from "@/pages/ThreatIntelligence";
import Playbooks from "@/pages/Playbooks";
import DastScanner from "@/pages/DastScanner";
import SecurityMonitor from "@/pages/SecurityMonitor";
import SecurityScanner from "@/pages/SecurityScanner";
import ScanReport from "@/pages/ScanReport";
import ScanQueuePanel from "@/pages/ScanQueuePanel";
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

  if (!user) return <Navigate to="/mol" replace />;

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
        <Route path="/reports" element={<Reports />} />
        <Route path="/uptime" element={<UptimeMonitor />} />
        <Route path="/ddos-monitor" element={<DdosMonitor />} />
        <Route path="/early-warning" element={<EarlyWarning />} />
        <Route path="/threat-intelligence" element={<ThreatIntelligence />} />
        <Route path="/playbooks" element={<Playbooks />} />
        <Route path="/dast-scanner" element={<DastScanner />} />
        <Route path="/admin/security-monitor" element={<SecurityMonitor />} />
        <Route path="/security-scanner" element={<SecurityScanner />} />
        <Route path="/scan-queue" element={<ScanQueuePanel />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner theme="dark" />
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
            <Routes>
              <Route path="/mol" element={<Login />} />
              <Route path="/" element={<TurnstileGate><Landing /></TurnstileGate>} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/security/cybersecurity-compliance" element={<CybersecurityCompliance />} />
              <Route path="/security/ransomware-protection" element={<RansomwareProtection />} />
              <Route path="/security/secure-apps-apis" element={<SecureAppsApis />} />
              <Route path="/security/dns-security" element={<DnsSecurity />} />
              <Route path="/security/zero-trust" element={<ZeroTrust />} />
              <Route path="/security/ddos-protection" element={<DdosProtection />} />
              <Route path="/security/bot-protection" element={<BotProtection />} />
              <Route path="/security/identity-access" element={<IdentityAccess />} />
              <Route path="/cyber-map" element={<TurnstileGate sessionKey="turnstile_cybermap"><CyberMap /></TurnstileGate>} />
              <Route path="/scan/:id" element={<ScanReport />} />
              
              <Route path="/dashboard" element={<ProtectedRoutes />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
