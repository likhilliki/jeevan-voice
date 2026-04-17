export type Intent =
  | "healthcare"
  | "finance"
  | "government"
  | "navigation"
  | "emergency"
  | "general";

export type Language = "en" | "hi" | "kn" | "auto";

const EMERGENCY_KEYWORDS = [
  // English
  "chest pain",
  "chest ache",
  "heart attack",
  "faint",
  "fainting",
  "unconscious",
  "breathing",
  "cant breathe",
  "can't breathe",
  "seizure",
  "stroke",
  "bleeding",
  "accident",
  "emergency",
  "dying",
  "die",
  // Hindi
  "sine mein dard",
  "seene mein dard",
  "dil ka dora",
  "behosh",
  "sans nahi",
  "khoon",
  "gir gaya",
  "haadsa",
  "ataka",
  // Kannada
  "edheyalli novu",
  "ushiru",
  "bedagaali",
  "nayigitha",
];

const HEALTHCARE_KEYWORDS = [
  // English
  "pain",
  "fever",
  "sick",
  "ill",
  "doctor",
  "hospital",
  "medicine",
  "symptom",
  "health",
  "ayushman",
  "treatment",
  "prescription",
  // Hindi
  "dard",
  "bukhar",
  "bimaar",
  "davai",
  "aspatal",
  "doctor",
  "swasth",
  // Kannada
  "novu",
  "jwara",
  "aushadhi",
  "aspathre",
];

const FINANCE_KEYWORDS = [
  // English
  "money",
  "bank",
  "balance",
  "loan",
  "account",
  "transfer",
  "payment",
  "rupees",
  "paisa",
  "scholarship",
  "pension",
  "jan dhan",
  "kisan",
  // Hindi
  "paisa",
  "bank",
  "paisaa",
  "rin",
  "kharcha",
  "bachat",
  "jama",
  // Kannada
  "hana",
  "bank",
  "saal",
  "savina",
];

const GOVERNMENT_KEYWORDS = [
  // English
  "scheme",
  "government",
  "ration",
  "card",
  "aadhaar",
  "aadhar",
  "certificate",
  "apply",
  "form",
  "pension",
  "pm kisan",
  "pm jan dhan",
  "ujjwala",
  "mnrega",
  "nrega",
  "subsidy",
  // Hindi
  "sarkaar",
  "yojana",
  "praman patra",
  "aawedan",
  "rashan",
  // Kannada
  "sarkara",
  "yojane",
  "praman patra",
];

const NAVIGATION_KEYWORDS = [
  // English
  "where",
  "how to go",
  "address",
  "location",
  "direction",
  "route",
  "bus",
  "train",
  "road",
  "hospital address",
  "near",
  // Hindi
  "kahan",
  "kaise jaana",
  "rasta",
  "paas mein",
  // Kannada
  "ellidhe",
  "hogi",
  "hege",
];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[.,!?;:]/g, " ");
}

function containsAnyKeyword(text: string, keywords: string[]): boolean {
  const normalized = normalizeText(text);
  return keywords.some((kw) => normalized.includes(kw.toLowerCase()));
}

export function detectIntent(text: string): Intent {
  // Emergency takes top priority — check first
  if (containsAnyKeyword(text, EMERGENCY_KEYWORDS)) {
    return "emergency";
  }

  if (containsAnyKeyword(text, HEALTHCARE_KEYWORDS)) {
    return "healthcare";
  }

  if (containsAnyKeyword(text, FINANCE_KEYWORDS)) {
    return "finance";
  }

  if (containsAnyKeyword(text, GOVERNMENT_KEYWORDS)) {
    return "government";
  }

  if (containsAnyKeyword(text, NAVIGATION_KEYWORDS)) {
    return "navigation";
  }

  return "general";
}

export function detectLanguage(text: string): Language {
  // Detect Hindi (Devanagari script)
  if (/[\u0900-\u097F]/.test(text)) {
    return "hi";
  }

  // Detect Kannada script
  if (/[\u0C80-\u0CFF]/.test(text)) {
    return "kn";
  }

  // Detect common Hindi romanized words
  const hindiRomanizedWords = [
    "mujhe",
    "kya",
    "hai",
    "mera",
    "meri",
    "hoga",
    "nahi",
    "aur",
    "lekin",
    "kyun",
    "kaise",
    "kahan",
    "abhi",
    "bahut",
    "accha",
    "thoda",
    "paisa",
    "jana",
    "aana",
    "bolo",
  ];
  const normalized = text.toLowerCase();
  const hindiWordCount = hindiRomanizedWords.filter((w) =>
    normalized.includes(w),
  ).length;
  if (hindiWordCount >= 2) {
    return "hi";
  }

  return "en";
}

export function isEmergencySituation(intent: Intent): boolean {
  return intent === "emergency";
}

export function getEmergencyResponse(language: Language): string {
  const responses: Record<Language, string> = {
    en: "This sounds like an emergency! Please call 108 for ambulance right now. Stay calm and stay on the line. Do not move if you are injured.",
    hi: "Yeh bahut zaruri hai! Abhi 108 par call karein ambulance ke liye. Shant rahein aur agar chot lagi hai to mat hilein.",
    kn: "Idu tumba tvareyaagi! Ambulancege eega 108 ge call madi. Shanta agiri mattu gudde ayiddhare aadisabedi.",
    auto: "This sounds like an emergency! Please call 108 for ambulance right now. Stay calm.",
  };
  return responses[language] || responses["en"];
}
