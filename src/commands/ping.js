// src/commands/ping.js
import { EmbedBuilder } from 'discord.js';

export const data = {
  name: 'ping',
  name_localizations: { ko: '핑' },
  description: '봇의 지연 시간을 확인합니다.',
  description_localizations: { ko: '봇의 지연 시간을 확인합니다.' },
  development: false, // production 명령어
};

export async function execute(interaction, client) {
  // 먼저 간단한 응답을 보내고 RTT를 계산합니다.
  const reply = await interaction.reply({ content: '핑 측정 중...', fetchReply: true });
  const rtt = reply.createdTimestamp - interaction.createdTimestamp;
  const ws = Math.round(client.ws.ping);

  const embed = new EmbedBuilder()
    .setTitle('🏓 핑 결과')
    .setColor(0x2b2d31)
    .addFields(
      { name: '웹소켓 지연 (WS)', value: `${ws} ms`, inline: true },
      { name: '응답 시간 (RTT)', value: `${rtt} ms`, inline: true }
    )
    .setFooter({ text: '측정값은 네트워크 상황에 따라 달라질 수 있습니다.' });

  await interaction.editReply({ content: null, embeds: [embed] });
}
