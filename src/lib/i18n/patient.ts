export type Lang = "en" | "hi";

const en = {
  journey: "Your liver care journey",
  hello: "Hello",
  helper: "Booking helper",
  nearest: "Nearest",
  earliest: "Earliest",
  morning: "Morning",
  use: "Use this suggestion",
  pick: "Choose a place and a time",
  confirm: "Confirm booking",
  resched: "You missed this appointment. Choose a new time.",
  booked: "Booking confirmed",
  seeYou: "See you at {place} on {slot}. We will remind you the day before.",
  noSlots: "No times are open right now. Please check again later.",
  linkInvalid: "This link has expired or is not valid. Please ask your clinic for a new one.",
  nothingToBook: "There is nothing to book right now.",
  away: "km away",
  slotTaken: "That time was just taken. Please choose another.",
  somethingWrong: "Something went wrong. Please try again.",
  titleLab: "Book your blood test",
  titleCentre: "Book your FibroScan",
  titleEval: "Book your additional investigation",
  titleSpecialist: "Book your specialist visit",
  titleRoutine: "Book your follow-up",
  language: "हिन्दी",
} as const;

export type PatientKey = keyof typeof en;

// Hindi wording is a first draft for clinical and language review (Kanya's content/messages.md replaces it).
const hi: Record<PatientKey, string> = {
  journey: "आपकी लिवर केयर यात्रा",
  hello: "नमस्ते",
  helper: "बुकिंग सहायक",
  nearest: "सबसे नज़दीक",
  earliest: "सबसे जल्दी",
  morning: "सुबह का समय",
  use: "यह सुझाव चुनें",
  pick: "जगह और समय चुनें",
  confirm: "बुकिंग पक्की करें",
  resched: "आप अपॉइंटमेंट पर नहीं आ सके। नया समय चुनें।",
  booked: "बुकिंग पक्की हो गई",
  seeYou: "{slot} को {place} पर मिलते हैं। हम एक दिन पहले आपको याद दिलाएँगे।",
  noSlots: "अभी कोई समय खाली नहीं है। कृपया बाद में फिर देखें।",
  linkInvalid: "यह लिंक समाप्त हो गया है या सही नहीं है। कृपया अपने क्लिनिक से नया लिंक माँगें।",
  nothingToBook: "अभी बुक करने के लिए कुछ नहीं है।",
  away: "किमी दूर",
  slotTaken: "वह समय अभी भर गया। कृपया दूसरा चुनें।",
  somethingWrong: "कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।",
  titleLab: "अपना ब्लड टेस्ट बुक करें",
  titleCentre: "अपना फाइब्रोस्कैन बुक करें",
  titleEval: "अपनी अतिरिक्त जाँच बुक करें",
  titleSpecialist: "विशेषज्ञ से मिलने का समय बुक करें",
  titleRoutine: "अपना फ़ॉलो-अप बुक करें",
  language: "English",
};

export const patientStrings: Record<Lang, Record<PatientKey, string>> = { en, hi };

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "hi";
}

/** Looks up a string and fills {placeholders}. */
export function t(lang: Lang, key: PatientKey, values: Record<string, string> = {}): string {
  return Object.entries(values).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), patientStrings[lang][key]);
}

export const TITLE_KEY = {
  lab: "titleLab",
  centre: "titleCentre",
  eval: "titleEval",
  specialist: "titleSpecialist",
  routine: "titleRoutine",
} as const satisfies Record<string, PatientKey>;
