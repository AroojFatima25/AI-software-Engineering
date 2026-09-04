import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, KeyRound, Loader2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { FormBanner, PasswordField } from "@/components/auth/fields";
import { Button } from "@/components/ui/Button";
import { EASE } from "@/components/ui/motion";
import {
  MIN_PASSWORD_LENGTH,
  hasPasswordIdentity,
  updatePassword,
  validatePassword,
  validatePasswordConfirmation,
  type AuthResult,
} from "@/lib/auth";

/**
 * "Set / change password" panel for the authenticated account area.
 *
 * This is what lets a magic-link or Google user add a password to their
 * existing account without going through the email recovery round trip —
 * `supabase.auth.updateUser({ password })` works on any live session.
 *
 * We look at the user's identities to word the panel correctly: someone who
 * signed up passwordless is *setting* a password; someone who already has one
 * is *changing* it.
 */
export function PasswordSettingsDialog({ onClose }: { onClose: () => void }) {
  const { user, notify } = useAuth();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string | null; confirm?: string | null }>({});
  const [result, setResult] = useState<AuthResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void hasPasswordIdentity().then((value) => {
      if (alive) setHasPassword(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const passwordError = validatePassword(password);
    const confirmError = passwordError ? null : validatePasswordConfirmation(password, confirm);
    setErrors({ password: passwordError, confirm: confirmError });
    if (passwordError || confirmError) return;

    setSaving(true);
    setResult(null);
    void updatePassword(password, confirm).then((res) => {
      setResult(res);
      setSaving(false);
      if (res.ok) {
        setPassword("");
        setConfirm("");
        setHasPassword(true);
        notify(hasPassword ? "Password changed." : "Password set — you can now sign in with it.", "success");
      }
    });
  };

  const settingUp = hasPassword === false;
  const title = settingUp ? "Set a password" : "Change your password";

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto sm:items-center sm:py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-settings-title"
    >
      <button aria-label="Close" className="absolute inset-0 bg-ink/70 backdrop-blur-md" onClick={onClose} />
      <motion.div
        className="glass relative my-auto w-full max-w-[440px] rounded-t-2xl p-7 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] sm:rounded-2xl"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-fog transition hover:bg-white/5 hover:text-snow" aria-label="Close dialog">
          <X className="h-4 w-4" />
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-electric/25 bg-electric/10 text-electric-light">
          <KeyRound className="h-4.5 w-4.5" />
        </div>
        <h2 id="password-settings-title" className="mt-4 text-lg font-semibold tracking-tight text-snow">
          {title}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fog">
          {hasPassword === null
            ? "Checking your sign-in methods…"
            : settingUp
              ? `You currently sign in with a magic link or Google. Add a password and you'll be able to use ${user?.email ?? "your email"} and a password too — the other methods keep working.`
              : "Choose a new password. You'll stay signed in on this device."}
        </p>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-3.5">
          <PasswordField
            label={settingUp ? "Password" : "New password"}
            showLabel
            autoComplete="new-password"
            value={password}
            error={errors.password}
            disabled={saving || hasPassword === null}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((p) => ({ ...p, password: null }));
            }}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          />
          <PasswordField
            label="Confirm password"
            showLabel
            autoComplete="new-password"
            value={confirm}
            error={errors.confirm}
            disabled={saving || hasPassword === null}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (errors.confirm) setErrors((p) => ({ ...p, confirm: null }));
            }}
            placeholder="Re-enter the password"
          />

          <div className="flex gap-2.5 pt-1">
            <Button variant="secondary" className="flex-1 justify-center" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 justify-center" disabled={saving || hasPassword === null}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {settingUp ? "Set password" : "Save"}
            </Button>
          </div>
        </form>

        <AnimatePresence mode="wait">
          {result ? (
            <div className="mt-4">
              <FormBanner ok={result.ok}>{result.message}</FormBanner>
            </div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
