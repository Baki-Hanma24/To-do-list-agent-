import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/session";
import RulesView from "@/components/RulesView";
import { Brand, SignOutButton } from "@/components/Header";

export default async function RulesPage() {
  if (!(await isSignedIn())) redirect("/signin");
  return <RulesView brand={<Brand />} footer={<SignOutButton alwaysShow />} />;
}
