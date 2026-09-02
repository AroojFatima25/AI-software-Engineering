import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export const EASE = [0.22, 1, 0.36, 1] as const;

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  duration?: number;
  once?: boolean;
  amount?: number;
}

/** Fades + lifts content into view when scrolled to. */
export function Reveal({ children, className, delay = 0, y = 28, duration = 0.9, once = true, amount = 0.25 }: RevealProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } },
};

interface StaggerProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  once?: boolean;
  amount?: number;
}

export function Stagger({ children, className, stagger = 0.08, delay = 0.1, once = true, amount = 0.15 }: StaggerProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={reduce ? undefined : { ...containerVariants, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once, amount }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} variants={reduce ? undefined : itemVariants}>
      {children}
    </motion.div>
  );
}

interface TextRevealProps {
  text: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
  stagger?: number;
  as?: "h1" | "h2" | "p" | "span";
}

/** Reveals a headline word by word with a soft upward mask animation. */
export function TextReveal({ text, className, wordClassName, delay = 0, stagger = 0.06, as = "h1" }: TextRevealProps) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  const words = text.split(" ");

  return (
    <Tag
      className={className}
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      aria-label={text}
    >
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-bottom">
          <motion.span
            className={cn("inline-block will-change-transform", wordClassName)}
            variants={{
              hidden: { y: "110%", opacity: 0 },
              show: { y: 0, opacity: 1, transition: { duration: 0.9, ease: EASE } },
            }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? <span className="inline-block">&nbsp;</span> : null}
        </span>
      ))}
    </Tag>
  );
}
