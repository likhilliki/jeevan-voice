// Browser Web Speech API helpers — no API key required.
// Works in Chrome, Edge, Safari (limited), and most Chromium-based browsers.

type SR = SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
    speechSynthesis?: SpeechSynthesis;
  }
}

const LANG_MAP: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  kn: "kn-IN",
  auto: "en-IN",
};

export function isSpeechRecognitionSupported(): boolean {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  return !!window.speechSynthesis;
}

export function startListening(
  language: string,
  onResult: (transcript: string) => void,
  onError: (error: string) => void,
  onEnd?: () => void,
): SR | null {
  const SRClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SRClass) {
    onError("Speech recognition not supported in this browser");
    return null;
  }

  const recognition = new SRClass();
  recognition.lang = LANG_MAP[language] || "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (e: SpeechRecognitionEvent) => {
    const transcript = e.results[0]?.[0]?.transcript || "";
    if (transcript) onResult(transcript);
  };

  recognition.onerror = (e: Event) => {
    const errorEvent = e as Event & { error?: string };
    onError(errorEvent.error || "Speech recognition error");
  };

  recognition.onend = () => {
    if (onEnd) onEnd();
  };

  try {
    recognition.start();
    return recognition;
  } catch (err) {
    onError(String(err));
    return null;
  }
}

export function speak(text: string, language: string): void {
  if (!window.speechSynthesis) return;
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANG_MAP[language] || "en-IN";
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}
