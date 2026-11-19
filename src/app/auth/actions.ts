"use server";

import { redirect } from "next/navigation";
import { serverApi } from "@/lib/data/server-api";

export async function signOut() {
  await serverApi().auth.signOut();
  redirect("/login");
}
