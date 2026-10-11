/**
 * Message templates in English and Hindi (mocked sending). Logistics only: never a lab value, score or clinical text.
 * The Hindi wording is a first draft for clinical and language review; Kanya's content/messages.md replaces it, along
 * with the regional language.
 */
export type MessageLang = "en" | "hi";

const en = {
  testsOrdered: (url: string, ultrasound: boolean, progress?: string) =>
    `Your doctor has requested some blood tests${ultrasound ? " and an ultrasound" : ""}. Tap to book an appointment at a nearby lab: ${url}${progress ? `\nTrack your progress: ${progress}` : ""}`,
  fibroscanApproved: (url: string) => `Your doctor has recommended a FibroScan. Tap to book at a nearby diagnostic centre: ${url}`,
  furtherEvaluation: (url: string) => `Your doctor has ordered an additional investigation. Tap to book: ${url}`,
  specialistReferral: (url: string) => `Your doctor has referred you to a specialist. Tap to book: ${url}`,
  routineFollowUp: (months: number) => `Your follow-up appointment is scheduled in ${months} months. We will remind you before the date.`,
  missed: (url: string) => `You missed your appointment. Tap to choose a new time: ${url}`,
  rescheduleOffer: (place: string, slot: string, url: string) =>
    `You missed your appointment. We suggest ${place}, ${slot}. Tap to confirm it or choose another time: ${url}`,
  bookingConfirmed: (place: string, slot: string) => `Booking confirmed: ${place}, ${slot}. We will remind you the day before.`,
  rescheduled: (place: string, slot: string) => `Rescheduled: ${place}, ${slot}.`,
  reminder: (url: string) => `Reminder: your next step is overdue. Tap to continue: ${url}`,
  existingReportUsed: (progress?: string) =>
    `Your doctor will use your existing lab reports, with your consent. No repeat test is needed. We will update you after the review.${progress ? `\nTrack your progress: ${progress}` : ""}`,
};

export type Templates = typeof en;

const hi: Templates = {
  testsOrdered: (url, ultrasound, progress) =>
    `आपके डॉक्टर ने कुछ ब्लड टेस्ट${ultrasound ? " और अल्ट्रासाउंड" : ""} कराने को कहा है। पास की लैब में अपॉइंटमेंट बुक करने के लिए यहाँ टैप करें: ${url}${progress ? `\nअपनी प्रगति देखें: ${progress}` : ""}`,
  fibroscanApproved: (url) => `आपके डॉक्टर ने फाइब्रोस्कैन की सलाह दी है। पास के डायग्नोस्टिक सेंटर में बुक करने के लिए यहाँ टैप करें: ${url}`,
  furtherEvaluation: (url) => `आपके डॉक्टर ने एक अतिरिक्त जाँच कराने को कहा है। बुक करने के लिए यहाँ टैप करें: ${url}`,
  specialistReferral: (url) => `आपके डॉक्टर ने आपको विशेषज्ञ के पास भेजा है। बुक करने के लिए यहाँ टैप करें: ${url}`,
  routineFollowUp: (months) => `आपका फ़ॉलो-अप अपॉइंटमेंट ${months} महीने बाद तय हुआ है। तारीख से पहले हम आपको याद दिलाएँगे।`,
  missed: (url) => `आप अपना अपॉइंटमेंट चूक गए। नया समय चुनने के लिए यहाँ टैप करें: ${url}`,
  rescheduleOffer: (place, slot, url) =>
    `आप अपना अपॉइंटमेंट चूक गए। हमारा सुझाव है: ${place}, ${slot}। इसे पक्का करने या दूसरा समय चुनने के लिए यहाँ टैप करें: ${url}`,
  bookingConfirmed: (place, slot) => `बुकिंग पक्की हो गई: ${place}, ${slot}। हम एक दिन पहले आपको याद दिलाएँगे।`,
  rescheduled: (place, slot) => `नया समय तय हुआ: ${place}, ${slot}।`,
  reminder: (url) => `याद दिलाना: आपका अगला कदम अभी बाकी है। जारी रखने के लिए यहाँ टैप करें: ${url}`,
  existingReportUsed: (progress) =>
    `आपके डॉक्टर आपकी मौजूदा लैब रिपोर्ट आपकी सहमति से इस्तेमाल करेंगे। दोबारा टेस्ट की ज़रूरत नहीं है। समीक्षा के बाद हम आपको बताएँगे।${progress ? `\nअपनी प्रगति देखें: ${progress}` : ""}`,
};

/** The templates for a patient's language. English is the fallback. */
export function templatesFor(language: MessageLang | string | null | undefined): Templates {
  return language === "hi" ? hi : en;
}

/** English templates, kept for tests and callers that have no patient. */
export const templates = en;
