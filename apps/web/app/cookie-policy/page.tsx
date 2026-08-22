import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

const sections: LegalSection[] = [
  {
    id: "what-are-cookies",
    title: "1. What are Cookies?",
    paragraphs: [
      "Cookies are small data files placed on your device to collect information about navigation and interaction with our platform. They allow us to recognize enterprise accounts and maintain secure sessions.",
      "In Obligon LTD's infrastructure, these files support real-time synchronization between fleet dashboards, station activity, and the secure ledger."
    ]
  },
  {
    id: "classification",
    title: "2. Classification & Inventory",
    table: [
      {
        category: "Essential",
        purpose: "Necessary for core security and operational functionality. Cannot be disabled because they protect against capital fraud.",
        duration: "Session",
        status: "Mandatory"
      },
      {
        category: "Analytical",
        purpose: "Tracks velocity metrics and platform usage to optimize dashboard load times and infrastructure reliability.",
        duration: "1 Year",
        status: "toggle",
        active: true
      },
      {
        category: "Marketing",
        purpose: "Used to deliver relevant partnership offers and fleet financing opportunities based on business behavior.",
        duration: "30 Days",
        status: "toggle",
        active: false
      }
    ]
  },
  {
    id: "types",
    title: "3. Types of Cookies",
    cards: [
      { title: "Security Cookies", body: "Protect sessions, detect unusual sign-in behavior, and maintain encrypted verification flows.", icon: "lock" },
      { title: "Operational Cookies", body: "Keep dashboard filters, fuel modules, and station activity synchronized during use.", icon: "database" },
      { title: "Preference Cookies", body: "Remember interface choices such as analytics consent and partner dashboard settings.", icon: "cookie" }
    ]
  },
  {
    id: "updates",
    title: "4. Policy Updates",
    paragraphs: [
      "We may update this Cookie Policy to reflect changes in the cookies we use or for operational, legal, or regulatory reasons.",
      "Please revisit this page regularly to stay informed about our use of cookies and related technologies."
    ]
  }
];

export default function CookiePolicyPage() {
  return (
    <LegalPage
      active="cookies"
      eyebrow="Legal Transparency"
      title="Cookie Policy & Digital Preferences"
      updated="Oct 2024"
      intro="At Obligon LTD, we use cookies to ensure our high-precision fintech platform operates securely and efficiently."
      sections={sections}
    />
  );
}

