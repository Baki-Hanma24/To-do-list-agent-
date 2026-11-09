import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/session";
import TaskView from "@/components/TaskView";
import { Brand, SignOutButton } from "@/components/Header";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isSignedIn())) redirect("/signin");
  const { id } = await params;
  return <TaskView id={Number(id)} brand={<Brand />} headerRight={<SignOutButton />} />;
}
