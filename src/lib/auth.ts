import { sessionSigningKey } from "@/lib/session-secret";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const SESSION_COOKIE_NAME = "custodia_session";
const SESSION_DURATION = 8 * 60 * 60; // 8 hours in seconds

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF" | "CUSTODIAN" | "AUDITOR";
  unitId?: string | null;
  unitCode?: string | null;
  unitName?: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser): Promise<string> {
  const token = await new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    unitId: user.unitId,
    unitCode: user.unitCode,
    unitName: user.unitName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(sessionSigningKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });

  return token;
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, sessionSigningKey());
    if (typeof payload.id !== "string") return null;
    const account = await prisma.user.findUnique({ where: { id: payload.id }, include: { unit: true } });
    if (!account?.isActive || !["ADMIN", "STAFF", "CUSTODIAN", "AUDITOR"].includes(account.role)) return null;
    return { id: account.id, name: account.name, email: account.email, role: account.role as SessionUser["role"], unitId: account.unitId, unitCode: account.unit?.code, unitName: account.unit?.name };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function authenticateUser(email: string, passwordPlain: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { unit: true },
  });

  if (!user || !user.isActive) {
    return { success: false, error: "Invalid credentials or account inactive" };
  }

  const isValid = await verifyPassword(passwordPlain, user.passwordHash);
  if (!isValid) {
    return { success: false, error: "Invalid credentials" };
  }

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as SessionUser["role"],
    unitId: user.unitId,
    unitCode: user.unit?.code,
    unitName: user.unit?.name,
  };

  await createSession(sessionUser);
  return { success: true, user: sessionUser };
}
