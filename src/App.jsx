import { useCallback, useEffect, useRef, useState } from "react";

const SESSION_MS = 60 * 60 * 1000;
const INTERVAL_MS = 15 * 60 * 1000;
const STORAGE_KEY = "m-clock-start";
const THEME_KEY = "m-theme";
const QUARTERS = 4;

function readStart() {
  const value = parseInt(localStorage.getItem(STORAGE_KEY), 10);
  return Number.isFinite(value) ? value : null;
}

function loadSession() {
  const start = readStart();
  if (!start || Date.now() - start >= SESSION_MS) {
    localStorage.removeItem(STORAGE_KEY);
    return { mode: "idle", start: null, quarters: 0 };
  }
  return { mode: "running", start, quarters: quartersFromStart(start) };
}

function quartersFromStart(start) {
  return Math.min(QUARTERS, Math.floor((Date.now() - start) / INTERVAL_MS));
}

function setHand(el, deg) {
  if (el) el.style.transform = `translate(-50%, -100%) rotate(${deg}deg)`;
}

function applyHands(minuteEl, secondEl, elapsed) {
  const clamped = Math.min(Math.max(elapsed, 0), SESSION_MS);
  setHand(minuteEl, (clamped / SESSION_MS) * 360);
  setHand(secondEl, ((clamped % 60_000) / 60_000) * 360);
}

function App() {
  const [session] = useState(loadSession);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  const [mode, setMode] = useState(session.mode);
  const [litQuarters, setLitQuarters] = useState(session.quarters);

  const audioCtx = useRef(null);
  const startTimeRef = useRef(session.start);
  const minuteRef = useRef(null);
  const secondRef = useRef(null);

  const setElapsedHands = useCallback((elapsed) => {
    applyHands(minuteRef.current, secondRef.current, elapsed);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const playChime = useCallback(() => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.current.state === "suspended") audioCtx.current.resume();

    const ctx = audioCtx.current;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.25, now + 0.06);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
    master.connect(ctx.destination);

    [528, 792].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 1 : 0.32;
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 3.5);
    });
  }, []);

  const goIdle = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    startTimeRef.current = null;
    setElapsedHands(0);
    setLitQuarters(0);
    setMode("idle");
  }, [setElapsedHands]);

  const goDone = useCallback(() => {
    setElapsedHands(SESSION_MS);
    setLitQuarters(QUARTERS);
    setMode("done");
  }, [setElapsedHands]);

  useEffect(() => {
    if (mode !== "running" || !startTimeRef.current) {
      setElapsedHands(mode === "done" ? SESSION_MS : 0);
      return;
    }

    const startTime = startTimeRef.current;
    const alreadyPassed = quartersFromStart(startTime);
    setLitQuarters(alreadyPassed);

    let frameId = 0;
    const tick = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= SESSION_MS) {
        goDone();
        return;
      }
      setElapsedHands(elapsed);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    const timers = [];
    for (let q = alreadyPassed + 1; q <= QUARTERS; q++) {
      const delay = q * INTERVAL_MS - (Date.now() - startTime);
      timers.push(
        setTimeout(
          () => {
            setLitQuarters(q);
            playChime();
            if (q === QUARTERS) goDone();
          },
          Math.max(0, delay),
        ),
      );
    }

    return () => {
      cancelAnimationFrame(frameId);
      timers.forEach(clearTimeout);
    };
  }, [mode, goDone, playChime, setElapsedHands]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  function onMainClick() {
    if (mode !== "idle") {
      goIdle();
      return;
    }

    playChime();
    const startTime = Date.now();
    localStorage.setItem(STORAGE_KEY, String(startTime));
    startTimeRef.current = startTime;
    setElapsedHands(0);
    setLitQuarters(0);
    setMode("running");
  }

  return (
    <div className="app">
      <header>
        <span className="brand">M</span>
        <div className="controls">
          <button
            className="icon-btn"
            aria-label="Test sound"
            title="Test sound"
            onClick={playChime}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </button>
          <button
            className="icon-btn"
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
            onClick={toggleTheme}
          >
            <svg
              className="sun"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" />
            </svg>
            <svg
              className="moon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 13.2A9 9 0 1 1 10.8 3a7 7 0 0 0 10.2 10.2Z" />
            </svg>
          </button>
        </div>
      </header>

      <main>
        <div className="clock-face">
          {[1, 2, 3, 4].map((q) => (
            <div key={q} className={`quarter-mark${litQuarters >= q ? " lit" : ""}`} data-q={q} />
          ))}
          <div ref={minuteRef} className="hand hand--minute" />
          <div ref={secondRef} className="hand hand--second" />
          <button className="main-btn" onClick={onMainClick}>
            {mode === "idle" ? "START" : "RESET"}
          </button>
        </div>
        <div className="copy">
          {mode === "done" ? <p className="status">Session complete.</p> : null}
          <p className="caption">Chimes every 15 minutes, then stops at 1 hour.</p>
        </div>
      </main>
    </div>
  );
}

export default App;
