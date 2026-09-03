// use-click-sound.tsx — subtle mechanical click feedback for buttons and nav.
//
// Three pieces, following the project's existing use-theme/use-auth pattern:
//   • SoundProvider        — holds the muted/enabled preference, persisted to
//                            localStorage ("factoryos_click_sound"). Mounted once
//                            at the root so every page (landing, auth, app shell)
//                            shares one mute state.
//   • GlobalClickSoundLayer — a single delegated capture-phase click listener on
//                            document that ticks for every button / link /
//                            role="button" click app-wide — no per-page wiring.
//   • useClickSound()       — reusable hook for components that need manual
//                            control: { enabled, setEnabled, toggle, play }.
//
// The sound itself is synthesized with the Web Audio API (no asset file to
// download): a short high-passed noise burst for the "tick" attack plus a fast
// decaying sine for the mechanical body. Total duration ≈ 90 ms — well under
// the 150 ms limit — and gains are kept low so it never feels intrusive.
//
// Opting out per element: add data-no-click-sound="true" to any element (or an
// ancestor) that should stay silent.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const LS_KEY = "factoryos_click_sound"; // "1" = enabled (default), "0" = muted
const DEFAULT_ENABLED = true;

export type ClickSoundVariant = "plain" | "primary";

// ── Web Audio engine ─────────────────────────────────────────────────────────

let _audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    if (!_audioCtx) _audioCtx = new AC();
    // The first call happens inside a user gesture (a click), so resuming here
    // satisfies browser autoplay policies.
    if (_audioCtx.state === "suspended") void _audioCtx.resume().catch(() => {});
    return _audioCtx;
  } catch {
    return null;
  }
}

let _lastPlayAt = 0;

/**
 * Play the short mechanical tick. Safe to call from any event handler; no-ops
 * when Web Audio is unavailable. A hard 25 ms throttle prevents a machine-gun
 * burst from held Enter/rapid clicks.
 */
export function playClickSound(variant: ClickSoundVariant = "plain"): void {
  const ac = getAudioContext();
  if (!ac) return;
  const now = performance.now();
  if (now - _lastPlayAt < 25) return;
  _lastPlayAt = now;
  try {
    const primary = variant === "primary";
    const t = ac.currentTime + 0.001;

    const master = ac.createGain();
    master.gain.value = primary ? 0.5 : 0.38;
    master.connect(ac.destination);

    // Attack transient — 18 ms of white noise through a high-pass gives the
    // crisp "tick" that reads as a key/relay click.
    const dur = 0.018;
    const buf = ac.createBuffer(1, Math.max(1, Math.ceil(ac.sampleRate * dur)), ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ac.createBufferSource();
    noise.buffer = buf;
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = primary ? 1100 : 1800;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.55, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    noise.connect(hp);
    hp.connect(ng);
    ng.connect(master);
    noise.start(t);
    noise.stop(t + 0.05);

    // Body — a short descending sine adds the damped mechanical "thock".
    const osc = ac.createOscillator();
    osc.type = "sine";
    const f0 = primary ? 640 : 860;
    osc.frequency.setValueAtTime(f0, t + 0.005);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.075);
    const og = ac.createGain();
    og.gain.setValueAtTime(0.0001, t + 0.005);
    og.gain.exponentialRampToValueAtTime(primary ? 0.85 : 0.6, t + 0.009);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
    osc.connect(og);
    og.connect(master);
    osc.start(t + 0.005);
    osc.stop(t + 0.11);
  } catch {
    // Audio is best-effort — never let a sound failure break a click.
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────

interface ClickSoundCtx {
  /** Whether click sounds currently play. */
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  toggle: () => void;
  /** Manually play a tick right now (unconditional — for explicit feedback). */
  play: (variant?: ClickSoundVariant) => void;
}

const Ctx = createContext<ClickSoundCtx>({
  enabled: DEFAULT_ENABLED,
  setEnabled: () => {},
  toggle: () => {},
  play: () => {},
});

export function SoundProvider({ children }: { children: ReactNode }) {
  // Always start enabled on server and client so SSR HTML and the first client
  // render are identical (same hydration-safe pattern as use-theme). The stored
  // preference is restored right after hydration.
  const [enabled, setEnabledState] = useState<boolean>(DEFAULT_ENABLED);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw !== null) setEnabledState(raw !== "0");
    } catch {
      // Ignore storage failures — default stays enabled
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, enabled ? "1" : "0");
    } catch {
      // Ignore storage failures
    }
  }, [enabled]);

  const setEnabled = useCallback((v: boolean) => setEnabledState(v), []);
  const toggle = useCallback(() => setEnabledState((e) => !e), []);
  const play = useCallback((variant?: ClickSoundVariant) => playClickSound(variant), []);

  const value = useMemo(
    () => ({ enabled, setEnabled, toggle, play }),
    [enabled, setEnabled, toggle, play],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClickSound() {
  return useContext(Ctx);
}

// ── Global delegated layer ───────────────────────────────────────────────────

const CLICKABLE_SELECTOR = [
  "button",
  'a[href]',
  '[role="button"]',
  '[role="switch"]',
  'input[type="button"]',
  'input[type="submit"]',
  "summary",
].join(", ");

/**
 * Mount once inside SoundProvider. Listens on document in the capture phase so
 * the tick plays even when a handler lower in the tree calls stopPropagation,
 * and fires before route transitions unmount the clicked element. Primary
 * actions (solid/destructive buttons) get a slightly deeper tick; plain links,
 * ghost buttons and nav items get a lighter one.
 */
export function GlobalClickSoundLayer() {
  const { enabled } = useClickSound();

  useEffect(() => {
    if (!enabled) return;

    const onClickCapture = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-no-click-sound]")) return;
      const el = target.closest<HTMLElement>(CLICKABLE_SELECTOR);
      if (!el) return;
      if (
        (el instanceof HTMLButtonElement && el.disabled) ||
        (el instanceof HTMLInputElement && el.disabled) ||
        el.getAttribute("aria-disabled") === "true"
      ) {
        return;
      }
      const isPrimary =
        el.classList.contains("bg-primary") ||
        el.classList.contains("bg-destructive") ||
        !!el.closest(".bg-primary, .bg-destructive");
      playClickSound(isPrimary ? "primary" : "plain");
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [enabled]);

  return null;
}
