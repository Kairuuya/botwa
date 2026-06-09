import { Prisma, type PrismaClient, type User, type UserRole } from '@prisma/client';
import type { Logger } from '../core/logger/pino.js';
import type { ICache } from '../shared/types/index.js';

export class UserService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cache: ICache,
    private readonly logger?: Logger,
  ) {}

  public async upsertUser(
    jid: string,
    pushName: string,
    lid?: string,
    initialRole: UserRole = 'FREE',
  ): Promise<User> {
    if (!jid.endsWith('@s.whatsapp.net')) throw new Error('Invalid User JID');
    try {
      const cacheKey = `user:${jid}`;
      const cachedUser = await this.cache.get<User>(cacheKey);

      if (cachedUser?.pushName === pushName && (lid === undefined || cachedUser?.lid === lid)) {
        return cachedUser;
      }

      const user = await this.prisma.user.upsert({
        where: { jid },
        update: {
          pushName,
          ...(lid ? { lid } : {}),
        },
        create: {
          jid,
          lid,
          pushName,
          role: initialRole,
        },
      });

      await this.cache.set(cacheKey, user);

      return user;
    } catch (error) {
      this.logger?.error({err:error, jid, pushName }, 'Failed upsert user data');
      throw error;
    }
  }

  public async getUser(jid: string): Promise<User | null> {
    return await this.cache.getOrSet(`user:${jid}`, () =>
      this.prisma.user.findUnique({ where: { jid } }),
    );
  }

  public async updateUser(
    jid: string,
    data: Partial<Prisma.UserUpdateInput>,
  ): Promise<User | null> {
    try {
      const user = await this.prisma.user.update({
        where: { jid },
        data,
      });

      await this.cache.set(`user:${jid}`, user);

      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        this.logger?.warn({ error, jid }, 'Update failed: User JID not registered in database.');
        return null;
      }
      this.logger?.error({ error, jid }, 'Fatal error pas update data');
      throw error;
    }
  }
  public async getJidByLid(lid: string): Promise<string | null> {
    if (!lid?.endsWith('@lid')) return null;

    const cacheKey = `lid_map:${lid}`;

    return await this.cache.getOrSet(cacheKey, async () => {
      const user = await this.prisma.user.findFirst({
        where: { lid },
        select: { jid: true },
      });

      return user?.jid ?? null;
    });
  }

  public async getLidByJid(jid: string): Promise<string | null> {
    if (!jid.endsWith('@s.whatsapp.net')) return null;
    const user = await this.getUser(jid);
    return user?.lid ?? null;
  }
  public async getUserRole(jid: string): Promise<UserRole | null> {
    const user = await this.getUser(jid);
    return user?.role ?? null;
  }

  public async getPushName(jid: string): Promise<string | null> {
    const user = await this.getUser(jid);
    return user?.pushName ?? null;
  }

  public async checkIsBanned(jid: string): Promise<boolean> {
    const user = await this.getUser(jid);
    return user?.isBanned ?? false;
  }
}
