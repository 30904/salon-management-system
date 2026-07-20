import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "s21_install_prompt_dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/crios|fxios|edgios|chrome|chromium|android/i.test(ua);
}

/**
 * Captures Chrome/Edge `beforeinstallprompt` and exposes install() for a Home CTA.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }

    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const mq = window.matchMedia("(display-mode: standalone)");
    const onModeChange = () => setInstalled(isStandalone());
    mq.addEventListener?.("change", onModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener?.("change", onModeChange);
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const restore = useCallback(() => {
    setDismissed(false);
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return { ok: false, reason: "unavailable" };
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === "accepted") {
        setInstalled(true);
        return { ok: true };
      }
      return { ok: false, reason: "dismissed" };
    } catch {
      return { ok: false, reason: "error" };
    } finally {
      setInstalling(false);
    }
  }, [deferredPrompt]);

  return {
    canInstall: Boolean(deferredPrompt) && !installed,
    installing,
    installed,
    dismissed,
    isIos: isIos(),
    isIosSafari: isIos() && isSafari(),
    install,
    dismiss,
    restore,
  };
}
