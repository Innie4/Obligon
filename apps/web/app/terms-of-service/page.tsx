import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

const sections: LegalSection[] = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    paragraphs: [
      "By accessing or using Obligon services, you agree to these Terms of Service and all policies referenced in them.",
      "These terms govern account access, partner onboarding, fleet card issuance, settlement support, and the use of Obligon's energy logistics products."
    ]
  },
  {
    id: "obligations",
    title: "2. User Obligations",
    cards: [
      {
        title: "Accuracy of Information",
        body: "Provide current, complete, and verifiable company, station, fleet, payment, and contact details.",
        icon: "file"
      },
      {
        title: "Fleet Integrity",
        body: "Use cards, dashboards, and transaction tools only for approved vehicles, facilities, stations, and business operations.",
        icon: "shield"
      },
      {
        title: "Compliance",
        body: "Comply with applicable energy, financial, safety, data, anti-fraud, and tax regulations.",
        icon: "check"
      }
    ]
  },
  {
    id: "liability",
    title: "3. Liability Limits",
    dark: true,
    paragraphs: [
      "Obligon provides fintech and operational infrastructure for business energy logistics. We are not liable for indirect losses, third-party network disruptions, station-side misconduct, force majeure, or losses caused by inaccurate account information.",
      "Where liability cannot be excluded by law, our responsibility is limited to the fees paid for the affected service during the relevant service period."
    ]
  },
  {
    id: "termination",
    title: "4. Termination of Partnership",
    cards: [
      {
        title: "User Discretion",
        body: "You may request account closure or partnership termination after outstanding balances and compliance checks are resolved.",
        icon: "file"
      },
      {
        title: "Policy Violation",
        body: "We may suspend accounts for fraud, misuse, non-payment, safety violations, or regulatory concerns.",
        icon: "lock"
      },
      {
        title: "Effect of Termination",
        body: "Access to dashboards and cards may end, while legally required records remain archived for compliance.",
        icon: "database"
      }
    ]
  },
  {
    id: "download",
    title: "5. Physical Copy",
    paragraphs: [
      "Need a physical copy? Contact support to request the full legal documentation package for your corporate records."
    ]
  }
];

export default function TermsOfServicePage() {
  return (
    <LegalPage
      active="terms"
      eyebrow="Legal Agreement"
      title="Terms of Service"
      updated="Oct 24, 2024"
      intro="These terms define how enterprises, partners, and operators use Obligon products and services."
      sections={sections}
    />
  );
}

