import { useState } from "react";
import { useInstallPrompt } from "../hooks/useInstallPrompt.js";

export default function InstallAppCard() {
  const {
    canInstall,
    installing,
    installed,
    dismissed,
    isIos,
    isIosSafari,
    install,
    dismiss,
    restore,
  } = useInstallPrompt();
  const [message, setMessage] = useState(null);
  const [showSteps, setShowSteps] = useState(false);

  if (installed) {
    return (
      <section className="install-card install-card--done">
        <div className="install-card__icon" aria-hidden="true">
          ✓
        </div>
        <div>
          <strong>S21 is installed</strong>
          <p>You&apos;re using the app from your home screen.</p>
        </div>
      </section>
    );
  }

  if (dismissed) {
    return (
      <button type="button" className="install-chip" onClick={restore}>
        Install S21 app on this phone
      </button>
    );
  }

  async function handleInstall() {
    setMessage(null);
    if (canInstall) {
      const result = await install();
      if (result.ok) {
        setMessage("Installed — look for S21 on your home screen.");
      } else if (result.reason === "dismissed") {
        setMessage("Install cancelled. Tap again anytime.");
      } else {
        setMessage("Could not open the install dialog. Try the steps below.");
        setShowSteps(true);
      }
      return;
    }
    setShowSteps(true);
  }

  return (
    <section className="install-card">
      <div className="install-card__top">
        <div className="install-card__icon" aria-hidden="true">
          ↓
        </div>
        <button type="button" className="install-card__dismiss" onClick={dismiss} aria-label="Dismiss">
          ×
        </button>
      </div>

      <strong className="install-card__title">Install S21 on your phone</strong>
      <p className="install-card__body">
        Add this app to your home screen for one-tap punch-in, earnings, and team sales — works like a normal app, no Play Store / App Store needed.
      </p>

      <button
        type="button"
        className="btn btn-primary btn-block install-card__cta"
        onClick={handleInstall}
        disabled={installing}
      >
        {installing ? "Opening install…" : canInstall ? "Install S21 app" : "How to install"}
      </button>

      {message && <p className="install-card__msg">{message}</p>}

      {(showSteps || !canInstall) && (
        <ol className="install-steps">
          {isIos || isIosSafari ? (
            <>
              <li>
                Tap the <strong>Share</strong> button in Safari (square with ↑).
              </li>
              <li>
                Scroll and tap <strong>Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong>Add</strong> — the S21 icon appears on your home screen.
              </li>
            </>
          ) : (
            <>
              <li>
                On <strong>Chrome</strong> (phone or laptop), open this page at{" "}
                <code>localhost:5175</code> (or your salon URL).
              </li>
              <li>
                Tap the install icon in the address bar, or use menu →{" "}
                <strong>Install app</strong> / <strong>Add to Home screen</strong>.
              </li>
              <li>
                Or tap <strong>Install S21 app</strong> above when Chrome shows the prompt.
              </li>
            </>
          )}
        </ol>
      )}
    </section>
  );
}
