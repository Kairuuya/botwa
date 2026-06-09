export const id = {
  general: {
    COMMAND_FAILED:
      'Maaf, terjadi gangguan pada sistem.\nLaporan error otomatis telah dikirim ke Owner.\nSilahkan coba kembali beberapa saat lagi.',
    COMMAND_SUGGEST:
      'Command *{prefix}{command}* tidak ditemukan.\nMungkin maksud kamu:\n{suggestions}',
    COMMAND_HELP: `📌 {command}
{description}

Penggunaan : {usage}
Contoh     : {example}
Alias      : {aliases}
Cooldown   : {cooldown}
Premium    : {premium}`,
  },
  validation: {
    REQUIRE_OWNER: 'Command *{prefix}{command}* ini hanya bisa dipakai oleh Owner!',
    REQUIRE_GROUP: 'Command *{prefix}{command}* ini hanya bisa dipakai di grup.',
    REQUIRE_PRIVATE: 'Command *{prefix}{command}* ini hanya bisa dipakai di private chat.',
    REQUIRE_PREMIUM: 'Command *{prefix}{command}* ini hanya bisa dipakai oleh premium member.',
    REQUIRE_GROUP_ADMIN: 'Command *{prefix}{command}* ini hanya bisa dipakai oleh admin grup.',
    REQUIRE_BOT_ADMIN: 'Command *{prefix}{command}* ini hanya bisa dipakai oleh admin grup.',
  },
};
