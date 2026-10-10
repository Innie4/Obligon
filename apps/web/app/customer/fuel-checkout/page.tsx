import { redirect } from "next/navigation";
import { customerCardDestination, type CustomerReturnParams } from "@/lib/customer-card-routes";

export default async function Page({ searchParams }: { searchParams: Promise<CustomerReturnParams> }) {
  redirect(customerCardDestination(await searchParams, "fuel"));
}
