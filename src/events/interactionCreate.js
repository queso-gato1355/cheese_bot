// src/events/interactionCreate.js
export const name = 'interactionCreate';
export const once = false;

import { EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, PermissionsBitField, StringSelectMenuBuilder, RoleSelectMenuBuilder } from 'discord.js';
import * as settingsStore from '../utils/settingsStore.js';
import { ButtonStyle } from 'discord.js';

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

      // '역할 생성' 버튼 처리
      if (customId === 'create-roles') {
        const guild = interaction.guild;
        if (!guild) {
          await interaction.update({ content: '길드 컨텍스트를 찾을 수 없습니다.', embeds: [], components: [] });
          return;
        }

        // Permission check: user needs ManageRoles
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member || !member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
          await interaction.update({ content: '이 작업을 수행하려면 역할 관리 권한이 필요합니다.', embeds: [], components: [] });
          return;
        }

        // Create roles with specific names, but reuse existing roles with the same name when possible.
        try {
          const defs = [
            { key: 'OWNER', name: '서버장 | Owner', perms: [PermissionsBitField.Flags.Administrator] },
            { key: 'ADMIN', name: '관리자 | Admin', perms: [PermissionsBitField.Flags.ManageRoles, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.KickMembers, PermissionsBitField.Flags.BanMembers, PermissionsBitField.Flags.ManageMessages] },
            { key: 'USER', name: '사용자 | User', perms: [] },
            { key: 'MUTE', name: '뮤트 | Mute', perms: [] },
          ];
          const created = {};
          for (const d of defs) {
            // try to find existing role by exact name (reuse)
            let role = guild.roles.cache.find((r) => r.name === d.name);
            if (!role) {
              // create role with default permissions per type
              const opts = { name: d.name, reason: '자동 생성된 역할 (cheese_bot)' };
              if (d.perms && d.perms.length) opts.permissions = d.perms;
              role = await guild.roles.create(opts);
            }
            created[d.key] = role.id;
          }

          // persist to DB
          await settingsStore.setGuildRoles(interaction.guildId, created);

          const embedSuccess = new EmbedBuilder()
            .setTitle('역할 생성/재사용 완료')
            .setDescription('기본 역할들을 생성하거나 기존 역할을 재사용하고 설정에 저장했습니다.')
            .setColor(0x57F287)
            .addFields({ name: '결과', value: defs.map(d => `${d.name} • <@&${created[d.key]}>`).join('\n') });

          await interaction.update({ embeds: [embedSuccess], components: [], content: null });
        } catch (err) {
          console.error('Error creating roles:', err);
          await interaction.update({ content: '역할 생성 중 오류가 발생했습니다. 봇에게 역할 생성 권한이 있는지 확인하세요.', embeds: [], components: [] });
        }
        return;
      }

      // 역할 지정 - 시작 (사용자가 기존 역할을 선택해서 매핑)
      if (customId === 'assign-role-start') {
        const typeMenu = new StringSelectMenuBuilder()
          .setCustomId('assign-role-type')
          .setPlaceholder('매핑할 역할 유형을 선택하세요')
          .addOptions([
            { label: '서버장 (Owner)', value: 'OWNER' },
            { label: '관리자 (Admin)', value: 'ADMIN' },
            { label: '사용자 (User)', value: 'USER' },
            { label: '뮤트 (Mute)', value: 'MUTE' },
          ]);
        const row = new ActionRowBuilder().addComponents(typeMenu);
        await interaction.update({ content: null, embeds: [], components: [row] });
        return;
      }

      // 역할 유형 선택 -> RoleSelect 으로 넘김
      if (customId === 'assign-role-type') {
        const selected = interaction.values && interaction.values[0];
        if (!selected) {
          await interaction.update({ content: '역할 유형을 선택하지 않았습니다.', embeds: [], components: [] });
          return;
        }
        const rolePicker = new RoleSelectMenuBuilder().setCustomId(`assign-role-pick:${selected}`).setMaxValues(1).setPlaceholder('매핑할 역할을 선택하세요');
        const row = new ActionRowBuilder().addComponents(rolePicker);
        await interaction.update({ content: null, embeds: [], components: [row] });
        return;
      }

      // 실제 역할 선택 처리
      if (customId && customId.startsWith('assign-role-pick:')) {
        const parts = customId.split(':');
        const type = parts[1];
        const roleId = interaction.values && interaction.values[0];
        if (!roleId) {
          await interaction.update({ content: '역할을 선택하지 않았습니다.', embeds: [], components: [] });
          return;
        }
        try {
          await settingsStore.setGuildRole(interaction.guildId, type, roleId);
          const embed = new EmbedBuilder().setTitle('역할 지정됨').setDescription(`${type} 역할이 <@&${roleId}>(으)로 지정되었습니다.`).setColor(0x57F287);
          await interaction.update({ embeds: [embed], components: [], content: null });
        } catch (err) {
          console.error('assign-role-pick error:', err);
          await interaction.update({ content: '역할을 저장하는 중 오류가 발생했습니다.', embeds: [], components: [] });
        }
        return;
      }

      // 역할 매핑 초기화 (DB 매핑만 제거)
      if (customId === 'reset-mapping') {
        const guild = interaction.guild;
        if (!guild) return await interaction.update({ content: '길드 컨텍스트를 찾을 수 없습니다.', embeds: [], components: [] });
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member || !member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
          return await interaction.update({ content: '이 작업을 수행하려면 역할 관리 권한이 필요합니다.', embeds: [], components: [] });
        }
        try {
          await settingsStore.removeGuildRoles(interaction.guildId);
          const embed = new EmbedBuilder().setTitle('초기화 완료').setDescription('역할 매핑이 초기화되었습니다 (DB에서 제거됨).').setColor(0xF1C40F);
          await interaction.update({ embeds: [embed], components: [], content: null });
        } catch (err) {
          console.error('reset-mapping error:', err);
          await interaction.update({ content: '초기화 중 오류가 발생했습니다.', embeds: [], components: [] });
        }
        return;
      }

      // 생성된 역할 삭제: DB에 저장된 roleId들을 실제로 길드에서 삭제하고 매핑 제거
      if (customId === 'delete-roles') {
        const guild = interaction.guild;
        if (!guild) return await interaction.update({ content: '길드 컨텍스트를 찾을 수 없습니다.', embeds: [], components: [] });
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member || !member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
          return await interaction.update({ content: '이 작업을 수행하려면 역할 관리 권한이 필요합니다.', embeds: [], components: [] });
        }
        // check bot permissions
        const me = guild.members.me;
        if (!me || !me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
          return await interaction.update({ content: '봇에게 역할 삭제 권한이 없습니다.', embeds: [], components: [] });
        }
        try {
          const roles = await settingsStore.getGuildRoles(interaction.guildId);
          const deleted = [];
          const failed = [];
          for (const [type, rid] of Object.entries(roles || {})) {
            try {
              let role = guild.roles.cache.get(rid);
              if (!role) role = await guild.roles.fetch(rid).catch(() => null);
              if (role) {
                await role.delete('자동 삭제: 역할 재설정 요청');
                deleted.push({ type, id: rid });
              } else {
                failed.push({ type, id: rid, reason: 'not found' });
              }
            } catch (e) {
              failed.push({ type, id: rid, reason: e.message });
            }
          }
          // remove mappings regardless
          await settingsStore.removeGuildRoles(interaction.guildId);
          const embed = new EmbedBuilder()
            .setTitle('삭제 완료')
            .setDescription(`삭제됨: ${deleted.length}개, 실패: ${failed.length}개`)
            .setColor(0xE74C3C)
            .addFields(
              { name: '삭제된 항목', value: deleted.map(d => `${d.type} • ${d.id}`).join('\n') || '없음' },
              { name: '실패한 항목', value: failed.map(f => `${f.type} • ${f.id} • ${f.reason}`).join('\n') || '없음' }
            );
          await interaction.update({ embeds: [embed], components: [], content: null });
        } catch (err) {
          console.error('delete-roles error:', err);
          await interaction.update({ content: '역할 삭제 중 오류가 발생했습니다.', embeds: [], components: [] });
        }
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
