import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";

// Ola 4.1 — helper para redirect 301 client-side preservando params dinámicos.
// Usado para /case/:id → /case-engine/:caseId y /dashboard/smart-forms/:id → /hub/formularios/:id
function RedirectWithParams({ to, useParam }: { to: string; useParam?: string }) {
  const params = useParams();
  if (useParam && params[useParam]) {
    return <Navigate to={`${to}/${params[useParam]}`} replace />;
  }
  // Default: preserve :id si existe
  const id = params.id;
  return <Navigate to={id ? `${to}/${id}` : to} replace />;
}
import { ThemeProvider } from "next-themes";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SplashPreview from "./pages/dev/SplashPreview";
import Dashboard from "./pages/Dashboard";
import CasesPage from "./pages/CasesPage";
import EvidenceTool from "./pages/EvidenceTool";
import PlaceholderTool from "./pages/PlaceholderTool";
import AffidavitTool from "./pages/AffidavitTool";
import CspaTool from "./pages/CspaTool";
import ClientUpload from "./pages/ClientUpload";
// Ola 4.1: CaseReview removido — /case/:id ahora redirect a /case-engine/:caseId
import Features from "./pages/Features";
import UscisAnalyzer from "./pages/UscisAnalyzer";
import SharedAnalysis from "./pages/SharedAnalysis";
import HubPage from "./pages/HubPage";
import Settings from "./pages/Settings";
import ResetPassword from "./pages/ResetPassword";
import ChecklistGenerator from "./pages/ChecklistGenerator";
import VawaScreener from "./pages/VawaScreener";
import VawaChecklistPage from "./pages/VawaChecklistPage";
import SmartFormsList from "./pages/SmartFormsList";
import SmartFormPage from "./pages/SmartFormPage";
import SmartFormsSettings from "./pages/SmartFormsSettings";
import SmartFormsLayout from "./components/smartforms/SmartFormsLayout";
import ClientQuestionnaire from "./pages/ClientQuestionnaire";
import NotFound from "./pages/NotFound";
import PdfFieldInspector from "./pages/PdfFieldInspector";
import CaseWorkspace from "./pages/CaseWorkspace";
import CaseEnginePage from "./pages/CaseEnginePage";
// Ola 4.1: IntelligenceCenterPage removido — /hub/intelligence ahora redirect a /hub/reports
import ReportsPage from "./pages/ReportsPage";
import VisaEvaluatorPage from "./pages/VisaEvaluatorPage";
import VisaEvalPublic from "./pages/VisaEvalPublic";
import CaseTrackPublic from "./pages/CaseTrackPublic";
import InterviewSimulatorPage from "./pages/InterviewSimulatorPage";
import B1B2AdminLite from "./pages/B1B2AdminLite";
import B1B2Dashboard from "./pages/B1B2Dashboard";
import ClientPortalRouter from "./pages/ClientPortalRouter";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminAccountsPage from "./pages/admin/AdminAccountsPage";
import AdminAccountDetailPage from "./pages/admin/AdminAccountDetailPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminBillingPage from "./pages/admin/AdminBillingPage";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage";
import AdminLogsPage from "./pages/admin/AdminLogsPage";
import OfficeSettingsPage from "./pages/OfficeSettingsPage";
import Register from "./pages/Register";
import PreIntakePage from "./pages/PreIntakePage";
import AdminTestSuite from "./pages/AdminTestSuite";
import ConsultationsPage from "./pages/ConsultationsPage";
import ClientProfilePage from "./pages/ClientProfilePage";
import HubClientsPage from "./pages/HubClientsPage";
import HubCasesPage from "./pages/HubCasesPage";
import I130PackWorkspace from "./pages/I130PackWorkspace";
import I130Doc01Cuestionario from "./pages/packs/i130/Doc01Cuestionario";
import I130Doc02Guia from "./pages/packs/i130/Doc02Guia";
import I130Doc03Evidence from "./pages/packs/i130/Doc03Evidence";
import I130Doc04Packet from "./pages/packs/i130/Doc04Packet";
import I130Doc05BonaFide from "./pages/packs/i130/Doc05BonaFide";
import I130Doc06I864 from "./pages/packs/i130/Doc06I864";
import I130Doc07InterviewPrep from "./pages/packs/i130/Doc07InterviewPrep";
import I485PackWorkspace from "./pages/I485PackWorkspace";
import I485Doc01Eligibility from "./pages/packs/i485/Doc01Eligibility";
import I485Doc02Guia from "./pages/packs/i485/Doc02Guia";
import I485Doc03Evidence from "./pages/packs/i485/Doc03Evidence";
import I485Doc04Packet from "./pages/packs/i485/Doc04Packet";
import I485Doc05Inadmissibility from "./pages/packs/i485/Doc05Inadmissibility";
import I485Doc06I693Medical from "./pages/packs/i485/Doc06I693Medical";
import I485Doc07InterviewPrep from "./pages/packs/i485/Doc07InterviewPrep";
import I765PackWorkspace from "./pages/I765PackWorkspace";
import I765Doc01Category from "./pages/packs/i765/Doc01Category";
import I765Doc02Documents from "./pages/packs/i765/Doc02Documents";
import I765Doc03Photo from "./pages/packs/i765/Doc03Photo";
import I765Doc04FeeWaiver from "./pages/packs/i765/Doc04FeeWaiver";
import I765Doc05ComboCard from "./pages/packs/i765/Doc05ComboCard";
import I765Doc06Packet from "./pages/packs/i765/Doc06Packet";
import I765Doc07Status from "./pages/packs/i765/Doc07Status";
import { PacksGate } from "./components/questionnaire-packs/shared/PacksGate";
import HubFormsPage from "./pages/HubFormsPage";
import HubAgendaPage from "./pages/HubAgendaPage";
import HubAiPage from "./pages/HubAiPage";
import HubChatPage from "./pages/HubChatPage";
import HubLeadsPage from "./pages/HubLeadsPage";
import ConsultationRoom from "./components/hub/ConsultationRoom";
import HubAuditPage from "./pages/HubAuditPage";


