import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../../../src/shared/config/config.js";
import { CommandValidator } from "../../../src/events/message/command-validator.js";
import { MessageHandler } from "../../../src/events/message/message.handler.js";
import type { FileLoader } from "../../../src/core/commands/loader.js";
import type {
  CommandConfig,
  MessageSerialize,
} from "../../../src/shared/types/index.js";
import { createMockClient } from "../../mocks/client.mock.js";
import { mockLogger } from "../../mocks/logger.mock.js";
import { createMockServices } from "../../mocks/services.mock.js";

// Setup Mock for locales t function to avoid real filesystem lookups or database mappings if any
vi.mock("../../../src/shared/locales/index.js", () => ({
  t: (_lang: string, category: string, key: string, _params?: any) => {
    return `[translated:${category}:${key}]`;
  },
}));

describe("MessageHandler", () => {
  let messageHandler: MessageHandler;
  let mockConfig: Config;
  let mockCommandsLoader: FileLoader<CommandConfig>;
  let commandValidator: CommandValidator;
  let mockServices: any;
  let dummyCommands: CommandConfig[];

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      botName: "Bot",
      botNumber: "628xxx@s.whatsapp.net",
      customPairingCode: "",
      ownerNumber: ["628xxx"],
      timezone: "Asia/Jakarta",
      prefix: ["."],
      settings: {
        ownerNotifyOnline: false,
        autoReadStatus: true,
        selfbot: false,
        publicMode: true,
        autoReadMessage: true,
        suggestSimilarCommands: true,
        useLimit: false,
      },
      limit: {
        command: "5",
      },
      ai: {
        apiKey: "",
        model: "",
        maxOutputTokens: 100,
        systemContext: "",
      },
      save: vi.fn(),
    } as unknown as Config;

    dummyCommands = [
      {
        name: "ping",
        description: "Ping the bot",
        aliases: ["ping"],
        run: vi.fn().mockResolvedValue(undefined),
      },
      {
        name: "test",
        description: "Test command",
        aliases: ["test", "tst"],
        run: vi.fn().mockResolvedValue(undefined),
      },
    ] as unknown as CommandConfig[];

    mockCommandsLoader = {
      getAll: vi.fn().mockReturnValue(dummyCommands),
      onChange: vi.fn(),
    } as unknown as FileLoader<CommandConfig>;

    commandValidator = new CommandValidator();
    mockServices = createMockServices();

    messageHandler = new MessageHandler(
      mockConfig,
      mockCommandsLoader,
      commandValidator,
      mockServices,
      mockLogger,
    );
  });

  describe("handle", () => {
    it("should ignore null/undefined messages", async () => {
      const client = createMockClient();
      await messageHandler.handle(client, null as any);
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.any(Object),
        "Receiving new message",
      );
    });

    it("should ignore status broadcast messages", async () => {
      const client = createMockClient();
      const mockMsg = {
        id: "12345",
        from: "status@broadcast",
        sender: "status@broadcast",
        key: {},
        type: "extendedTextMessage",
      } as unknown as MessageSerialize;

      await messageHandler.handle(client, mockMsg);

      // Should auto-read status if configured
      expect(client.readMessages).toHaveBeenCalledWith([mockMsg.key]);
      // Should not upsert user for status broadcast
      expect(mockServices.user.upsertUser).not.toHaveBeenCalled();
    });

    it("should ignore protocol messages", async () => {
      const client = createMockClient();
      const mockMsg = {
        id: "12345",
        from: "123@s.whatsapp.net",
        sender: "123@s.whatsapp.net",
        key: {},
        type: "protocolMessage",
      } as unknown as MessageSerialize;

      await messageHandler.handle(client, mockMsg);
      expect(mockServices.user.upsertUser).not.toHaveBeenCalled();
    });

    it("should ignore bot own messages in public mode and not selfbot", async () => {
      const client = createMockClient();
      const mockMsg = {
        id: "12345",
        from: "123@s.whatsapp.net",
        sender: "6281234567890@s.whatsapp.net",
        fromMe: true,
        key: {},
        type: "extendedTextMessage",
      } as unknown as MessageSerialize;

      await messageHandler.handle(client, mockMsg);
      expect(mockServices.user.upsertUser).not.toHaveBeenCalled();
    });

    it("should auto-read common messages if autoReadMessage is true", async () => {
      const client = createMockClient();
      const mockMsg = {
        id: "12345",
        from: "123@s.whatsapp.net",
        sender: "123@s.whatsapp.net",
        key: { remoteJid: "123@s.whatsapp.net" },
        type: "extendedTextMessage",
        isGroup: false,
      } as unknown as MessageSerialize;

      await messageHandler.handle(client, mockMsg);
      expect(client.readMessages).toHaveBeenCalledWith([mockMsg.key]);
    });

    it("should routing a valid matched command", async () => {
      const client = createMockClient();
      const mockMsg = {
        id: "12345",
        from: "123@s.whatsapp.net",
        sender: "123@s.whatsapp.net",
        key: {},
        type: "extendedTextMessage",
        isGroup: false,
        prefix: ".",
        command: "ping",
        body: ".ping",
      } as unknown as MessageSerialize;

      await messageHandler.handle(client, mockMsg);

      expect(mockServices.user.upsertUser).toHaveBeenCalled();
      expect(dummyCommands[0].run).toHaveBeenCalled();
    });

    it("should suggest similar commands if a command is typoed", async () => {
      const client = createMockClient();
      const mockMsg = {
        id: "12345",
        from: "123@s.whatsapp.net",
        sender: "123@s.whatsapp.net",
        key: {},
        type: "extendedTextMessage",
        isGroup: false,
        prefix: ".",
        command: "pinf", // Typo from ping
        body: ".pinf",
      } as unknown as MessageSerialize;

      // In the context, reply uses context.client.sendMessage
      await messageHandler.handle(client, mockMsg);
      expect(client.sendMessage).toHaveBeenCalled();
    });

    it("should handle command execution errors by logging, reporting to owners, and replying to user", async () => {
      const client = createMockClient();

      // Make the command throw an error
      const failingCommand = {
        name: "ping",
        aliases: ["ping"],
        run: vi.fn().mockRejectedValue(new Error("Database timeout error!")),
      } as unknown as CommandConfig;

      // Overwrite the commands loader to return our failing command
      mockCommandsLoader.getAll = vi.fn().mockReturnValue([failingCommand]);

      // Re-initialize messageHandler to sync commands
      messageHandler = new MessageHandler(
        mockConfig,
        mockCommandsLoader,
        commandValidator,
        mockServices,
        mockLogger,
      );

      const mockMsg = {
        id: "12345",
        from: "123@s.whatsapp.net",
        sender: "123@s.whatsapp.net",
        key: { remoteJid: "123@s.whatsapp.net" },
        type: "extendedTextMessage",
        isGroup: false,
        prefix: ".",
        command: "ping",
        body: ".ping",
      } as unknown as MessageSerialize;

      await messageHandler.handle(client, mockMsg);

      // 1. Should log the command execution error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        "Error in command execution",
      );

      // 2. Should send the error report to all owner numbers
      // Our mock config ownerNumber is ['6281234567890']
      expect(client.sendText).toHaveBeenCalledWith(
        "628xxx@s.whatsapp.net",
        expect.stringContaining("REPORT!"),
      );
      expect(client.sendText).toHaveBeenCalledWith(
        "628xxx@s.whatsapp.net",
        expect.stringContaining("Database timeout error!"),
      );

      // 3. Should reply with fallback command failed message to the user
      expect(client.sendMessage).toHaveBeenCalledWith(
        "123@s.whatsapp.net",
        { text: "[translated:general:COMMAND_FAILED]" },
        { quoted: expect.any(Object) },
      );
    });
  });
});
