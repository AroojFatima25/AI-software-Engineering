import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { EASE, Reveal } from "@/components/ui/motion";
import { Container, Glow, Section, SectionHeading } from "@/components/ui/primitives";
import { CONTEXT_NODES } from "@/data/features";

const SIZE = 720;
const C = SIZE / 2;
const R = 252;

const NODES = CONTEXT_NODES.map((label, i) => {
  const angle = (-90 + i * 45) * (Math.PI / 180);
  return { label, x: C + Math.cos(angle) * R, y: C + Math.sin(angle) * R, i };
});

export function Intelligence() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion() ?? false;

  return (
    <Section className="overflow-hidden">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Intelligence"
              title="One intelligent context for your entire software project."
              description="AI-OS connects projects, code, requirements, tasks, agents, tests, reviews, and documentation into a single shared context. Every agent works from the same understanding of your system."
            />
            <Reveal delay={0.15} className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:grid-cols-2">
              {CONTEXT_NODES.map((n) => (
                <div key={n} className="flex items-center gap-2.5 text-[13.5px] text-fog">
                  <span className="h-1.5 w-1.5 rounded-full bg-electric/80" />
                  {n}
                </div>
              ))}
            </Reveal>
          </div>

          <div className="relative mx-auto w-full max-w-[600px]">
            <Glow tone="electric" className="left-1/2 top-1/2 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 opacity-80" />
            <Glow tone="ember" className="right-0 bottom-0 h-[40%] w-[40%] opacity-50" />
            <motion.svg
              ref={ref}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="relative h-auto w-full"
              initial={reduce ? false : { opacity: 0, scale: 0.96 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 1.2, ease: EASE }}
              aria-label="Diagram showing AI-OS connecting projects, code, requirements, tasks, agents, tests, reviews and documentation"
            >
              <defs>
                <radialGradient id="ctx-core" cx="50%" cy="40%" r="70%">
                  <stop offset="0" stopColor="#3b82f6" stopOpacity="0.55" />
                  <stop offset="0.6" stopColor="#1d4ed8" stopOpacity="0.25" />
                  <stop offset="1" stopColor="#050507" stopOpacity="0.9" />
                </radialGradient>
                <filter id="ctx-glow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="6" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="ctx-dot" x="-300%" y="-300%" width="700%" height="700%">
                  <feGaussianBlur stdDeviation="2.5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Orbits */}
              <g className={reduce ? undefined : "animate-spin-slow"} style={{ transformOrigin: `${C}px ${C}px`, transformBox: "view-box" }}>
                <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 10" />
              </g>
              <g className={reduce ? undefined : "animate-spin-slower"} style={{ transformOrigin: `${C}px ${C}px`, transformBox: "view-box" }}>
                <circle cx={C} cy={C} r={160} fill="none" stroke="rgba(59,130,246,0.14)" strokeDasharray="1 8" />
              </g>
              <circle cx={C} cy={C} r={R + 60} fill="none" stroke="rgba(255,255,255,0.035)" />

              {/* Spokes */}
              {NODES.map((n) => {
                const d = `M${C},${C} L${n.x},${n.y}`;
                return (
                  <g key={n.label}>
                    <motion.line
                      x1={C}
                      y1={C}
                      x2={n.x}
                      y2={n.y}
                      stroke="rgba(59,130,246,0.28)"
                      strokeWidth="1"
                      initial={reduce ? false : { pathLength: 0 }}
                      animate={inView ? { pathLength: 1 } : {}}
                      transition={{ duration: 0.9, delay: 0.3 + n.i * 0.08, ease: EASE }}
                    />
                    {!reduce ? (
                      <circle r="3" fill="#9cc4ff" filter="url(#ctx-dot)">
                        <animateMotion dur={`${3.6 + (n.i % 3) * 0.6}s`} repeatCount="indefinite" path={d} begin={`${-n.i * 0.7}s`} keyPoints={n.i % 2 === 0 ? "0;1" : "1;0"} keyTimes="0;1" calcMode="linear" />
                      </circle>
                    ) : null}
                  </g>
                );
              })}

              {/* Nodes */}
              {NODES.map((n) => (
                <motion.g
                  key={n.label}
                  initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.7, delay: 0.5 + n.i * 0.08, ease: EASE }}
                  style={{ transformOrigin: `${n.x}px ${n.y}px`, transformBox: "view-box" }}
                >
                  <rect x={n.x - 72} y={n.y - 21} width="144" height="42" rx="21" className="fill-[#0c0c11]" stroke="rgba(255,255,255,0.12)" />
                  <rect x={n.x - 72} y={n.y - 21} width="144" height="42" rx="21" fill="none" stroke="rgba(59,130,246,0.25)" />
                  <circle cx={n.x - 54} cy={n.y} r="3" className="fill-electric" />
                  <text x={n.x + 4} y={n.y + 4.5} textAnchor="middle" className="fill-[#f5f5f7] text-[14px] font-medium tracking-tight">
                    {n.label}
                  </text>
                </motion.g>
              ))}

              {/* Core */}
              <motion.g initial={reduce ? false : { opacity: 0, scale: 0.85 }} animate={inView ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 1, ease: EASE }} style={{ transformOrigin: `${C}px ${C}px`, transformBox: "view-box" }}>
                <circle cx={C} cy={C} r="92" fill="rgba(59,130,246,0.08)" filter="url(#ctx-glow)" />
                <circle cx={C} cy={C} r="78" fill="url(#ctx-core)" stroke="rgba(125,180,255,0.5)" strokeWidth="1" />
                <circle cx={C} cy={C} r="78" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <g transform={`translate(${C - 14} ${C - 34})`}>
                  <circle cx="14" cy="14" r="9" fill="none" stroke="#f5f5f7" strokeWidth="2.4" />
                  <circle cx="22" cy="6" r="3.4" className="fill-electric-light" />
                </g>
                <text x={C} y={C + 12} textAnchor="middle" className="fill-[#f5f5f7] text-[17px] font-semibold tracking-tight">
                  AI-OS
                </text>
                <text x={C} y={C + 32} textAnchor="middle" className="fill-[#a1a1aa] text-[10.5px] uppercase" style={{ letterSpacing: "0.18em" }}>
                  Project context
                </text>
              </motion.g>
            </motion.svg>
          </div>
        </div>
      </Container>
    </Section>
  );
}
