import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CasesPage from "./pages/CasesPage";
import EvidenceTool from "./pages/EvidenceTool";
import PlaceholderTool from "./pages/PlaceholderTool";
import AffidavitTool from "./pages/AffidavitTool";
import CspaTool from "./pages/CspaTool";
import ClientUpload from "./pages/ClientUpload";
import CaseReview from "./pages/CaseReview";
// AdminPanel removed — consolidated into Dashboard
import Features from "./pages/Features";
import UscisAnalyzer from "./pages/UscisAnalyzer";
import SharedAnalysis from "./pages/SharedAnalysis";
import HubPage from "./pages/HubPage";
import Settings from "./pages/Settings";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Features />} />
          <Route path="/features" element={<Features />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/cases" element={<CasesPage />} />
          <Route path="/dashboard/evidence" element={<EvidenceTool />} />
          <Route path="/dashboard/affidavit" element={<AffidavitTool />} />
          <Route path="/dashboard/cspa" element={<CspaTool />} />
          <Route path="/dashboard/tracker" element={<PlaceholderTool tool="tracker" />} />
          <Route path="/upload/:token" element={<ClientUpload />} />
          {/* Admin Panel consolidated into Dashboard */}
          <Route path="/case/:id" element={<CaseReview />} />
          <Route path="/dashboard/uscis-analyzer" element={<UscisAnalyzer />} />
          <Route path="/shared-analysis/:token" element={<SharedAnalysis />} />
          <Route path="/hub" element={<HubPage />} />
          <Route path="/dashboard/settings" element={<Settings />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
