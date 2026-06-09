import {
  type Group,
  type GroupParticipant,
  GroupRole,
  type Prisma,
  type PrismaClient,
  UserRole,
} from '@prisma/client';
import type {
  GroupParticipant as BaileysParticipant,
  GroupMetadata as baileysGroupMetadata,
  WAMessageAddressingMode,
} from '@whiskeysockets/baileys';
import type { Client } from '../core/client/client.js';
import type { Logger } from '../core/logger/pino.js';
import type { ICache, GroupWithRelations } from '../shared/types/index.js';

export class GroupService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cache: ICache,
    private readonly logger?: Logger,
  ) {}

  private getParticipantRole(role?: string | undefined | null): GroupRole {
    if (role === 'superadmin') return GroupRole.SUPERADMIN;
    if (role === 'admin') return GroupRole.ADMIN;
    return GroupRole.MEMBER;
  }

  public async getGroup(jid: string): Promise<GroupWithRelations | null> {
    try {
      return await this.cache.getOrSet<GroupWithRelations | null>(`group:${jid}`, async () => {
        return await this.prisma.group.findUnique({
          where: { jid },
          include: {
            metadata: true,
            participants: true,
          },
        });
      });
    } catch (error) {
      this.logger?.error({ error, jid }, 'Failed to get group data');
      throw error;
    }
  }

  public async ensureGroup(client: Client, jid: string): Promise<GroupWithRelations> {
    if (!jid.endsWith('@g.us')) throw new Error('Invalid Group JID');

    let group = await this.getGroup(jid);

    if (!group) {
      group = await this.upsertGroup(client, jid);
    }

    return group;
  }
  public async upsertGroup(client: Client, jid: string): Promise<GroupWithRelations> {
    if (!jid.endsWith('@g.us')) {
      throw new Error(`Invalid group JID, should end with @g.us, got ${jid}`);
    }

    try {
      const baileysGroupMetadata = await client.groupMetadata(jid);
      const participants = baileysGroupMetadata.participants || [];

      if (participants.length > 0) {
        const newUsers = participants.map((p) => ({
          jid: p.id,
          pushName: p.id.split('@')[0],
          role: UserRole.FREE,
        }));

        await this.prisma.user.createMany({
          data: newUsers,
          skipDuplicates: true,
        });
      }

      await this.prisma.group.upsert({
        where: { jid },
        update: {
          metadata: {
            upsert: {
              create: this.formatMetadataWithoutParticipants(baileysGroupMetadata),
              update: this.formatMetadataWithoutParticipants(baileysGroupMetadata),
            },
          },
        },
        create: {
          jid,
          isBanned: false,
          isMute: false,
          metadata: {
            create: this.formatMetadataWithoutParticipants(baileysGroupMetadata),
          },
        },
      });

      if (participants.length > 0) {
        const participantUpserts = participants.map((p) =>
          this.prisma.groupParticipant.upsert({
            where: {
              groupJid_userJid: {
                groupJid: jid,
                userJid: p.id,
              },
            },
            update: {
              role: this.getParticipantRole(p.admin),
            },
            create: {
              groupJid: jid,
              userJid: p.id,
              role: this.getParticipantRole(p.admin),
            },
          }),
        );

        await this.prisma.$transaction(participantUpserts);
      }

      const freshGroup = await this.prisma.group.findUniqueOrThrow({
        where: { jid },
        include: { metadata: true, participants: true },
      });

      await this.cache.set(`group:${jid}`, freshGroup);
      return freshGroup;
    } catch (error) {
      this.logger?.error({ error, jid }, 'Failed to upsert group metadata');
      throw error;
    }
  }

  private formatMetadataWithoutParticipants(metadata: baileysGroupMetadata) {
    return {
      addressingMode: metadata.addressingMode as string | undefined,
      subject: metadata.subject,
      subjectOwner: metadata.subjectOwner,
      subjectOwnerPn: metadata.subjectOwnerPn,
      subjectTime: metadata.subjectTime,
      size: metadata.size || metadata.participants?.length || 0,
      creation: metadata.creation,
      owner: metadata.owner || '',
      ownerPn: metadata.ownerPn,
      ownerCountryCode: metadata.owner_country_code,
      desc: metadata.desc,
      descId: metadata.descId,
      descOwner: metadata.descOwner,
      descOwnerPn: metadata.descOwnerPn,
      descTime: metadata.descTime,
      restrict: !!metadata.restrict,
      announce: !!metadata.announce,
      isCommunity: !!metadata.isCommunity,
      isCommunityAnnounce: !!metadata.isCommunityAnnounce,
      joinApprovalMode: !!metadata.joinApprovalMode,
      memberAddMode: !!metadata.memberAddMode,
    };
  }

  public async updateParticipants(
    jid: string,
    participants: BaileysParticipant[],
  ): Promise<GroupParticipant[]> {
    try {
      if (participants.length > 0) {
        const newUsers = participants.map((p) => ({
          jid: p.id,
          pushName: p.id.split('@')[0],
          role: UserRole.FREE,
        }));

        await this.prisma.user.createMany({
          data: newUsers,
          skipDuplicates: true,
        });
      }

      const upserts = participants.map((p) =>
        this.prisma.groupParticipant.upsert({
          where: {
            groupJid_userJid: { groupJid: jid, userJid: p.id },
          },
          update: { role: this.getParticipantRole(p.admin) },
          create: {
            groupJid: jid,
            userJid: p.id,
            role: this.getParticipantRole(p.admin),
          },
        }),
      );

      const results = await this.prisma.$transaction(upserts);

      await this.cache.delete(`group:${jid}`);
      return results;
    } catch (error) {
      this.logger?.error({ error, jid }, 'Failed to sync participants');
      throw error;
    }
  }

  public async updateGroup(
    jid: string,
    data: Prisma.GroupUpdateInput,
  ): Promise<GroupWithRelations> {
    try {
      const result = await this.prisma.group.update({
        where: { jid },
        data,
        include: { metadata: true, participants: true },
      });

      await this.cache.set(`group:${jid}`, result);
      return result;
    } catch (error) {
      this.logger?.error({ error, jid }, 'Fatal error during group update');
      throw error;
    }
  }

  public async getGroupMetadata(jid: string): Promise<baileysGroupMetadata | null> {
    const group = await this.getGroup(jid);
    if (!group?.metadata) return null;

    const mappedParticipants = group.participants.map((p) => {
      let adminRole: 'admin' | 'superadmin' | null = null; // member
      if (p.role === GroupRole.ADMIN) adminRole = 'admin';
      if (p.role === GroupRole.SUPERADMIN) adminRole = 'superadmin';

      return {
        id: p.userJid,
        phoneNumber: p.userJid,
        admin: adminRole,
      };
    });

    return {
      id: group.jid,
      addressingMode: (group.metadata.addressingMode as WAMessageAddressingMode) ?? undefined,
      subject: group.metadata.subject,
      subjectOwner: group.metadata.subjectOwner ?? undefined,
      subjectOwnerPn: group.metadata.subjectOwnerPn ?? undefined,
      subjectTime: group.metadata.subjectTime ?? undefined,
      size: group.metadata.size,
      creation: group.metadata.creation ?? undefined,
      owner: group.metadata.owner,
      ownerPn: group.metadata.ownerPn ?? undefined,
      owner_country_code: group.metadata.ownerCountryCode ?? undefined,
      desc: group.metadata.desc ?? undefined,
      descId: group.metadata.descId ?? undefined,
      descOwner: group.metadata.descOwner ?? undefined,
      descOwnerPn: group.metadata.descOwnerPn ?? undefined,
      descTime: group.metadata.descTime ?? undefined,
      restrict: group.metadata.restrict,
      announce: group.metadata.announce,
      isCommunity: group.metadata.isCommunity,
      isCommunityAnnounce: group.metadata.isCommunityAnnounce,
      joinApprovalMode: group.metadata.joinApprovalMode,
      memberAddMode: group.metadata.memberAddMode,
      participants: mappedParticipants,
    };
  }

  public async isBanned(jid: string): Promise<boolean> {
    const group = await this.getGroup(jid);
    return group?.isBanned ?? false;
  }

  public async isMute(jid: string): Promise<boolean> {
    const group = await this.getGroup(jid);
    return group?.isMute ?? false;
  }

  public async getWelcomeMessage(jid: string): Promise<string | null> {
    const group = await this.getGroup(jid);
    return group?.welcome ?? null;
  }

  public async getGoodbyeMessage(jid: string): Promise<string | null> {
    const group = await this.getGroup(jid);
    return group?.goodbye ?? null;
  }
}
