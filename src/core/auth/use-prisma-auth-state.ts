import type { PrismaClient, PrismaPromise } from '@prisma/client';
import {
  type AuthenticationCreds,
  type AuthenticationState,
  BufferJSON,
  initAuthCreds,
  proto,
  type SignalDataTypeMap,
} from '@whiskeysockets/baileys';

export const usePrismaAuthState = async (
  prisma: PrismaClient,
  sessionName: string,
): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearSession: (keepCreds?: boolean) => Promise<void>;
}> => {
  const model = prisma.baileysAuth;
  const getSessionId = (file: string): string =>
    `${sessionName}-${file.replace(/\//g, '__')?.replace(/:/g, '-')}`;

  const writeData = async (data: unknown, file: string) => {
    try {
      const sessionId = getSessionId(file);
      const session = JSON.stringify(data, BufferJSON.replacer);

      await model.upsert({
        where: { sessionId },
        update: { session },
        create: { sessionId, session },
      });
    } catch (error) {
      console.error(`[Auth] Failed to write data: ${file}`, error);
    }
  };

  const readData = async (file: string) => {
    try {
      const sessionId = getSessionId(file);
      const data = await model.findUnique({
        where: { sessionId },
      });
      return data?.session ? JSON.parse(data.session, BufferJSON.reviver) : null;
    } catch (error) {
      console.error(`[Auth] Failed to read data: ${file}`, error);
      return null;
    }
  };

  const _removeData = async (file: string): Promise<void> => {
    try {
      const sessionId = getSessionId(file);
      await model.delete({
        where: { sessionId },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code !== 'P2025') {
        console.error(`[Auth] Failed to remove data: ${file}`, error);
      }
    }
  };

  const creds: AuthenticationCreds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: {
            [_: string]: SignalDataTypeMap[typeof type];
          } = {};

          try {
            const sessionIds = ids.map((id) => getSessionId(`${type}-${id}`));
            const records = await model.findMany({
              where: { sessionId: { in: sessionIds } },
            });

            const recordMap = new Map(records.map((r) => [r.sessionId, r.session]));

            for (const id of ids) {
              const sessionId = getSessionId(`${type}-${id}`);
              const sessionStr = recordMap.get(sessionId);
              let value = sessionStr ? JSON.parse(sessionStr, BufferJSON.reviver) : null;

              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            }
          } catch (error) {
            console.error(`[Auth] Failed to batch get keys!`, error);
          }

          return data;
        },
        set: async (data) => {
          try {
            const upsertPromises: PrismaPromise<unknown>[] = [];
            const deletes: string[] = [];

            for (const category in data) {
              for (const id in data[category as keyof SignalDataTypeMap]) {
                const value = data[category as keyof SignalDataTypeMap]?.[id];
                const file = `${category}-${id}`;
                const sessionId = getSessionId(file);

                if (value) {
                  const session = JSON.stringify(value, BufferJSON.replacer);
                  upsertPromises.push(
                    model.upsert({
                      where: { sessionId },
                      update: { session },
                      create: { sessionId, session },
                    }),
                  );
                } else {
                  deletes.push(sessionId);
                }
              }
            }

            const transactions: PrismaPromise<unknown>[] = [...upsertPromises];

            if (deletes.length > 0) {
              transactions.push(
                model.deleteMany({
                  where: { sessionId: { in: deletes } },
                }),
              );
            }

            if (transactions.length > 0) {
              await prisma.$transaction(transactions);
            }
          } catch (error) {
            console.error(`[Auth] Failed to batch set keys!`, error);
          }
        },
      },
    },
    saveCreds: async (): Promise<void> => {
      await writeData(creds, 'creds');
    },
    clearSession: async (keepCreds: boolean = false): Promise<void> => {
      try {
        await model.deleteMany({
          where: {
            sessionId: { startsWith: `${sessionName}-` },
            ...(keepCreds && {
              NOT: { sessionId: `${sessionName}-creds` },
            }),
          },
        });
      } catch (error) {
        console.error(`[Auth] Failed to clear session: ${sessionName}`, error);
      }
    },
  };
};
