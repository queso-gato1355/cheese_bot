import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } from 'discord.js';
import * as settingsStore from '../utils/settingsStore.js';
import attendanceStore from '../utils/attendanceStore.js';

export const data = new SlashCommandBuilder().setName('attendance').setDescription('출석체크 채널에 출석 대시보드를 게시합니다. (관리자 전용)');

export async function execute(interaction) {
  // permission check: ManageGuild
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member || !member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ content: '이 명령을 사용하려면 서버 관리 권한이 필요합니다.', ephemeral: true });
    return;
  }

  const guildId = interaction.guildId;
  const settings = await settingsStore.getGuildSettings(guildId);
  const channelId = settings.attendanceChannelId;
  if (!channelId) {
    await interaction.reply({ content: '출석체크 채널이 설정되어 있지 않습니다. 먼저 설정해주세요.', ephemeral: true });
    return;
  }

  const channel = interaction.guild.channels.cache.get(channelId) || await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    await interaction.reply({ content: '출석 채널을 찾을 수 없습니다.', ephemeral: true });
    return;
  }

  // build leaderboard embed
  const leaderboard = await attendanceStore.getLeaderboard(guildId, 10);
  const lbEmbed = new EmbedBuilder().setTitle('출석 랭킹 (Top 10)').setColor(0xFFD166);
  if (leaderboard.length === 0) lbEmbed.setDescription('아직 출석 기록이 없습니다.');
  else {
    lbEmbed.setDescription(leaderboard.map((r, i) => `${i+1}. <@${r.discordUserId}> — ${r.count}회`).join('\n'));
  }

  const publicRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('attendance-my').setLabel('내 출석 확인').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('attendance-refresh').setLabel('랭킹 새로고침').setStyle(ButtonStyle.Primary)
  );

  // post public leaderboard message
  await channel.send({ embeds: [lbEmbed], components: [publicRow] });

  await interaction.reply({ content: '출석체크 대시보드를 게시했습니다.', ephemeral: true });
}
