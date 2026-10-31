'use server';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AuditLogService } from '@/lib/audit-log-service';
import { AuditError } from '@/lib/audit-log-validation';
import type { AuditLogQuery, AuditResult } from '@/types/audit-log';

async function run<T>(operation: (service: AuditLogService) => Promise<T>): Promise<AuditResult<T>> {
  try {
    const user = await getSession();
    if (!user) return { success: false, code: 'UNAUTHENTICATED', error: 'Please sign in to view activity.' };
    return { success: true, data: await operation(new AuditLogService(prisma, user.id)) };
  } catch (error) {
    if (error instanceof AuditError) return { success: false, code: error.code, error: error.message };
    console.error('Audit history request failed', error instanceof Error ? error.name : 'Unknown error');
    return { success: false, code: 'INTERNAL_ERROR', error: 'Activity history could not be loaded. Please retry.' };
  }
}
export async function getAuditLogsAction(query: AuditLogQuery = {}) { return run(service => service.list(query)); }
export async function getAuditLogDetailAction(id: string) { return run(service => service.detail(id)); }
export async function getAuditActorsAction(query = '', cursor?: string) { return run(service => service.actors(query, cursor)); }
export async function getMyActivityAction(query: Omit<AuditLogQuery, 'actorId'> = {}) { return run(service => service.list(query, true)); }
export async function getMyActivityDetailAction(id: string) { return run(service => service.detail(id, true)); }
export async function getTransactionAttributionAction(entityType: string, entityId: string) { return run(service => service.attribution(entityType, entityId)); }
