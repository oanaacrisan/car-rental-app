"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Language } from "../lib/i18n";

type FaqItem = {
  question: string;
  answer: string;
  keywords: string[];
};

type ChatMessage = {
  sender: "bot" | "user";
  text: string;
};

type PricingContext = {
  hasPeriod: boolean;
  pickupDate: string;
  dropoffDate: string;
  pickupTime: string;
  returnTime: string;
  overlappingBookings: number;
  demandMultiplier: number;
  cheaperSuggestions: string[];
};

const faqCopy: Record<
  Language,
  {
    button: string;
    sectionLabel: string;
    sectionTitle: string;
    sectionText: string;
    title: string;
    subtitle: string;
    placeholder: string;
    send: string;
    quickQuestions: string;
    fallback: string;
    contact: string;
    intro: string;
    greeting: string;
    priceExplanationQuestion: string;
    cheaperPeriodQuestion: string;
    noPeriodSelected: string;
    standardDemandAnswer: string;
    mediumDemandAnswer: string;
    highDemandAnswer: string;
    cheaperSuggestionIntro: string;
    noCheaperSuggestion: string;
    faqs: FaqItem[];
  }
> = {
  en: {
    button: "Help",
    sectionLabel: "Customer support",
    sectionTitle: "Need help before booking?",
    sectionText:
      "Open the rental assistant and choose a question about documents, deposits, insurance, track use or booking status.",
    title: "Rental assistant",
    subtitle: "Ask about bookings, deposits, insurance and track use.",
    placeholder: "Type your question...",
    send: "Send",
    quickQuestions: "Quick questions",
    fallback:
      "I can help with bookings, documents, deposits, insurance, track use, cancellations and booking status. For a specific case, contact the rental team.",
    contact: "Contact: +40 770 122 982 or contact@nurburgringcarrentals.ro",
    intro:
      "Hi. I can answer the most common rental questions before you send a booking request.",
    greeting:
      "Hi. Choose one of the questions on the left, or ask me about bookings, documents, deposits, insurance, track use, cancellations or booking status.",
    priceExplanationQuestion: "Why did the price increase or decrease?",
    cheaperPeriodQuestion: "Can you suggest a cheaper period?",
    noPeriodSelected:
      "Select pickup and return dates first, and I will explain the current demand level and whether the rental period is standard, medium or high demand.",
    standardDemandAnswer:
      "For the selected period, the price is at the base level because current demand is standard. There are not enough overlapping bookings to apply a surcharge.",
    mediumDemandAnswer:
      "For the selected period, the price is currently about 10% higher because demand is medium. There are already overlapping bookings in that interval, so the dynamic pricing rule adds a moderate increase.",
    highDemandAnswer:
      "For the selected period, the price is currently about 20% higher because demand is high. There are several overlapping bookings in that interval, so the dynamic pricing rule applies the highest surcharge.",
    cheaperSuggestionIntro: "You may find a lower dynamic price in these nearby periods:",
    noCheaperSuggestion:
      "I could not find a cheaper nearby period right now. Try moving the dates by a few days or selecting a less busy weekday interval.",
    faqs: [
      {
        question: "How do I book a car?",
        answer:
          "Choose the rental period, pickup and return time, driver age and vehicle. Then complete the booking form and upload the required documents. The request is first saved as PENDING and reviewed by the rental team.",
        keywords: ["book", "booking", "reserve", "reservation", "request"],
      },
      {
        question: "What documents do I need?",
        answer:
          "You need a valid driving license and an identity document. The documents are reviewed before the booking is confirmed.",
        keywords: ["document", "documents", "license", "id", "passport"],
      },
      {
        question: "How does the deposit work?",
        answer:
          "The deposit is held until the car is returned and inspected. Deductions may apply for missing fuel, late return, dirty interior or exterior, missing accessories or new damage.",
        keywords: ["deposit", "guarantee", "deduction", "refund", "returned"],
      },
      {
        question: "What does deductible mean?",
        answer:
          "The deductible is the maximum amount the customer may still have to pay in an eligible damage case, depending on the selected insurance plan and rental rules.",
        keywords: ["deductible", "excess", "insurance amount"],
      },
      {
        question: "Can I use the car on track?",
        answer:
          "Only vehicles marked as track allowed can be used for circuit sessions. Road only vehicles are not covered for track use.",
        keywords: ["track", "circuit", "nurburgring", "road only"],
      },
      {
        question: "Which insurance should I choose?",
        answer:
          "Road only cars have road rental insurance plans. Track cars have performance/track plans with higher prices and deductibles. Track Cover is the realistic option for circuit use.",
        keywords: ["insurance", "cover", "coverage", "plan"],
      },
      {
        question: "Why can a booking be rejected?",
        answer:
          "A booking can be rejected if the driver does not meet the age or license experience requirements, if documents are invalid, or if the vehicle is not available.",
        keywords: ["reject", "rejected", "refused", "declined"],
      },
      {
        question: "How can I check my booking status?",
        answer:
          "Use the My booking page with the booking ID and email address received after submitting the request.",
        keywords: ["status", "booking id", "reference", "my booking"],
      },
      {
        question: "Can I cancel a booking?",
        answer:
          "Pending bookings can be cancelled before confirmation. Confirmed bookings are reviewed by the rental office and may be subject to administrative fees.",
        keywords: ["cancel", "cancellation", "refund"],
      },
      {
        question: "When do I receive the final PDF?",
        answer:
          "After the vehicle is marked as completed and the return inspection is saved, the final settlement PDF is sent by email and can be reopened from the booking details.",
        keywords: ["pdf", "invoice", "settlement", "receipt", "final"],
      },
      {
        question: "Why did the price increase or decrease?",
        answer: "",
        keywords: ["price", "dynamic", "increase", "decrease", "cheaper", "expensive"],
      },
      {
        question: "Can you suggest a cheaper period?",
        answer: "",
        keywords: ["cheaper period", "cheaper dates", "lower price", "suggest period"],
      },
    ],
  },
  ro: {
    button: "Ajutor",
    sectionLabel: "Suport clienti",
    sectionTitle: "Ai nevoie de ajutor inainte de rezervare?",
    sectionText:
      "Deschide asistentul si alege o intrebare despre documente, garantie, asigurare, circuit sau statusul rezervarii.",
    title: "Asistent inchiriere",
    subtitle: "Intrebari despre rezervari, garantie, asigurare si circuit.",
    placeholder: "Scrie intrebarea...",
    send: "Trimite",
    quickQuestions: "Intrebari rapide",
    fallback:
      "Pot raspunde despre rezervari, documente, garantie, asigurare, circuit, anulari si statusul rezervarii. Pentru un caz exact, contacteaza echipa.",
    contact: "Contact: +40 770 122 982 sau contact@nurburgringcarrentals.ro",
    intro:
      "Buna. Pot raspunde la cele mai frecvente intrebari inainte de trimiterea unei cereri de rezervare.",
    greeting:
      "Buna. Alege o intrebare din stanga sau intreaba-ma despre rezervari, documente, garantie, asigurare, circuit, anulari sau statusul rezervarii.",
    priceExplanationQuestion: "De ce a crescut sau a scazut pretul?",
    cheaperPeriodQuestion: "Imi poti sugera o perioada mai ieftina?",
    noPeriodSelected:
      "Selecteaza mai intai datele de preluare si returnare, iar eu iti pot explica nivelul curent al cererii si daca perioada are cerere standard, medie sau ridicata.",
    standardDemandAnswer:
      "Pentru perioada selectata, pretul este la nivelul de baza deoarece cererea este standard. Nu exista suficiente rezervari suprapuse pentru a aplica un adaos.",
    mediumDemandAnswer:
      "Pentru perioada selectata, pretul este acum cu aproximativ 10% mai mare deoarece cererea este medie. Exista deja rezervari suprapuse in acel interval, asa ca regula de tarifare dinamica adauga o crestere moderata.",
    highDemandAnswer:
      "Pentru perioada selectata, pretul este acum cu aproximativ 20% mai mare deoarece cererea este ridicata. Exista mai multe rezervari suprapuse in acel interval, asa ca regula de tarifare dinamica aplica cel mai mare adaos.",
    cheaperSuggestionIntro: "Ai putea gasi un pret dinamic mai mic in aceste perioade apropiate:",
    noCheaperSuggestion:
      "Nu am gasit acum o perioada apropiata mai ieftina. Incearca sa muti datele cu cateva zile sau sa alegi un interval de mijloc de saptamana, mai putin aglomerat.",
    faqs: [
      {
        question: "Cum rezerv o masina?",
        answer:
          "Alegi perioada, ora de preluare si returnare, varsta soferului si masina. Apoi completezi formularul si incarci documentele. Cererea este salvata initial ca PENDING si verificata de echipa.",
        keywords: ["rezerv", "rezervare", "cerere", "inchiriez"],
      },
      {
        question: "Ce documente sunt necesare?",
        answer:
          "Ai nevoie de permis de conducere valid si act de identitate. Documentele sunt verificate inainte ca rezervarea sa fie confirmata.",
        keywords: ["document", "documente", "permis", "buletin", "carte", "identitate"],
      },
      {
        question: "Cum functioneaza garantia?",
        answer:
          "Garantia ramane blocata pana cand masina este returnata si inspectata. Pot exista deduceri pentru combustibil lipsa, intarziere, interior/exterior murdar, accesorii lipsa sau daune noi.",
        keywords: ["garantie", "depozit", "deducere", "retinere", "returnata"],
      },
      {
        question: "Ce inseamna deductibila?",
        answer:
          "Deductibila este suma maxima pe care clientul o poate suporta intr-un caz eligibil de dauna, in functie de asigurarea aleasa si regulile inchirierii.",
        keywords: ["deductibila", "fransiza", "asigurare"],
      },
      {
        question: "Pot intra cu masina pe circuit?",
        answer:
          "Doar masinile marcate ca permise pe circuit pot fi folosite pentru sesiuni track. Masinile road only nu sunt acoperite pentru utilizare pe circuit.",
        keywords: ["circuit", "track", "nurburgring", "road only"],
      },
      {
        question: "Ce asigurare ar trebui sa aleg?",
        answer:
          "Masinile road only au planuri pentru drum public. Masinile de circuit au planuri performance/track, mai scumpe si cu deductibile mai mari. Pentru circuit, Track Cover este varianta realista.",
        keywords: ["asigurare", "cover", "plan", "acopera"],
      },
      {
        question: "De ce poate fi respinsa o rezervare?",
        answer:
          "Rezervarea poate fi respinsa daca soferul nu indeplineste varsta minima sau anii minimi de permis, daca documentele nu sunt valide sau daca masina nu este disponibila.",
        keywords: ["respinsa", "respinge", "refuzata", "invalid"],
      },
      {
        question: "Cum verific statusul rezervarii?",
        answer:
          "Folosesti pagina Rezervarea mea cu ID-ul rezervarii si adresa de email primite dupa trimiterea cererii.",
        keywords: ["status", "id", "rezervarea mea", "referinta"],
      },
      {
        question: "Pot anula o rezervare?",
        answer:
          "Rezervarile PENDING pot fi anulate inainte de confirmare. Rezervarile confirmate sunt analizate de firma si pot avea taxe administrative.",
        keywords: ["anulare", "anulez", "cancel", "returnare bani"],
      },
      {
        question: "Cand primesc PDF-ul final?",
        answer:
          "Dupa ce masina este marcata completed si inspectia de retur este salvata, documentul final PDF este trimis pe email si poate fi redeschis din detaliile rezervarii.",
        keywords: ["pdf", "factura", "document final", "settlement"],
      },
      {
        question: "De ce a crescut sau a scazut pretul?",
        answer: "",
        keywords: ["pret", "tarifare dinamica", "a crescut", "a scazut", "mai scump", "mai ieftin"],
      },
      {
        question: "Imi poti sugera o perioada mai ieftina?",
        answer: "",
        keywords: ["perioada mai ieftina", "date mai ieftine", "pret mai mic", "sugereaza perioada"],
      },
    ],
  },
  de: {
    button: "Hilfe",
    sectionLabel: "Kundensupport",
    sectionTitle: "Brauchen Sie Hilfe vor der Buchung?",
    sectionText:
      "Offnen Sie den Mietassistenten und wahlen Sie eine Frage zu Dokumenten, Kaution, Versicherung, Strecke oder Buchungsstatus.",
    title: "Mietassistent",
    subtitle: "Fragen zu Buchung, Kaution, Versicherung und Strecke.",
    placeholder: "Frage eingeben...",
    send: "Senden",
    quickQuestions: "Schnelle Fragen",
    fallback:
      "Ich kann bei Buchungen, Dokumenten, Kaution, Versicherung, Streckennutzung, Stornierung und Buchungsstatus helfen. Fur einen konkreten Fall kontaktieren Sie bitte das Team.",
    contact: "Kontakt: +40 770 122 982 oder contact@nurburgringcarrentals.ro",
    intro:
      "Hallo. Ich beantworte die wichtigsten Mietfragen vor dem Absenden einer Buchungsanfrage.",
    greeting:
      "Hallo. Wahlen Sie links eine Frage oder fragen Sie nach Buchung, Dokumenten, Kaution, Versicherung, Strecke, Stornierung oder Buchungsstatus.",
    priceExplanationQuestion: "Warum ist der Preis gestiegen oder gesunken?",
    cheaperPeriodQuestion: "Kannst du einen gunstigeren Zeitraum empfehlen?",
    noPeriodSelected:
      "Wahlen Sie zuerst Abhol- und Ruckgabedatum. Dann kann ich das aktuelle Nachfrageniveau und die dynamische Preisstufe fur diesen Zeitraum erklaren.",
    standardDemandAnswer:
      "Fur den gewahlten Zeitraum bleibt der Preis auf dem Grundniveau, weil die Nachfrage standardmaBig ist. Es gibt nicht genug uberlappende Buchungen fur einen Zuschlag.",
    mediumDemandAnswer:
      "Fur den gewahlten Zeitraum ist der Preis derzeit etwa 10% hoher, weil die Nachfrage mittel ist. Es gibt bereits uberlappende Buchungen in diesem Intervall, deshalb wird ein moderater Zuschlag angewendet.",
    highDemandAnswer:
      "Fur den gewahlten Zeitraum ist der Preis derzeit etwa 20% hoher, weil die Nachfrage hoch ist. Es gibt mehrere uberlappende Buchungen in diesem Intervall, deshalb gilt die hochste dynamische Preisstufe.",
    cheaperSuggestionIntro:
      "In diesen nahegelegenen Zeitraumen konnte der dynamische Preis niedriger sein:",
    noCheaperSuggestion:
      "Ich konnte derzeit keinen gunstigeren nahen Zeitraum finden. Versuchen Sie, die Daten um einige Tage zu verschieben oder einen weniger ausgelasteten Wochentag zu wahlen.",
    faqs: [
      {
        question: "Wie buche ich ein Auto?",
        answer:
          "Wahlen Sie Zeitraum, Abhol- und Ruckgabezeit, Fahreralter und Fahrzeug. Danach senden Sie das Formular mit den Dokumenten ab. Die Anfrage bleibt zuerst PENDING und wird vom Team gepruft.",
        keywords: ["buchung", "buchen", "reservierung", "anfrage"],
      },
      {
        question: "Welche Dokumente brauche ich?",
        answer:
          "Sie brauchen einen gultigen Fuhrerschein und ein Ausweisdokument. Die Dokumente werden vor der Bestatigung gepruft.",
        keywords: ["dokument", "fuhrerschein", "ausweis", "pass"],
      },
      {
        question: "Wie funktioniert die Kaution?",
        answer:
          "Die Kaution bleibt bis zur Ruckgabe und Inspektion hinterlegt. Abzuge sind moglich bei fehlendem Kraftstoff, Verspatung, Verschmutzung, fehlendem Zubehor oder neuen Schaden.",
        keywords: ["kaution", "abzug", "ruckzahlung", "deposit"],
      },
      {
        question: "Was bedeutet Selbstbeteiligung?",
        answer:
          "Die Selbstbeteiligung ist der Betrag, den der Kunde in einem berechtigten Schadensfall je nach Versicherung und Mietregeln tragen kann.",
        keywords: ["selbstbeteiligung", "deductible", "versicherung"],
      },
      {
        question: "Darf ich auf die Rennstrecke?",
        answer:
          "Nur Fahrzeuge mit Track-Freigabe durfen fur Streckensessions genutzt werden. Road-only Fahrzeuge sind nicht fur Streckennutzung abgedeckt.",
        keywords: ["strecke", "track", "circuit", "nurburgring"],
      },
      {
        question: "Welche Versicherung soll ich wahlen?",
        answer:
          "Road-only Fahrzeuge haben normale Strassen-Mietplane. Track-Fahrzeuge haben Performance/Track-Plane mit hoheren Preisen und Selbstbeteiligungen. Fur die Strecke ist Track Cover realistisch.",
        keywords: ["versicherung", "cover", "plan", "abdeckung"],
      },
      {
        question: "Warum kann eine Buchung abgelehnt werden?",
        answer:
          "Eine Buchung kann abgelehnt werden, wenn Mindestalter oder Fuhrerscheinerfahrung nicht passen, Dokumente ungultig sind oder das Fahrzeug nicht verfugbar ist.",
        keywords: ["abgelehnt", "ablehnung", "reject", "ungultig"],
      },
      {
        question: "Wie prufe ich meinen Buchungsstatus?",
        answer:
          "Nutzen Sie die Seite Meine Buchung mit Buchungs-ID und Email-Adresse aus der Bestatigungsnachricht.",
        keywords: ["status", "buchungs-id", "referenz", "meine buchung"],
      },
      {
        question: "Kann ich eine Buchung stornieren?",
        answer:
          "PENDING-Buchungen konnen vor der Bestatigung storniert werden. Bestatigte Buchungen werden vom Vermieter gepruft und konnen Verwaltungsgebuhren verursachen.",
        keywords: ["storno", "stornierung", "cancel"],
      },
      {
        question: "Wann erhalte ich das finale PDF?",
        answer:
          "Nachdem das Fahrzeug als completed markiert und die Ruckgabeinspektion gespeichert wurde, wird das finale PDF per Email gesendet und kann in den Buchungsdetails erneut geoffnet werden.",
        keywords: ["pdf", "rechnung", "settlement", "final"],
      },
      {
        question: "Warum ist der Preis gestiegen oder gesunken?",
        answer: "",
        keywords: ["preis", "dynamisch", "teurer", "gunstiger", "gestiegen", "gesunken"],
      },
      {
        question: "Kannst du einen gunstigeren Zeitraum empfehlen?",
        answer: "",
        keywords: ["gunstiger zeitraum", "billigere daten", "niedriger preis"],
      },
    ],
  },
};

