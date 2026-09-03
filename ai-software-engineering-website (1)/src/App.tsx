import { motion } from "framer-motion";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthModalProvider } from "@/components/auth/AuthModalProvider";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Agents } from "@/components/sections/Agents";
import { Features } from "@/components/sections/Features";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { HumanInTheLoop } from "@/components/sections/HumanInTheLoop";
import { Intelligence } from "@/components/sections/Intelligence";
import { Problem } from "@/components/sections/Problem";
import { Productivity } from "@/components/sections/Productivity";
import { RunExperience } from "@/components/sections/RunExperience";
import { TrustStrip } from "@/components/sections/TrustStrip";
import { WorkspacePreview } from "@/components/sections/WorkspacePreview";

export default function App() {
  return (
    <AuthProvider>
      <AuthModalProvider>
        <div id="top" className="relative min-h-screen bg-ink text-snow">
          {/* Page-load transition */}
          <motion.div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[90] bg-ink"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0, transitionEnd: { display: "none" } }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
          />

          <Header />

          <main>
            <Hero />
            <TrustStrip />
            <Problem />
            <HowItWorks />
            <Agents />
            <WorkspacePreview />
            <RunExperience />
            <HumanInTheLoop />
            <Features />
            <Intelligence />
            <Productivity />
            <FinalCTA />
          </main>

          <Footer />
        </div>
      </AuthModalProvider>
    </AuthProvider>
  );
}
