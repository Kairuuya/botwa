import { UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CommandValidator,
  ValidationReason,
} from '../../../src/events/message/command-validator.js';
import type { CommandConfig } from '../../../src/shared/types/index.js';

describe('CommandValidator', () => {
  let validator: CommandValidator;
  let mockContext: any;

  beforeEach(() => {
    validator = new CommandValidator();
    mockContext = {
      prefix: '.',
      command: 'ping',
      isOwner: false,
      isGroup: false,
      isUserGroupAdmin: false,
      isBotGroupAdmin: false,
      user: {
        role: UserRole.FREE,
        isBanned: false,
        isBlock: false,
      },
      group: {
        isBanned: false,
      },
      reply: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('shouldSkipExecution', () => {
    it('should skip if user is blocked or banned', () => {
      mockContext.user.isBlock = true;
      expect(validator.shouldSkipExecution(mockContext as any)).toBe(true);

      mockContext.user.isBlock = false;
      mockContext.user.isBanned = true;
      expect(validator.shouldSkipExecution(mockContext as any)).toBe(true);
    });

    it('should skip if group is banned', () => {
      mockContext.isGroup = true;
      mockContext.group.isBanned = true;
      expect(validator.shouldSkipExecution(mockContext as any)).toBe(true);
    });

    it('should not skip for active and unbanned users and groups', () => {
      expect(validator.shouldSkipExecution(mockContext as any)).toBe(false);
    });
  });

  describe('validateCommand', () => {
    it('should invalidate if prefix is missing', () => {
      mockContext.prefix = '';
      const cmd = { aliases: ['ping'] } as CommandConfig;
      expect(validator.validateCommand(mockContext as any, cmd)).toEqual({ valid: false });
    });

    it('should validate normal command successfully', () => {
      const cmd = { aliases: ['ping'] } as CommandConfig;
      expect(validator.validateCommand(mockContext as any, cmd)).toEqual({ valid: true });
    });

    it('should handle isOwner command', () => {
      const cmd = { aliases: ['restart'], isOwner: true } as CommandConfig;

      // Fail if not owner
      expect(validator.validateCommand(mockContext as any, cmd)).toEqual({
        valid: false,
        reason: ValidationReason.REQUIRE_OWNER,
      });

      // Pass if owner
      mockContext.isOwner = true;
      expect(validator.validateCommand(mockContext as any, cmd)).toEqual({ valid: true });
    });

    it('should handle isGroup command', () => {
      const cmd = { aliases: ['kick'], isGroup: true } as CommandConfig;

      // Fail if in private chat
      expect(validator.validateCommand(mockContext as any, cmd)).toEqual({
        valid: false,
        reason: ValidationReason.REQUIRE_GROUP,
      });

      // Pass if in group
      mockContext.isGroup = true;
      expect(validator.validateCommand(mockContext as any, cmd)).toEqual({ valid: true });
    });

    it('should handle isPrivate command', () => {
      const cmd = { aliases: ['login'], isPrivate: true } as CommandConfig;

      // Pass if in private chat
      expect(validator.validateCommand(mockContext as any, cmd)).toEqual({ valid: true });

      // Fail if in group
      mockContext.isGroup = true;
      expect(validator.validateCommand(mockContext as any, cmd)).toEqual({
        valid: false,
        reason: ValidationReason.REQUIRE_PRIVATE,
      });
    });

    it('should handle isPremium command', () => {
      const cmd = { aliases: ['hd'], isPremium: true } as CommandConfig;

      // Fail if free
      expect(validator.validateCommand(mockContext as any, cmd)).toEqual({
        valid: false,
        reason: ValidationReason.REQUIRE_PREMIUM,
      });

      // Pass if premium
      mockContext.user.role = UserRole.PREMIUM;
      expect(validator.validateCommand(mockContext as any, cmd)).toEqual({ valid: true });
    });

    it('should handle isGroupAdmin requirement', () => {
      const cmd = { aliases: ['promote'], isGroupAdmin: true } as CommandConfig;

      // Fail if not group admin
      expect(validator.validateCommand(mockContext as any, cmd)).toEqual({
        valid: false,
        reason: ValidationReason.REQUIRE_GROUP_ADMIN,
      });

      // Pass if group admin
      mockContext.isUserGroupAdmin = true;
      expect(validator.validateCommand(mockContext as any, cmd)).toEqual({ valid: true });
    });

    it('should handle isBotAdmin requirement', () => {
      const cmd = { aliases: ['ban'], isBotAdmin: true } as CommandConfig;

      // Fail if bot is not admin
      expect(validator.validateCommand(mockContext as any, cmd)).toEqual({
        valid: false,
        reason: ValidationReason.REQUIRE_BOT_ADMIN,
      });

      // Pass if bot is admin
      mockContext.isBotGroupAdmin = true;
      expect(validator.validateCommand(mockContext as any, cmd)).toEqual({ valid: true });
    });
  });
});
