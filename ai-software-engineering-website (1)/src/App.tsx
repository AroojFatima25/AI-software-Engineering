import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthModalProvider } from "@/components/auth/AuthModalProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { LandingPage } from "@/pages/LandingPage";
import { WorkspacePage } from "@/pages/WorkspacePage";

/**
 * Route table for AI-OS.
 *
 *   "/"          → public landing page (everyone)
 *   "/workspace" → authenticated workspace dashboard (signed-in users only;
 *                  signed-out visitors are redirected back to "/")
 *
 * Session handling lives in <AuthProvider>; the auth modal is available to
 * both routes (only landing CTAs open it today).
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthModalProvider>
          <ScrollManager />
          <Routes>
            <Route path="/" element={<LandingPage />} />
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
