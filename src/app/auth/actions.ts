"use server";

import { redirect } from "next/navigation";
import { signOut as endSession } from "@/lib/data/auth";

export async function signOut() {
  await endSession();
  redirect("/login");
}
