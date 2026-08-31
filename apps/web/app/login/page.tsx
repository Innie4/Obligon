import { redirect } from "next/navigation";
import { routes } from "@/components/site/routes";

export default function LoginRedirectPage() {
  redirect(routes.login);
}
