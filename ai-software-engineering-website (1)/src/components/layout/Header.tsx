import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { Button } from "@/components/ui/Button";
import { EASE } from "@/components/ui/motion";
import { Container, Logo, StatusDot } from "@/components/ui/primitives";
import { NAV_LINKS } from "@/data/navigation";
import { cn } from "@/utils/cn";

function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    if (!elements.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.2, 0.5] },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

const SECTION_IDS = NAV_LINKS.map((l) => l.href.replace("#", ""));

/** Compact signed-in indicator: live dot + account email. */
function AccountChip({ email, className }: { email?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-[13px] backdrop-blur-sm",
        className,
      )}
      title={email ? `Signed in as ${email}` : "Signed in"}
    >
      <StatusDot tone="success" />
      <span className="max-w-[200px] truncate font-medium text-snow">{email ?? "Signed in"}</span>
    </span>
  );
}

export function Header() {
  const scrolled = useScrolled();
  const active = useActiveSection(SECTION_IDS);
  const [open, setOpen] = useState(false);
  const { open: openAuth } = useAuthModal();
  const { ready, isSignedIn, user, signOut } = useAuth();
  const email = user?.email;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onResize = () => window.innerWidth >= 1024 && setOpen(false);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500",
          scrolled || open ? "border-b border-white/[0.07] bg-ink/70 backdrop-blur-xl" : "border-b border-transparent bg-transparent",
        )}
      >
        <Container className="flex h-16 items-center justify-between lg:h-[68px]">
          <Logo />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => {
              const isActive = active === link.href.slice(1);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative rounded-full px-3.5 py-2 text-[13.5px] font-medium tracking-[-0.01em] transition-colors duration-300",
                    isActive ? "text-snow" : "text-fog hover:text-snow",
                  )}
                >
                  {isActive ? (
                    <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-white/[0.06]" transition={{ type: "spring", stiffness: 380, damping: 34 }} />
                  ) : null}
                  <span className="relative">{link.label}</span>
                </a>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {!ready ? (
              /* session restore in flight — hold the space so buttons don't flicker */
              <span className="h-9 w-[236px]" aria-hidden />
            ) : isSignedIn ? (
              <>
                <AccountChip email={email} />
                <Button variant="ghost" size="sm" onClick={() => void signOut()}>
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => openAuth("sign-in")}>
                  Sign In
                </Button>
                <Button size="sm" onClick={() => openAuth("sign-up")}>
                  Get Started
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
                </Button>
              </>
            )}
          </div>

          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-snow lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </Container>
      </motion.header>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-nav"
            className="fixed inset-0 z-40 flex flex-col bg-ink/95 pt-20 backdrop-blur-2xl lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Container className="flex flex-1 flex-col">
              <nav className="mt-6 flex flex-col" aria-label="Mobile">
                {NAV_LINKS.map((link, i) => (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.05, duration: 0.4, ease: EASE }}
                    className="flex items-center justify-between border-b border-white/[0.06] py-4 text-lg font-medium tracking-tight text-snow"
                  >
                    {link.label}
                    <ArrowRight className="h-4 w-4 text-fog-2" />
                  </motion.a>
                ))}
              </nav>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4, ease: EASE }}
                className="mt-auto grid gap-3 pb-10 pt-8"
              >
                {ready && isSignedIn ? (
                  <>
                    <AccountChip email={email} className="w-full justify-between" />
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full"
                      onClick={() => {
                        setOpen(false);
                        void signOut();
                      }}
                    >
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => {
                        setOpen(false);
                        openAuth("sign-up");
                      }}
                    >
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full"
                      onClick={() => {
                        setOpen(false);
                        openAuth("sign-in");
                      }}
                    >
                      Sign In
                    </Button>
                  </>
                )}
              </motion.div>
            </Container>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
