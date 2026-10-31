import { createHash, randomUUID } from 'node:crypto';
import { auditOperationContext } from './audit-context';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuditError } from './audit-log-validation';
import { requireAuditActor } from './audit-log-write';



export function operationFromForm(form: FormData, roles = ["ADMIN", "STAFF"]) {
  const id = form.get('operationId');
  if (id !== null && (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) throw new AuditError('VALIDATION_ERROR', 'Reload the form before saving.');
  return { roles, id: typeof id === 'string' ? id : randomUUID(), values: Array.from(form.entries()).filter(([key]) => key !== 'operationId').sort(([a], [b]) => a.localeCompare(b)) };
}

/** Result and event capture share the business commit. A retry returns the saved result. */
export async function auditedTransaction<T>(db: PrismaClient, actorId: string, operation: { id: string; values: unknown; roles?: string[] }, callback: (tx: Prisma.TransactionClient) => Promise<T>, options?: { isolationLevel?: Prisma.TransactionIsolationLevel; maxWait?: number; timeout?: number }) {
  const requestHash = createHash('sha256').update(JSON.stringify(operation.values)).digest('hex');
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async tx => {
        await requireAuditActor(tx, actorId, operation.roles);
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actorId + ':' + operation.id}, 0))::text`;
        const existing = await tx.auditOperation.findUnique({ where: { actorId_operationId: { actorId, operationId: operation.id } } });
        if (existing) {
          if (existing.requestHash !== requestHash) throw new AuditError('VALIDATION_ERROR', 'This operation was already used with different values. Reopen the form.');
          // Stored JSON is a server-produced result of this exact operation, scoped to its actor.
          return existing.result as T;
        }
        const result = await auditOperationContext.run(operation.id, () => callback(tx));
        if (result && typeof result === 'object' && 'error' in result) return result;
        await tx.auditOperation.create({ data: { actorId, operationId: operation.id, requestHash, result: JSON.parse(JSON.stringify(result)) } });
        return result;
      }, { ...options, isolationLevel: options?.isolationLevel ?? 'Serializable', timeout: options?.timeout ?? 15000 });
    } catch (error) {
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') continue;
      throw error;
    }
  }
}
