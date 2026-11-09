import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/session";
import Board from "@/components/Board";
import { Brand, HeaderActions } from "@/components/Header";

export default async function Home() {
  if (!(await isSignedIn())) redirect("/signin");
  return <Board brand={<Brand />} headerRight={<HeaderActions />} />;
}