const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange={false} storageKey="ner-theme">
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* ═══ PUBLIC ROUTES ═══ */}
          <Route path="/" element={<Features />} />
          <Route path="/features" element={<Features />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/upload/:token" element={<ClientUpload />} />
          <Route path="/q/:token" element={<ClientQuestionnaire />} />
          <Route path="/shared-analysis/:token" element={<SharedAnalysis />} />
          <Route path="/visa-eval/:token" element={<VisaEvalPublic />} />
          <Route path="/case-track/:token" element={<CaseTrackPublic />} />
          <Route path="/portal/:cid" element={<ClientPortalRouter />} />
          <Route path="/intake/:token" element={<PreIntakePage />} />

          {/* ═══ PUBLIC TOOL ROUTES (GHL Custom Menu Links) ═══ */}
          <Route path="/tools/affidavit" element={<AffidavitTool />} />
          <Route path="/tools/evidence" element={<EvidenceTool />} />
          <Route path="/tools/cspa" element={<CspaTool />} />
          <Route path="/tools/uscis-analyzer" element={<UscisAnalyzer />} />
          

          {/* ═══ PROTECTED ROUTES ═══ */}
          <Route path="/hub" element={<HubPage />} />
          <Route path="/hub/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          {/* Ola 4.1 — /hub/intelligence DEPRECATED, redirect a /hub/reports (canonical post-Ola 2) */}
          <Route path="/hub/intelligence" element={<Navigate to="/hub/reports" replace />} />
          <Route path="/hub/consultations" element={<ProtectedRoute><ConsultationsPage /></ProtectedRoute>} />
          <Route path="/hub/consultations/:intakeId" element={<ProtectedRoute><ConsultationRoom /></ProtectedRoute>} />
          <Route path="/hub/leads" element={<ProtectedRoute><HubLeadsPage /></ProtectedRoute>} />
          <Route path="/hub/clients" element={<ProtectedRoute><HubClientsPage /></ProtectedRoute>} />
          <Route path="/hub/clients/:id" element={<ProtectedRoute><ClientProfilePage /></ProtectedRoute>} />
          <Route path="/hub/settings/office" element={<ProtectedRoute><OfficeSettingsPage /></ProtectedRoute>} />
          {/* ═══ SMART FORMS — /hub/formularios CANONICAL (Ola 4.1) ═══ */}
          {/* Movido desde /dashboard/smart-forms. El namespace /dashboard/* está
              DEPRECADO según INFORMATION-ARCHITECTURE.md §3. Redirects abajo. */}
          <Route path="/hub/formularios" element={<ProtectedRoute><SmartFormsLayout /></ProtectedRoute>}>
            <Route index element={<SmartFormsList />} />
            <Route path="new" element={<SmartFormPage />} />
            <Route path="settings" element={<SmartFormsSettings />} />
            <Route path=":id" element={<SmartFormPage />} />
          </Route>

          {/* ═══ /dashboard/* DEPRECATED — redirects a /hub/* o /tools/* (Ola 4.1) ═══ */}
          {/* Mantenemos /dashboard root para backwards compat de bookmarks generales */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          {/* Tools públicos: redirect a /tools/* (fuente de verdad para tools) */}
          <Route path="/dashboard/affidavit" element={<Navigate to="/tools/affidavit" replace />} />
          <Route path="/dashboard/cspa" element={<Navigate to="/tools/cspa" replace />} />
          <Route path="/dashboard/evidence" element={<Navigate to="/tools/evidence" replace />} />
          <Route path="/dashboard/uscis-analyzer" element={<Navigate to="/tools/uscis-analyzer" replace />} />
          {/* Workflows auth: redirect a /hub/* */}
          <Route path="/dashboard/cases" element={<Navigate to="/hub/cases" replace />} />
          <Route path="/dashboard/settings" element={<Navigate to="/hub/settings/office" replace />} />
          <Route path="/dashboard/smart-forms" element={<Navigate to="/hub/formularios" replace />} />
          <Route path="/dashboard/smart-forms/new" element={<Navigate to="/hub/formularios/new" replace />} />
          <Route path="/dashboard/smart-forms/settings" element={<Navigate to="/hub/formularios/settings" replace />} />
          <Route path="/dashboard/smart-forms/:id" element={<RedirectWithParams to="/hub/formularios" />} />
          {/* Features sin equivalente directo aún — mantener temporalmente bajo /dashboard hasta decision Ola 4.1.5 */}
          <Route path="/dashboard/tracker" element={<ProtectedRoute><PlaceholderTool tool="tracker" /></ProtectedRoute>} />
          <Route path="/dashboard/checklist" element={<ProtectedRoute><ChecklistGenerator /></ProtectedRoute>} />
          <Route path="/dashboard/vawa-screener" element={<ProtectedRoute><VawaScreener /></ProtectedRoute>} />
          <Route path="/dashboard/vawa-checklist" element={<ProtectedRoute><VawaChecklistPage /></ProtectedRoute>} />
          <Route path="/dashboard/workspace-demo" element={<ProtectedRoute><CaseWorkspace /></ProtectedRoute>} />
          <Route path="/dashboard/visa-evaluator" element={<ProtectedRoute><VisaEvaluatorPage /></ProtectedRoute>} />
          <Route path="/dashboard/interview-sim" element={<ProtectedRoute><InterviewSimulatorPage /></ProtectedRoute>} />
          {/* Legacy /case/:id → redirect a /case-engine/:caseId (Ola 4.1) */}
          <Route path="/case/:id" element={<RedirectWithParams to="/case-engine" useParam="id" />} />
          <Route path="/case-engine/:caseId" element={<ProtectedRoute><CaseEnginePage /></ProtectedRoute>} />
          <Route path="/b1b2-admin/:cid" element={<ProtectedRoute><B1B2AdminLite /></ProtectedRoute>} />
          <Route path="/b1b2-dashboard" element={<ProtectedRoute><B1B2Dashboard /></ProtectedRoute>} />
          <Route path="/b1b2-dashboard/:accountCid" element={<ProtectedRoute><B1B2Dashboard /></ProtectedRoute>} />
          <Route path="/interview-sim/practice" element={<ProtectedRoute><InterviewSimulatorPage /></ProtectedRoute>} />
          <Route path="/debug/pdf-fields" element={<ProtectedRoute><PdfFieldInspector /></ProtectedRoute>} />
          {/* Dev-only route — NOT accessible in production (Vite tree-shakes when DEV=false) */}
          {import.meta.env.DEV && (
            <Route path="/dev/splash-preview" element={<SplashPreview />} />
          )}

          {/* ═══ ADMIN ROUTES (auth + platform_admin check inside AdminLayout) ═══ */}
          <Route path="/admin" element={<ProtectedRoute><AdminLayout><AdminDashboardPage /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><AdminLayout><AdminDashboardPage /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/firms" element={<ProtectedRoute><AdminLayout><AdminAccountsPage /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/accounts" element={<Navigate to="/admin/firms" replace />} />
          <Route path="/admin/accounts/:accountId" element={<ProtectedRoute><AdminLayout><AdminAccountDetailPage /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><AdminLayout><AdminUsersPage /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/billing" element={<ProtectedRoute><AdminLayout><AdminBillingPage /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute><AdminLayout><AdminAnalyticsPage /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/logs" element={<ProtectedRoute><AdminLayout><AdminLogsPage /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute><AdminLayout><div className="text-white">Configuración — Coming soon</div></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/test-suite" element={<ProtectedRoute><AdminTestSuite /></ProtectedRoute>} />

          {/* ═══ REDIRECT ROUTES ═══ */}
          <Route path="/portfolio" element={<Navigate to="/dashboard/workspace-demo" replace />} />
          <Route path="/hub/cases" element={<ProtectedRoute><HubCasesPage /></ProtectedRoute>} />
          {/* ═══ I-130 PACK ═══ */}
          <Route path="/hub/cases/:caseId/i130-pack" element={<ProtectedRoute><PacksGate><I130PackWorkspace /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i130-pack/01-cuestionario" element={<ProtectedRoute><PacksGate><I130Doc01Cuestionario /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i130-pack/02-guia-entrevista" element={<ProtectedRoute><PacksGate><I130Doc02Guia /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i130-pack/03-evidence-checklist" element={<ProtectedRoute><PacksGate><I130Doc03Evidence /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i130-pack/04-packet-preparation" element={<ProtectedRoute><PacksGate><I130Doc04Packet /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i130-pack/05-bona-fide-builder" element={<ProtectedRoute><PacksGate><I130Doc05BonaFide /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i130-pack/06-i864-support" element={<ProtectedRoute><PacksGate><I130Doc06I864 /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i130-pack/07-interview-prep" element={<ProtectedRoute><PacksGate><I130Doc07InterviewPrep /></PacksGate></ProtectedRoute>} />
          {/* ═══ I-485 PACK ═══ */}
          <Route path="/hub/cases/:caseId/i485-pack" element={<ProtectedRoute><PacksGate><I485PackWorkspace /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i485-pack/01-eligibility" element={<ProtectedRoute><PacksGate><I485Doc01Eligibility /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i485-pack/02-guia-entrevista" element={<ProtectedRoute><PacksGate><I485Doc02Guia /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i485-pack/03-evidence-checklist" element={<ProtectedRoute><PacksGate><I485Doc03Evidence /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i485-pack/04-packet-preparation" element={<ProtectedRoute><PacksGate><I485Doc04Packet /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i485-pack/05-inadmissibility-screener" element={<ProtectedRoute><PacksGate><I485Doc05Inadmissibility /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i485-pack/06-i693-medical" element={<ProtectedRoute><PacksGate><I485Doc06I693Medical /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i485-pack/07-interview-prep" element={<ProtectedRoute><PacksGate><I485Doc07InterviewPrep /></PacksGate></ProtectedRoute>} />
          {/* ═══ I-765 PACK ═══ */}
          <Route path="/hub/cases/:caseId/i765-pack" element={<ProtectedRoute><PacksGate><I765PackWorkspace /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i765-pack/01-eligibility-category" element={<ProtectedRoute><PacksGate><I765Doc01Category /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i765-pack/02-documents" element={<ProtectedRoute><PacksGate><I765Doc02Documents /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i765-pack/03-photo" element={<ProtectedRoute><PacksGate><I765Doc03Photo /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i765-pack/04-fee-waiver" element={<ProtectedRoute><PacksGate><I765Doc04FeeWaiver /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i765-pack/05-combo-card" element={<ProtectedRoute><PacksGate><I765Doc05ComboCard /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i765-pack/06-packet" element={<ProtectedRoute><PacksGate><I765Doc06Packet /></PacksGate></ProtectedRoute>} />
          <Route path="/hub/cases/:caseId/i765-pack/07-status" element={<ProtectedRoute><PacksGate><I765Doc07Status /></PacksGate></ProtectedRoute>} />
          {/* /hub/formularios CANONICAL post-Ola 4.1 — definido arriba con SmartFormsLayout */}
          <Route path="/hub/agenda" element={<ProtectedRoute><HubAgendaPage /></ProtectedRoute>} />
          {/* /hub/reports now handled above directly */}
          <Route path="/hub/ai" element={<ProtectedRoute><HubAiPage /></ProtectedRoute>} />
          <Route path="/hub/chat" element={<ProtectedRoute><HubChatPage /></ProtectedRoute>} />
          <Route path="/hub/audit" element={<ProtectedRoute><HubAuditPage /></ProtectedRoute>} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