function findAnswer(
  input: string,
  language: Language,
  faqs: FaqItem[],
  pricingContext: PricingContext,
  fallback: string,
  contact: string,
  greeting: string,
  priceExplanationQuestion: string,
  cheaperPeriodQuestion: string,
  noPeriodSelected: string,
  standardDemandAnswer: string,
  mediumDemandAnswer: string,
  highDemandAnswer: string,
  cheaperSuggestionIntro: string,
  noCheaperSuggestion: string
) {
  const normalized = input.toLowerCase().trim();
  if (!normalized) return fallback;

  const greetings = ["hi", "hello", "hey", "buna", "salut", "hallo", "servus"];
  if (greetings.includes(normalized)) return greeting;

  const priceQuestionNormalized = priceExplanationQuestion.toLowerCase();
  const cheaperQuestionNormalized = cheaperPeriodQuestion.toLowerCase();
  const isPriceExplanationRequest =
    normalized === priceQuestionNormalized ||
    normalized.includes("dynamic price") ||
    normalized.includes("price increase") ||
    normalized.includes("price decreased") ||
    normalized.includes("pretul") ||
    normalized.includes("tarifare dinamica") ||
    normalized.includes("preis");

  if (isPriceExplanationRequest) {
    if (!pricingContext.hasPeriod) return noPeriodSelected;

    const periodLabel =
      language === "ro"
        ? `Perioada selectata este ${pricingContext.pickupDate} ${pricingContext.pickupTime} - ${pricingContext.dropoffDate} ${pricingContext.returnTime}. `
        : language === "de"
        ? `Der gewahlte Zeitraum ist ${pricingContext.pickupDate} ${pricingContext.pickupTime} - ${pricingContext.dropoffDate} ${pricingContext.returnTime}. `
        : `The selected period is ${pricingContext.pickupDate} ${pricingContext.pickupTime} - ${pricingContext.dropoffDate} ${pricingContext.returnTime}. `;

    if (pricingContext.demandMultiplier >= 1.2) {
      return `${periodLabel}${highDemandAnswer} ${
        language === "ro"
          ? `Exista ${pricingContext.overlappingBookings} rezervari suprapuse in aceasta perioada.`
          : language === "de"
          ? `Es gibt ${pricingContext.overlappingBookings} uberlappende Buchungen in diesem Zeitraum.`
          : `There are ${pricingContext.overlappingBookings} overlapping bookings in this period.`
      }`;
    }

    if (pricingContext.demandMultiplier >= 1.1) {
      return `${periodLabel}${mediumDemandAnswer} ${
        language === "ro"
          ? `Exista ${pricingContext.overlappingBookings} rezervari suprapuse in aceasta perioada.`
          : language === "de"
          ? `Es gibt ${pricingContext.overlappingBookings} uberlappende Buchungen in diesem Zeitraum.`
          : `There are ${pricingContext.overlappingBookings} overlapping bookings in this period.`
      }`;
    }

    return `${periodLabel}${standardDemandAnswer}`;
  }

  const isCheaperSuggestionRequest =
    normalized === cheaperQuestionNormalized ||
    normalized.includes("cheaper period") ||
    normalized.includes("cheaper date") ||
    normalized.includes("mai ieftin") ||
    normalized.includes("gunstig");

  if (isCheaperSuggestionRequest) {
    if (!pricingContext.hasPeriod) return noPeriodSelected;
    if (pricingContext.cheaperSuggestions.length === 0) return noCheaperSuggestion;

    return `${cheaperSuggestionIntro}\n- ${pricingContext.cheaperSuggestions.join("\n- ")}`;
  }

  const match = faqs.find((item) => {
    const question = item.question.toLowerCase();
    return (
      (normalized.length >= 4 && question.includes(normalized)) ||
      item.keywords.some((keyword) => normalized.includes(keyword))
    );
  });

  return match ? match.answer : `${fallback} ${contact}`;
}

