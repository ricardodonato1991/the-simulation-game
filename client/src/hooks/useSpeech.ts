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

// ECHO is "her" — always speak with a female voice.
const FEMALE_VOICES = [
  "Samantha", "Victoria", "Allison", "Ava", "Susan", "Zoe", "Karen", "Moira",
  "Tessa", "Fiona", "Serena", "Nicky", "Google UK English Female", "Google US English",
  "Microsoft Zira", "Microsoft Aria", "Microsoft Jenny", "Female",
];
const MALE_VOICES = ["Daniel", "Alex", "Fred", "Guy", "David", "Mark", "Oliver", "Aaron", "Male", "Rishi"];

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  for (const name of FEMALE_VOICES) {
    const v = voices.find((x) => x.name.includes(name));
    if (v) return v;
  }
  // Fall back to an English voice that isn't a known male voice.
  const en = voices.filter((v) => v.lang.startsWith("en"));
  return en.find((v) => !MALE_VOICES.some((m) => v.name.includes(m))) ?? en[0] ?? voices[0];
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
