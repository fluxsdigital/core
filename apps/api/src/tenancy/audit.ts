import type { Prisma } from "@prisma/client";

type AuditEntry = {
  action: string;
  entity: string;
  entityId: string;
  details?: Prisma.InputJsonObject;
};

type Actor = { organizationId: string; userId: string };

export function recordAudit(tx: Prisma.TransactionClient, actor: Actor, entry: AuditEntry) {
  return tx.auditEvent.create({
    data: { organizationId: actor.organizationId, actorId: actor.userId, ...entry },
  });
}
