import type { Group, Prisma } from '@prisma/client';

export type GroupWithRelations = Group &
  Prisma.GroupGetPayload<{
    include: {
      metadata: true;
      participants: true;
    };
  }>;
