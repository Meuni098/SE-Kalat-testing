"use server";

import { authenticateUser, destroySession } from "@/lib/auth";
import { redirect } from "next/navigation";

export interface LoginState {
  error?: string;
  success?: boolean;
}

export async function loginAction(
  prevState: LoginState | undefined,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();
  const redirectTo = formData.get("redirectTo")?.toString() || "/dashboard";

  if (!email || !password) {
    return { error: "Please enter both university email and password." };
  }

  const result = await authenticateUser(email, password);

  if (!result.success) {
    return { error: result.error || "Invalid institutional credentials." };
  }

  redirect(redirectTo);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
