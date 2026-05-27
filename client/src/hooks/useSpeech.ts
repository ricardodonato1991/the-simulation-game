import { useCallback, useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- speech OUT (ECHO speaking) -------------------------------------------

export interface SpeechOutput {
  supported: boolean;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  speak: (text: string) => void;
  cancel: () => void;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // ECHO is "her" — prefer a female English voice; fall back to any English voice.
  const pref = ["Samantha", "Victoria", "Karen", "Moira", "Serena", "Google UK English Female", "Microsoft Zira"];
  for (const name of pref) {
    const v = voices.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return voices.find((v) => v.lang.startsWith("en")) ?? voices[0];
}

export function useSpeechOutput(): SpeechOutput {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [enabled, setEnabled] = useState(false);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !enabled) return;
      const clean = text.replace(/[*_`#>\[\]]/g, "").replace(/\s+/g, " ").trim();
      if (!clean) return;
      const u = new SpeechSynthesisUtterance(clean.slice(0, 600));
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = 1.03;
      u.pitch = 1.05;
      window.speechSynthesis.cancel(); // never let replies stack up
      window.speechSynthesis.speak(u);
    },
    [supported, enabled]
  );

  const cancel = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  // Some browsers need a nudge to populate the voice list.
  useEffect(() => {
    if (supported) window.speechSynthesis.getVoices();
  }, [supported]);

  return { supported, enabled, setEnabled, speak, cancel };
}

// --- speech IN (Ricardo speaking to ECHO) ---------------------------------

export interface SpeechInput {
  supported: boolean;
  listening: boolean;
  toggle: () => void;
}

export function useSpeechInput(handlers: {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
}): SpeechInput {
  const SR: any =
    typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
  const supported = !!SR;
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  // Keep latest handlers without re-creating the recognizer.
  const hRef = useRef(handlers);
  hRef.current = handlers;

  useEffect(() => {
    if (!supported) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim) hRef.current.onInterim(interim);
      if (final) hRef.current.onFinal(final.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, [SR, supported]);

  const toggle = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      try {
        rec.start();
        setListening(true);
      } catch {
        /* already started */
      }
    }
  }, [listening]);

  return { supported, listening, toggle };
}
