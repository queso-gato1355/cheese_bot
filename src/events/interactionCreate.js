// src/events/interactionCreate.js
export const name = 'interactionCreate';
export const once = false;

import { EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder } from 'discord.js';
import * as settingsStore from '../utils/settingsStore.js';

export async function execute(interaction, client) {
  try {
    // Chat input commands -> route to command modules
    if (interaction.isChatInputCommand && interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.warn(`Unknown command: ${interaction.commandName}`);
        return;
      }
      await command.execute(interaction, client);
      return;
    }

    // Component interactions (select menus)
    if (interaction.isMessageComponent && interaction.isMessageComponent()) {
      const customId = interaction.customId;

      // settings 메뉴에서 '기본 설정' 선택
      if (customId === 'settings-menu') {
        const value = interaction.values && interaction.values[0];
        if (value === 'basic') {
          // fetch existing settings so we can show placeholders / current values
          const guildId = interaction.guildId;
          const guildSettings = guildId ? await settingsStore.getGuildSettings(guildId) : {};

          const currentChannelId = guildSettings?.welcomeChannelId;
          const currentChannelLabel = currentChannelId ? `<#${currentChannelId}>` : '미설정';

          const embed = new EmbedBuilder()
            .setTitle('기본 설정')
            .setDescription('환영(입장) 메시지를 보낼 채널을 선택하세요.')
            .addFields({ name: '현재 입장 채널', value: currentChannelLabel, inline: false })
            .setColor(0x00AE86);

          const channelSelect = new ChannelSelectMenuBuilder()
            .setCustomId('settings-basic-channel')
            .setPlaceholder(currentChannelId ? `현재: ${currentChannelLabel}` : '채널을 선택하세요')
            .setMaxValues(1);

          const row = new ActionRowBuilder().addComponents(channelSelect);

          // Update original ephemeral message to show channel picker
          await interaction.update({ embeds: [embed], components: [row], content: null });
          return;
        }
      }

      // 채널 선택 결과 처리
      if (customId === 'settings-basic-channel') {
        const channelId = interaction.values && interaction.values[0];
        const guildId = interaction.guildId;
        if (!guildId) {
          await interaction.update({ content: '길드 컨텍스트를 찾을 수 없어 설정할 수 없습니다.', embeds: [], components: [] });
          return;
        }

        // 저장
        await settingsStore.setGuildSetting(guildId, 'welcomeChannelId', channelId);

        const embed = new EmbedBuilder()
          .setTitle('설정 저장됨')
          .setDescription(`입장 메시지 채널이 <#${channelId}>(으)로 설정되었습니다.`)
          .setColor(0x57F287);

        await interaction.update({ embeds: [embed], components: [], content: null });
        return;
      }
    }
  } catch (err) {
    console.error('Interaction 처리 중 오류:', err);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '오류가 발생했습니다.', ephemeral: true });
      } else {
        await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true });
      }
    } catch (e) { /* ignore */ }
  }
}
