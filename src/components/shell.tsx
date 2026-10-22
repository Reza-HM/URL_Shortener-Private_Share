"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  ArrowRight,
  Moon,
  Sun,
  X,
  ShieldCheck,
  Link2,
  LockKeyhole,
} from "lucide-react";

let themeOverride: boolean | null = null;
function themeSnapshot() {
  if (themeOverride !== null) return themeOverride;
  let preference: string | null = null;
  try {
    preference = localStorage.getItem("relay-theme");
  } catch {
    /* Storage is optional. */
  }
  return (
    preference === "dark" ||
    (!preference && window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}
function subscribeTheme(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const storage = () => {
    themeOverride = null;
    callback();
  };
  window.addEventListener("storage", storage);
  window.addEventListener("relay-theme-change", callback);
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener("relay-theme-change", callback);
    media.removeEventListener("change", callback);
  };
}
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const dark = useSyncExternalStore(subscribeTheme, themeSnapshot, () => false);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  function toggleTheme() {
    themeOverride = !dark;
    try {
      localStorage.setItem("relay-theme", !dark ? "dark" : "light");
    } catch {
      /* Theme still works without storage. */
    }
    window.dispatchEvent(new Event("relay-theme-change"));
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="Relay home">
            <span className="brand-mark">
              <ArrowUpRight size={24} strokeWidth={2.6} />
            </span>
            relay<span className="brand-dot">.</span>
          </Link>
          <nav aria-label="Main navigation">
            <Link
              className={pathname === "/" ? "nav-link active" : "nav-link"}
              href="/"
            >
              Workspace
            </Link>
            <Link
              className={
                pathname === "/history" ? "nav-link active" : "nav-link"
              }
              href="/history"
            >
              My shares
            </Link>
          </nav>
          <div className="header-actions">
            <HelpDialog />
            <span className="header-separator" />
            <button
              type="button"
              className="icon-button"
              onClick={toggleTheme}
              aria-label={
                dark ? "Switch to light theme" : "Switch to dark theme"
              }
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer">
        <Link className="footer-brand" href="/">
          relay.
        </Link>
        <span>A little less friction. A little more connection.</span>
        <span className="footer-note">
          <span className="status-dot" /> No account needed
        </span>
      </footer>
    </>
  );
}
function HelpDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="text-button help-trigger">
          How it works <ArrowUpRight size={14} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title>Built for the handoff.</Dialog.Title>
          <Dialog.Description>
            Two simple ways to send something along, without creating an
            account.
          </Dialog.Description>
          <div className="help-feature">
            <Link2 />
            <div>
              <h3>Short links</h3>
              <p>
                Make a long address easier to share. Add an alias, choose an
                expiry, and keep the private management link to disable or
                delete it.
              </p>
            </div>
          </div>
          <div className="help-feature">
            <LockKeyhole />
            <div>
              <h3>Private Drops</h3>
              <p>
                Your browser encrypts text, code, and files. The key stays in
                the full share link. Optional passwords add a separate access
                gate.
              </p>
            </div>
          </div>
          <div className="help-feature">
            <ShieldCheck />
            <div>
              <h3>You set the limits</h3>
              <p>
                Drops expire after up to seven days. One-time drops disappear
                after one reveal attempt succeeds—even if delivery is
                interrupted. Recipients can still save what they receive.
              </p>
            </div>
          </div>
          <p className="fine-print">
            Keep your management link private. Lost encryption keys cannot be
            recovered. Device history is optional and contains private links.
            Encryption does not protect a compromised browser or altered
            application code.
          </p>
          <Dialog.Close className="primary-button full-width">
            Got it <ArrowRight size={16} />
          </Dialog.Close>
          <Dialog.Close
            className="dialog-close icon-button"
            aria-label="Close help"
          >
            <X size={18} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
