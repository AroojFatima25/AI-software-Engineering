import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthModalProvider } from "@/components/auth/AuthModalProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AboutPage } from "@/pages/AboutPage";
import { AgentsPage } from "@/pages/AgentsPage";
import { BlogPage } from "@/pages/BlogPage";
import { CareersPage } from "@/pages/CareersPage";
import { ContactPage } from "@/pages/ContactPage";
import { DocsPage } from "@/pages/DocsPage";
import { FeaturesPage } from "@/pages/FeaturesPage";
import { HowItWorksPage } from "@/pages/HowItWorksPage";
import { LandingPage } from "@/pages/LandingPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { ProductPage } from "@/pages/ProductPage";
import { TermsPage } from "@/pages/TermsPage";
import { WorkspacePage } from "@/pages/WorkspacePage";

/**
 * Route table for AI-OS.
 *
 * Marketing site is now multi-page — each former anchor section lives at its
 * own URL so it can be linked, deep-linked, and indexed independently:
 *
 *   "/"              → public landing overview (everyone)
 *   "/product"       → product detail (Problem / Intelligence / Productivity)
 *   "/how-it-works"  → workflow detail (HowItWorks / RunExperience / HumanInTheLoop)
 *   "/agents"        → agents catalogue
 *   "/features"      → feature grid
 *   "/docs"          → documentation overview + GitHub integration
 *   "/about" … "/terms" → company / resources / legal placeholders
 *   "/workspace"     → authenticated workspace dashboard (signed-in only)
 *
 * Session handling lives in <AuthProvider>; the auth modal is available to
 * all marketing routes (only landing CTAs open it today).
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthModalProvider>
          <ScrollManager />
          <Routes>
            {/* Marketing — multi-page */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/product" element={<ProductPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/careers" element={<CareersPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            {/* Product workspace */}
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthModalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

/** Reset scroll when switching between routes (hash anchors are unaffected). */
function ScrollManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
