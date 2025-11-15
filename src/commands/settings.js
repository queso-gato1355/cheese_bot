// src/commands/settings.js
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import * as settingsStore from '../utils/settingsStore.js';

export const data = {
  name: 'settings',
  name_localizations: { ko: '설정' },
  description: '봇 설정을 관리합니다.',
  description_localizations: { ko: '봇 설정을 관리합니다.' },
  development: false, // <--- 이 플래그가 없으므로 전역(Production) 등록 대상입니다.
};

export async function execute(interaction) {
  // fetch current settings to show as info/placeholder
  const guildId = interaction.guildId;
  const guildSettings = guildId ? await settingsStore.getGuildSettings(guildId) : {};

  const currentWelcome = guildSettings?.welcomeChannelId ? `<#${guildSettings.welcomeChannelId}>` : '미설정';

  const embed = new EmbedBuilder()
    .setTitle('봇 설정')
    .setDescription('아래 드롭다운에서 설정 항목을 선택하세요.')
    .addFields({ name: '현재 입장 채널', value: currentWelcome, inline: false })
    .setColor(0x2b2d31);

  const menu = new StringSelectMenuBuilder()
    .setCustomId('settings-menu')
    .setPlaceholder('설정 항목을 선택하세요')
    .addOptions([
      {
        label: '기본 설정',
        description: '서버의 기본 동작을 설정합니다 (예: 입장 메시지 채널)',
        value: 'basic',
      },
    ]);

  const row = new ActionRowBuilder().addComponents(menu);

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}
