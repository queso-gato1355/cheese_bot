// src/commands/settings.js
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder } from 'discord.js';
import * as settingsStore from '../utils/settingsStore.js';

export const data = {
  name: 'settings',
  name_localizations: { ko: '설정' },
  description: '봇 설정을 관리합니다.',
  description_localizations: { ko: '봇 설정을 관리합니다.' },
  development: true, // <--- 이 플래그가 없으므로 전역(Production) 등록 대상입니다.
};

export async function execute(interaction) {
  // fetch current settings to show as info/placeholder
  const guildId = interaction.guildId;
  const guildSettings = guildId ? await settingsStore.getGuildSettings(guildId) : {};
  const guildRoles = guildId ? await settingsStore.getGuildRoles(guildId) : {};

  const currentWelcome = guildSettings?.welcomeChannelId ? `<#${guildSettings.welcomeChannelId}>` : '미설정';

  const embed = new EmbedBuilder()
    .setTitle('봇 설정')
    .setDescription('아래 드롭다운에서 설정 항목을 선택하세요.')
    .addFields({ name: '현재 입장 채널', value: currentWelcome, inline: false })
    .addFields({ name: '서버 역할 매핑', value: `서버장: ${guildRoles.OWNER ? `<@&${guildRoles.OWNER}>` : '미설정'}\n관리자: ${guildRoles.ADMIN ? `<@&${guildRoles.ADMIN}>` : '미설정'}\n사용자: ${guildRoles.USER ? `<@&${guildRoles.USER}>` : '미설정'}\n뮤트: ${guildRoles.MUTE ? `<@&${guildRoles.MUTE}>` : '미설정'}`, inline: false })
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
      {
        label: '출석 설정',
        description: '출석체크 채널을 설정합니다',
        value: 'attendance',
      },
    ]);

  const row = new ActionRowBuilder().addComponents(menu);

  const createRolesBtn = new ButtonBuilder()
    .setCustomId('create-roles')
    .setLabel('역할 생성 (새로 만들기)')
    .setStyle(ButtonStyle.Primary);

  const assignRoleBtn = new ButtonBuilder()
    .setCustomId('assign-role-start')
    .setLabel('역할 지정 (기존 역할 사용)')
    .setStyle(ButtonStyle.Secondary);

  const resetMappingBtn = new ButtonBuilder()
    .setCustomId('reset-mapping')
    .setLabel('역할 매핑 초기화')
    .setStyle(ButtonStyle.Danger);

  const deleteRolesBtn = new ButtonBuilder()
    .setCustomId('delete-roles')
    .setLabel('생성된 역할 삭제')
    .setStyle(ButtonStyle.Danger);

  const btnRow1 = new ActionRowBuilder().addComponents(createRolesBtn, assignRoleBtn);
  const btnRow2 = new ActionRowBuilder().addComponents(resetMappingBtn, deleteRolesBtn);

  await interaction.reply({ embeds: [embed], components: [row, btnRow1, btnRow2], ephemeral: true });
}
