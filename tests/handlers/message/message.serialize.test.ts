import type { WAMessage } from "@whiskeysockets/baileys";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../../../src/shared/config/config.js";
import { MessageSerializer } from "../../../src/events/message/message.serialize.js";
import { createMockClient } from "../../mocks/client.mock.js";
import { mockLogger } from "../../mocks/logger.mock.js";

// Mock Baileys methods
vi.mock("@whiskeysockets/baileys", () => {
  return {
    areJidsSameUser: (jid1: string, jid2: string) => {
      if (!jid1 || !jid2) return false;
      return jid1.split("@")[0] === jid2.split("@")[0];
    },
    getContentType: (message: any) => {
      if (!message) return undefined;
      const keys = Object.keys(message);
      return keys.find(
        (k) =>
          k !== "senderKeyDistributionMessage" &&
          k !== "messageContextInfo" &&
          k !== "contextInfo",
      );
    },
    proto: {
      Message: {
        ProtocolMessage: {
          Type: {
            MESSAGE_EDIT: 14,
            REVOKE: 0,
          },
        },
      },
    },
  };
});

describe("MessageSerializer", () => {
  let serializer: MessageSerializer;
  let mockConfig: Config;
  let mockClient: any;

  beforeEach(() => {
    mockConfig = {
      prefix: ["."],
      ownerNumber: ["6288"],
    } as unknown as Config;

    mockClient = createMockClient();
    mockClient.user = { id: "bot_jid@s.whatsapp.net", lid: "bot_lid@lid" };

    serializer = new MessageSerializer(mockClient, mockConfig, mockLogger);
  });

  it("should return null if rawMessage.message is missing", async () => {
    const rawMsg = { key: {} } as WAMessage;
    const res = await serializer.serialize(rawMsg);
    expect(res).toBeNull();
  });

  it("should serialize text conversation successfully", async () => {
    const rawMsg = {
      key: {
        remoteJid: "62899999999@s.whatsapp.net",
        id: "msg_id_123",
        fromMe: false,
      },
      messageTimestamp: 1672531199,
      pushName: "Khaerul",
      message: {
        conversation: ".ping test query data",
      },
    } as unknown as WAMessage;

    const res = await serializer.serialize(rawMsg);

    expect(res).not.toBeNull();
    expect(res?.id).toBe("msg_id_123");
    expect(res?.body).toBe(".ping test query data");
    expect(res?.prefix).toBe(".");
    expect(res?.command).toBe("ping");
    expect(res?.args).toEqual(["ping", "test", "query", "data"]);
    expect(res?.query).toBe("test query data");
    expect(res?.isOwner).toBe(false);
    expect(res?.isGroup).toBe(false);
    expect(res?.pushName).toBe("Khaerul");
  });

  it("should extract wrappers like viewOnceMessage correctly", async () => {
    const rawMsg = {
      key: {
        remoteJid: "62899999999@s.whatsapp.net",
        id: "msg_id_123",
        fromMe: false,
      },
      messageTimestamp: 1672531199,
      message: {
        viewOnceMessage: {
          message: {
            imageMessage: {
              caption: ".viewonce_command args",
            },
          },
        },
      },
    } as unknown as WAMessage;

    const res = await serializer.serialize(rawMsg);

    expect(res).not.toBeNull();
    expect(res?.isViewOnce).toBe(true);
    expect(res?.type).toBe("imageMessage");
    expect(res?.body).toBe(".viewonce_command args");
    expect(res?.command).toBe("viewonce_command");
  });

  it("should parse quoted message correctly", async () => {
    const rawMsg = {
      key: {
        remoteJid: "62899999999@s.whatsapp.net",
        id: "msg_id_123",
        fromMe: false,
      },
      messageTimestamp: 1672531199,
      message: {
        extendedTextMessage: {
          text: ".ping reply",
          contextInfo: {
            stanzaId: "quoted_id_999",
            participant: "6288@s.whatsapp.net", // owner
            quotedMessage: {
              conversation: ".hello world",
            },
          },
        },
      },
    } as unknown as WAMessage;

    const res = await serializer.serialize(rawMsg);

    expect(res).not.toBeNull();
    expect(res?.quoted).toBeDefined();
    expect(res?.quoted?.id).toBe("quoted_id_999");
    expect(res?.quoted?.body).toBe(".hello world");
    expect(res?.quoted?.isOwner).toBe(true); // Owner is true since quoted participant is in owner list
  });
});
