import { CompanyInvitation } from "@/components/auth/CompanyInvitation";

export default async function CompanyInvitationPage({ searchParams }: { searchParams: Promise<{ invite?: string | string[] }> }) {
  const { invite } = await searchParams;
  return <CompanyInvitation token={typeof invite === "string" ? invite : null} />;
}
