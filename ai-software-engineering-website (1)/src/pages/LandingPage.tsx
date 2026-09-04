import { motion } from "framer-motion";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";

/**
 * Public marketing landing page (route "/"). Signed-out visitors live here;
 * signed-in users can browse it and jump into the dashboard from the header.
 */
export function LandingPage() {
  return (
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
        <HowItWorks />
      </main>

      <Footer />
    </div>
  );
}
