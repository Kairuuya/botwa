import type { User } from "@prisma/client";
import type { Client } from "../../core/client/client.js";
import type { Logger } from "../../core/logger/pino.js";
import type { GroupService } from "../../services/group.service.js";
import type { UserService } from "../../services/user.service.js";
import type { GroupWithRelations } from "./group.js";
import type { MessageSerialize } from "./serialize.js";

export type ContextOptions = {
  client: Client;
  msg: MessageSerialize;
  services: Services;
  user: User;
  group: GroupWithRelations | null;
  logger: Logger;
};

export type Services = {
  user: UserService;
  group: GroupService;
};
