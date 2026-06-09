import { UserRole } from '@prisma/client';
import { t } from '../../shared/locales/index.js';
import type { CommandConfig } from '../../shared/types/index.js';
import type { Context } from './context.js';

export const ValidationReason = {
  REQUIRE_OWNER: 'REQUIRE_OWNER',
  REQUIRE_GROUP: 'REQUIRE_GROUP',
  REQUIRE_PRIVATE: 'REQUIRE_PRIVATE',
  REQUIRE_PREMIUM: 'REQUIRE_PREMIUM',
  REQUIRE_GROUP_ADMIN: 'REQUIRE_GROUP_ADMIN',
  REQUIRE_BOT_ADMIN: 'REQUIRE_BOT_ADMIN',
} as const;
export type ValidationReason = (typeof ValidationReason)[keyof typeof ValidationReason];

export class CommandValidator {
  shouldSkipExecution(context: Context): boolean {
    if (context.user.isBlock || context.user.isBanned) return true;
    if (context.group?.isBanned) return true;
    return false;
  }

  validateCommand(context: Context, command: CommandConfig): { valid: boolean; reason?: string } {
    // Ignore if prefix not found
    if (!context.prefix) return { valid: false };

    // Check owner permission
    if (command.isOwner && !context.isOwner) {
      return { valid: false, reason: ValidationReason.REQUIRE_OWNER };
    }

    // Check group requirement
    if (command.isGroup && !context.isGroup) {
      return { valid: false, reason: ValidationReason.REQUIRE_GROUP };
    }

    // Check private requirement
    if (command.isPrivate && context.isGroup) {
      return { valid: false, reason: ValidationReason.REQUIRE_PRIVATE };
    }

    // Check premium requirement
    if (command.isPremium && !(context.user.role === UserRole.PREMIUM)) {
      return { valid: false, reason: ValidationReason.REQUIRE_PREMIUM };
    }

    // Check group admin permission
    if (command.isGroupAdmin && !context.isUserGroupAdmin) {
      return {
        valid: false,
        reason: ValidationReason.REQUIRE_GROUP_ADMIN,
      };
    }

    // Check bot admin requirement
    if (command.isBotAdmin && !context.isBotGroupAdmin) {
      return {
        valid: false,
        reason: ValidationReason.REQUIRE_BOT_ADMIN,
      };
    }

    return { valid: true };
  }
  async sendValidationError(context: Context, reason: ValidationReason) {
    const lang = context.user.language;
    const silent: ValidationReason[] = [];
    if (silent.includes(reason)) return;

    const text = t(lang, 'validation', reason, {
      command: context.command,
      prefix: context.prefix,
    });
    if (!text) return;

    await context.reply(text);
  }
}
