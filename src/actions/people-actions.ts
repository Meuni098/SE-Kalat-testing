"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function getFacultyStaffListAction(searchQuery?: string) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");

  const whereClause: any = {};
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim();
    whereClause.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { employeeNo: { contains: q, mode: "insensitive" } },
      { position: { contains: q, mode: "insensitive" } },
      { unit: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const staff = await prisma.person.findMany({
    where: whereClause,
    include: {
      unit: true,
      assets: {
        include: {
          category: true,
        },
        orderBy: { propertyNo: "asc" },
      },
    },
    orderBy: { fullName: "asc" },
  });

  const staffWithStats = staff.map((person) => {
    const totalAssets = person.assets.length;
    const totalValuation = person.assets.reduce((sum, a) => sum + (a.acquisitionCost || 0), 0);
    const ppeCount = person.assets.filter((a) => a.classification === "PPE").length;
    const semiCount = person.assets.filter((a) => a.classification === "SEMI_EXPENDABLE").length;
    const missingCount = person.assets.filter((a) => a.status === "MISSING").length;

    return {
      id: person.id,
      employeeNo: person.employeeNo,
      fullName: person.fullName,
      position: person.position,
      email: person.email,
      unitCode: person.unit.code,
      unitName: person.unit.name,
      isAccountable: person.isAccountable,
      totalAssets,
      totalValuation,
      ppeCount,
      semiCount,
      missingCount,
      assets: person.assets,
    };
  });

  return { success: true, staff: staffWithStats };
}

export async function getAccountablePersonsAction(searchQuery?: string) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");

  const whereClause: any = { isAccountable: true };
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim();
    whereClause.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { employeeNo: { contains: q, mode: "insensitive" } },
      { position: { contains: q, mode: "insensitive" } },
      { unit: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const custodians = await prisma.person.findMany({
    where: whereClause,
    include: {
      unit: true,
      assets: {
        include: { category: true },
      },
    },
    orderBy: { fullName: "asc" },
  });

  const summary = custodians.map((c) => {
    const totalAssetsCount = c.assets.length;
    const totalValuation = c.assets.reduce((sum, a) => sum + (a.acquisitionCost || 0), 0);
    const ppeCount = c.assets.filter((a) => a.classification === "PPE").length;
    const semiExpendableCount = c.assets.filter((a) => a.classification === "SEMI_EXPENDABLE").length;
    const hasUnserviceable = c.assets.some((a) => a.condition === "UNSERVICEABLE");

    return {
      id: c.id,
      employeeNo: c.employeeNo,
      fullName: c.fullName,
      position: c.position,
      email: c.email,
      unitCode: c.unit.code,
      unitName: c.unit.name,
      totalAssetsCount,
      totalValuation,
      ppeCount,
      semiExpendableCount,
      hasUnserviceable,
      assets: c.assets,
    };
  });

  return { success: true, custodians: summary };
}

export async function getStaffClearanceAction(personId: string) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");

  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: {
      unit: true,
      assets: {
        include: { category: true },
        where: {
          status: { in: ["IN_USE", "MISSING", "UNDER_REPAIR"] },
        },
      },
    },
  });

  if (!person) {
    return { error: "Employee record not found." };
  }

  const isCleared = person.assets.length === 0;

  return {
    success: true,
    person: {
      id: person.id,
      employeeNo: person.employeeNo,
      fullName: person.fullName,
      position: person.position,
      unitCode: person.unit.code,
      unitName: person.unit.name,
      isCleared,
      liabilitiesCount: person.assets.length,
      liabilities: person.assets,
      generatedAt: new Date().toISOString(),
    },
  };
}
