import type { Readable } from 'node:stream';
import type {
  AnyMessageContent,
  ParticipantAction,
  proto,
  WAMessage,
} from '@whiskeysockets/baileys';
import type { MessageSerialize } from './serialize.js';


export type GroupMessage = {
  id: string;
  author: string;
  authorPn: string;
  participants: string[];
  action: ParticipantAction;
};
export type HydratedButton =
  | { urlButton: { displayText: string; url: string }; index: number }
  | {
      callButton: { displayText: string; phoneNumber: string };
      index: number;
    }
  | { quickReplyButton: { displayText: string; id: string }; index: number };

export type ButtonItem = Omit<proto.IHydratedTemplateButton, 'index'>;
export type StickerType = 'default' | 'full' | 'circle' | 'rounded' | 'crop';
export type ClientMediaUpload = string | Buffer | Readable | NodeJS.ReadableStream | ReadableStream;
