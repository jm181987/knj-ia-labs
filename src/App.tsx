import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MetaPixelTracker } from "@/components/MetaPixelTracker";
import HistoryPage from "./pages/HistoryPage";
import GalleryPage from "./pages/GalleryPage";
import AvatarsPage from "./pages/AvatarsPage";
import CatalogPage from "./pages/CatalogPage";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import UploadPolicyPage from "./pages/UploadPolicyPage";
import CreditsPolicyPage from "./pages/CreditsPolicyPage";
import AuthPage from "./pages/AuthPage";
import AdminPage from "./pages/AdminPage";
import PricingPage from "./pages/PricingPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import PaymentFailurePage from "./pages/PaymentFailurePage";
import PaymentPendingPage from "./pages/PaymentPendingPage";
import BasicGuidePage from "./pages/BasicGuidePage";
import ModelsDirectoryPage from "./pages/ModelsDirectoryPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <MetaPixelTracker />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/models" element={<ModelsDirectoryPage />} />
            <Route path="/upload-policy" element={<UploadPolicyPage />} />
            <Route path="/credits-policy" element={<CreditsPolicyPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/failure" element={<PaymentFailurePage />} />
            <Route path="/payment/pending" element={<PaymentPendingPage />} />
            <Route
              path="/app/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<CatalogPage />} />
                      <Route path="history" element={<HistoryPage />} />
                      <Route path="gallery" element={<GalleryPage />} />
                      <Route path="avatars" element={<AvatarsPage />} />
                      <Route path="catalog" element={<CatalogPage />} />
                      <Route path="guide" element={<BasicGuidePage />} />
                      <Route path="guide/videos" element={<BasicGuidePage />} />
                      <Route path="guide/avatars" element={<BasicGuidePage />} />
                      <Route path="pricing" element={<PricingPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <AdminPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
