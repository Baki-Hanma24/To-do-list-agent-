import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/session";
import EditPlanView from "@/components/EditPlanView";
import { Brand, HeaderActions } from "@/components/Header";

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isSignedIn())) redirect("/signin");
  const { id } = await params;
  return <EditPlanView id={Number(id)} brand={<Brand />} headerRight={<HeaderActions />} />;
}
