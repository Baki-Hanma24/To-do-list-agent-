import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/session";
import EditorView from "@/components/EditorView";
import { Brand, HeaderActions } from "@/components/Header";

export default async function EditorPage() {
  if (!(await isSignedIn())) redirect("/signin");
  return <EditorView brand={<Brand />} headerRight={<HeaderActions />} />;
}
