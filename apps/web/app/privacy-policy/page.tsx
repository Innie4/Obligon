import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

const sections: LegalSection[] = [
  {
    id: "introduction",
    title: "1. Introduction",
    paragraphs: [
      "Obligon LTD Energy is committed to protecting the personal and enterprise data entrusted to our platform. This policy explains how we collect, use, store, and protect information across FuelVista, EnergyVista, GenVista, and related services.",
      "Our privacy practices are designed around Nigerian data protection requirements, enterprise security expectations, and the operational realities of fleet and energy logistics."
    ]
  },
  {
    id: "data-collection",
    title: "2. Data Collection",
    cards: [
      {
        title: "Direct Information",
        body: "Full legal or corporate identity, financial and tax IDs, billing data, contact details, and onboarding documents.",
        icon: "file"
      },
      {
        title: "Automated Data",
        body: "GPS coordinates, transaction logs, device identifiers, and telemetry from FuelVista or GenVista-enabled operations.",
        icon: "database"
      },
      {
        title: "KYC Compliance",
        body: "Verification records needed to validate business legitimacy, protect against fraud, and satisfy financial controls.",
        icon: "shield"
      }
    ]
  },
  {
    id: "usage",
    title: "3. How We Use Your Data",
    cards: [
      {
        title: "Operational Velocity",
        body: "To route approvals, reconcile station activity, activate cards, and keep fleet operations moving in real time.",
        icon: "check"
      },
      {
        title: "Capital Flow",
        body: "To settle partner stations, monitor disbursements, and maintain clear financial records for enterprise accounts.",
        icon: "database"
      },
      {
        title: "Fraud Prevention",
        body: "To detect unusual spending patterns, duplicate identities, compromised sessions, or non-compliant station activity.",
        icon: "lock"
      }
    ]
  },
  {
    id: "rights",
    title: "4. User Rights",
    dark: true,
    paragraphs: [
      "As an Obligon LTD partner or enterprise customer, you maintain control over your enterprise data under the Nigeria Data Protection Regulation.",
      "You may request access, correction, portability, restriction, or erasure where legally permissible. Some operational records may be retained where required for compliance, accounting, or fraud-prevention obligations."
    ],
    cards: [
      { title: "Right to Access", body: "Request a copy of your account, transaction, and verification records.", icon: "file" },
      { title: "Right to Erasure", body: "Request deletion of data no longer needed for legal or operational purposes.", icon: "lock" },
      { title: "Data Portability", body: "Receive structured exports of eligible account and activity data.", icon: "database" }
    ]
  },
  {
    id: "security",
    title: "5. Security Protocol",
    paragraphs: [
      "We use encryption, role-based access controls, audit trails, and session monitoring to protect information inside the Obligon LTD platform.",
      "Access to sensitive data is limited to authorized personnel and partners who need it to provide support, verification, settlement, or logistics services."
    ]
  },
  {
    id: "contact",
    title: "6. Contact Us",
    paragraphs: [
      "For privacy questions, data requests, or escalation to our Data Protection Officer, contact legal@obligon.energy or visit our Lagos, Nigeria office."
    ]
  }
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      active="privacy"
      eyebrow="Compliance & Trust"
      title="Privacy Policy"
      updated="May 24, 2024"
      intro="We protect partner, customer, station, and fleet data across Obligon LTD's energy fintech infrastructure."
      sections={sections}
    />
  );
}

