// src/commands/ping.js
export const data = {
  name: 'ping',
  name_localizations: { ko: '핑' },
  description: '봇의 지연 시간을 확인합니다.',
  description_localizations: { ko: '봇의 지연 시간을 확인합니다.' },
};

export async function execute(interaction, client) {
  // interaction is a ChatInputCommandInteraction
  const reply = await interaction.reply({ content: '핑 확인 중...', fetchReply: true });
  const rtt = reply.createdTimestamp - interaction.createdTimestamp;
  const ws = Math.round(client.ws.ping);
  await interaction.editReply(`🏓 Pong! WS: ${ws}ms | RTT: ${rtt}ms`);
}