export function FaqChatbot({
  language,
  pricingContext,
}: {
  language: Language;
  pricingContext: PricingContext;
}) {
  const copy = faqCopy[language];
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: "bot", text: copy.intro },
  ]);

  useEffect(() => {
    function openChat() {
      setOpen(true);
    }

    window.addEventListener("open-faq-chatbot", openChat);
    return () => window.removeEventListener("open-faq-chatbot", openChat);
  }, []);

  function ask(question: string) {
    const answer = findAnswer(
      question,
      language,
      copy.faqs,
      pricingContext,
      copy.fallback,
      copy.contact,
      copy.greeting,
      copy.priceExplanationQuestion,
      copy.cheaperPeriodQuestion,
      copy.noPeriodSelected,
      copy.standardDemandAnswer,
      copy.mediumDemandAnswer,
      copy.highDemandAnswer,
      copy.cheaperSuggestionIntro,
      copy.noCheaperSuggestion
    );
    setMessages((current) => [
      ...current,
      { sender: "user", text: question },
      { sender: "bot", text: answer },
    ]);
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim()) return;

    ask(input);
    setInput("");
  }

  return (
    <>
      <section className="section-block pt-0">
        <div className="premium-container">
          <div className="faq-entry">
            <div>
              <p className="eyebrow">{copy.sectionLabel}</p>
              <h2>{copy.sectionTitle}</h2>
              <p>{copy.sectionText}</p>
            </div>
            <button
              type="button"
              className="btn-primary faq-entry-button"
              onClick={() => setOpen(true)}
            >
              {copy.button}
            </button>
          </div>
        </div>
      </section>

      {open && (
        <div className="faq-modal-backdrop" role="dialog" aria-modal="true">
          <section className="faq-modal" aria-label={copy.title}>
            <div className="faq-modal-header">
              <div>
                <p className="eyebrow">{copy.sectionLabel}</p>
                <h2>{copy.title}</h2>
                <p>{copy.subtitle}</p>
              </div>
              <button
                type="button"
                className="faq-chat-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                x
              </button>
            </div>

            <div className="faq-modal-body">
              <aside className="faq-question-list">
                <p>{copy.quickQuestions}</p>
                {copy.faqs.map((item) => (
                  <button
                    key={item.question}
                    type="button"
                    onClick={() => ask(item.question)}
                  >
                    {item.question}
                  </button>
                ))}
              </aside>

              <div className="faq-chat-panel">
                <div className="faq-chat-messages">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.sender}-${index}`}
                      className={`faq-message ${
                        message.sender === "user" ? "user" : "bot"
                      }`}
                    >
                      {message.text}
                    </div>
                  ))}
                </div>

                <form onSubmit={submitQuestion} className="faq-chat-form">
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={copy.placeholder}
                  />
                  <button type="submit">{copy.send}</button>
                </form>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
