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
  useRef,
  useState,
  type ReactNode,
} from "react";

const LS_KEY = "factoryos_click_sound"; // "1" = enabled (default), "0" = muted
const LS_HOVER_KEY = "factoryos_hover_sound"; // "1" = enabled, "0" = muted (default: muted)
const DEFAULT_ENABLED = true;
const DEFAULT_HOVER_ENABLED = false;

export type ClickSoundVariant = "plain" | "primary" | "emerald";

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
let _lastHoverPlayAt = 0;

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
    const emerald = variant === "emerald";
    const t = ac.currentTime + 0.001;

    const master = ac.createGain();
    master.gain.value = emerald ? 0.45 : primary ? 0.5 : 0.38;
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

/**
 * Play a positive-action ping (inspect started, record saved).
 */
export function playInspectStart(): void {
  playClickSound("emerald");
}

// ── Sound context ────────────────────────────────────────────────────────────

interface SoundContextValue {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  toggle: () => void;
  play: (variant?: ClickSoundVariant) => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

export function useSoundContext(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error("useSoundContext used outside SoundProvider");
  return ctx;
}

// ── SoundProvider ────────────────────────────────────────────────────────────

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledRaw] = useState(DEFAULT_ENABLED);
  const [hoverEnabled, setHoverEnabledRaw] = useState(DEFAULT_HOVER_ENABLED);

  // Persist to localStorage — re-read on mount so the persisted choice survives
  // hot reloads and SSR/CSR mismatches.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved !== null) setEnabledRaw(saved === "1");
    } catch {
      // Storage can throw in restricted contexts (private mode, iframes).
    }
  }, []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_HOVER_KEY);
      if (saved !== null) setHoverEnabledRaw(saved === "1");
    } catch {
      // Storage can throw in restricted contexts.
    }
  }, []);

  const setEnabled = useCallback(
    (v: boolean) => {
      setEnabledRaw(v);
      try {
        localStorage.setItem(LS_KEY, v ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    [],
  );
  const setHoverEnabled = useCallback(
    (v: boolean) => {
      setHoverEnabledRaw(v);
      try {
        localStorage.setItem(LS_HOVER_KEY, v ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const toggle = useCallback(() => {
    setEnabledRaw(!enabled);
    try {
      localStorage.setItem(LS_KEY, !enabled ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [enabled]);

  const play = useCallback(
    (variant: ClickSoundVariant = "plain") => {
      if (enabled) playClickSound(variant);
    },
    [enabled],
  );

  const value = useMemo<SoundContextValue>(
    () => ({
      enabled,
      setEnabled,
      toggle,
      play,
    }),
    [enabled, setEnabled, toggle, play],
  );

  return (
    <SoundContext.Provider value={value}>
      {children}
      <GlobalClickSoundLayer hoverEnabled={hoverEnabled} onHoverToggle={() => setHoverEnabled(!hoverEnabled)} />
    </SoundContext.Provider>
  );
}

// ── Global click + hover sound layer ──────────────────────────────────────────

export function GlobalClickSoundLayer({
  onHoverToggle,
  hoverEnabled,
}: {
  onHoverToggle: () => void;
  hoverEnabled: boolean;
}) {
  const play = useSoundContext().play;

  // Delegate document-level click ticks to roughly match the project's existing
  // per-button sound pattern — no per-component wiring required. A short throttle
  // per (element, event) pair keeps rapid repeated clicks from becoming a
  // machine-gun burst.
  const lastTicked = useRef(new WeakMap<EventTarget, number>());
  const lastHoverPlayed = useRef(new WeakMap<EventTarget, number>());
  const THROTTLE_MS = 30;

  const onClickCapture = useCallback(
    (event: MouseEvent) => {
      const target: EventTarget | null = event.target;
      if (!target) return;
      const now = performance.now();
      const last = lastTicked.current.get(target) ?? 0;
      if (now - last < THROTTLE_MS) return;
      lastTicked.current.set(target, now);

      // Skip disabled controls.
      if (
        (target instanceof HTMLButtonElement && target.disabled) ||
        (target instanceof HTMLInputElement && target.disabled) ||
        (target instanceof Element && target.getAttribute("aria-disabled") === "true")
      ) {
        return;
      }

      // Respect per-element opt-out.
      let el: Element | null = target as Element | null;
      while (el) {
        if (el.getAttribute("data-no-click-sound") === "true") return;
        el = el.parentElement;
      }

      const variant: ClickSoundVariant =
        target instanceof HTMLElement && target.dataset.primary === "true"
          ? "primary"
          : event.shiftKey
            ? "primary"
            : "plain";

      play(variant);
    },
    [play],
  );

  // Renders nothing — both listeners attach to `document` via effects, so the
  // server and client markup stay identical (no hydration mismatch).
  return <GlobalClickSoundLayerCapture onClick={onClickCapture} onHover={hoverEnabled ? onHoverCapture : null} />;

  function onHoverCapture(event: MouseEvent) {
    const target: EventTarget | null = event.target;
    if (!target) return;
    const now = performance.now();
    const last = lastHoverPlayed.current.get(target) ?? 0;
    if (now - last < HOVER_THROTTLE_MS) return;
    lastHoverPlayed.current.set(target, now);

    if (
      (target instanceof HTMLButtonElement && target.disabled) ||
      (target instanceof HTMLInputElement && target.disabled) ||
      (target instanceof Element && target.getAttribute("aria-disabled") === "true")
    ) {
      return;
    }

    let el: Element | null = target as Element | null;
    while (el) {
      if (el.getAttribute("data-no-click-sound") === "true") return;
      el = el.parentElement;
    }

    play("plain");
  }
}

const HOVER_THROTTLE_MS = 120;

// ── Dispatch helpers ──────────────────────────────────────────────────────────

function GlobalClickSoundLayerCapture({
  onClick,
  onHover,
}: {
  onClick: (event: MouseEvent) => void;
  onHover: ((event: MouseEvent) => void) | null;
}) {
  useEffect(() => {
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [onClick]);

  useEffect(() => {
    if (!onHover) return;
    document.addEventListener("mouseover", onHover, true);
    return () => document.removeEventListener("mouseover", onHover, true);
  }, [onHover]);

  return null;
}

// ── Reusable hook ────────────────────────────────────────────────────────────

export function useClickSound() {
  const { enabled, setEnabled, toggle, play } = useSoundContext();
  return useMemo(
    () => ({
      enabled,
      setEnabled,
      toggle,
      play: (variant?: ClickSoundVariant) => play(variant),
    }),
    [enabled, setEnabled, toggle, play],
  );
}

