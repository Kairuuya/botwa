import type { GroupMetadata, proto, WAMessageKey } from '@whiskeysockets/baileys';

export type MessageSerialize = {
  key: WAMessageKey;
  message: proto.IMessage;
  id: string;
  from: string;
  fromMe: boolean;
  sender: string;
  lid: string;
  pushName: string;
  type: string;
  expiration: number;
  messageTimestamp: number;
  mentions: string[];
  body: string;
  args: string[];
  query: string;
  command: string;
  prefix: string;
  isGroup: boolean;
  isEdited?: boolean;
  isRevoke?: boolean;
  isOwner: boolean;
  isViewOnce: boolean;
  groupMetadata?: GroupMetadata;
  quoted?: MessageSerialize;
};

// export type GroupSerialize = {
//     parameters: string[]; //  any saja
//     key: GroupUpdateMessageKey;
//     from: string;
//     timestamp: number | Long;
//     participant: string;
//     type: proto.WebMessageInfo.StubType | number;
//     message: proto.IMessage;
//     expiration: number;
//     pushName: string;
// };

// export type GroupUpdateMessageKey = proto.IMessageKey & {
//     id: string;
//     fromMe: boolean;
//     remoteJid: string;
//     remoteJidAlt: string;
//     participant: string;
//     participantAlt: string;
//     addressingMode: string;
//     isViewOnce: boolean;
// };
