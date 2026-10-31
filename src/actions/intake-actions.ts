"use server";
import { registerDelivery } from "@/lib/product-registration-service";
import { productRegistrationFailure } from "@/lib/product-registration-error";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createIntakeDeliveryAction(formData: FormData) {
  const user = await getSession();
  if (!user) return { error: "Please sign in with an active account.", code: "UNAUTHORIZED" };
  try {
    const result = await registerDelivery(prisma, user.id, formData);
    for (const path of ["/intake", "/inventory", "/inventory/central", "/inventory/transferred", "/inventory/generate-qr", "/dashboard"]) revalidatePath(path);
    return result;
  } catch (error) { return productRegistrationFailure(error); }
}
