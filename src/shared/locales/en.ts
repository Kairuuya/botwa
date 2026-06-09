import type { id } from './id.js';

export const en: typeof id = {
  general: {
    COMMAND_FAILED: 'Command *{prefix}{command}* failed.\nReason:\n{reason}',
    COMMAND_SUGGEST: 'Command *{prefix}{command}* not found.\nDid you mean:\n{suggestions}',
    COMMAND_HELP: `📌 {command}
{description}

Usage : {usage}
Example : {example}
Aliases : {aliases}
Cooldown : {cooldown}
Premium : {premium}`,
  },
  validation: {
    REQUIRE_OWNER: 'This command *{prefix}{command}* is for bot owner only.',
    REQUIRE_GROUP: 'This command *{prefix}{command}* can only be used in groups.',
    REQUIRE_PRIVATE: 'This command *{prefix}{command}* is for private chat only.',
    REQUIRE_PREMIUM: 'This command *{prefix}{command}* is for premium users only.',
    REQUIRE_GROUP_ADMIN: 'You must be an admin to use this command *{prefix}{command}*.',
    REQUIRE_BOT_ADMIN: 'Bot must be an admin first before command *{prefix}{command}* can be used.',
  },
};
