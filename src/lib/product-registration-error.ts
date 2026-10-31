import { Prisma } from "@prisma/client";
import { AuditError } from "./audit-log-validation";
import { ManualPersonError } from "./manual-person";
import { ProductRegistrationError } from "./product-registration-validation";

export function productRegistrationFailure(error: unknown): { error: string; code: string } {
  if (error instanceof ProductRegistrationError) return { error: error.message, code: error.code };
  if (error instanceof ManualPersonError) return { error: error.message, code: "VALIDATION_ERROR" };
  if (error instanceof AuditError) {
    const replayConflict = error.message.includes("already used with different values");
    return { error: error.message, code: replayConflict ? "CONFLICT" : error.code === "UNAUTHENTICATED" ? "UNAUTHORIZED" : error.code };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
    return { error: "Another save conflicted with this request. Retry the same submission.", code: "CONFLICT" };
  }
  console.error("Product registration failed", error instanceof Error ? error.name : "Unknown error");
  return { error: "The save could not be confirmed. Retry the same submission.", code: "SAVE_FAILED" };
}
