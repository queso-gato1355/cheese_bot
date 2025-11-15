// src/events/guildMemberAdd.js
export const name = 'guildMemberAdd';
export const once = false;

import * as settingsStore from '../utils/settingsStore.js';
import prisma from '../prismaClient.js';

export async function execute(member) {
  try {
    const guildId = member.guild.id;
    const guildSettings = await settingsStore.getGuildSettings(guildId);

    let channel = null;
    if (guildSettings && guildSettings.welcomeChannelId) {
      channel = member.guild.channels.cache.get(guildSettings.welcomeChannelId) || null;
    }

    // fallback to system channel or first writable text channel
    if (!channel) {
      channel = member.guild.systemChannel;
    }
    if (!channel) {
      channel = member.guild.channels.cache.find(
        (c) => c.type === 0 && c.permissionsFor(member.guild.members.me).has(0x00000800)
      );
    }

    if (channel) {
      const me = member.guild.members.me;
      const canSend = channel.permissionsFor(me)?.has(0x00000800);
      if (!canSend) {
        console.warn('[guildMemberAdd] Bot does not have SendMessages permission in channel:', channel.id);
      } else {
        await channel.send({ content: `환영합니다, ${member}! 서버에 오신 걸 환영해요 🎉` });
        // record event in DB
        try {
          let guildRec = await prisma.guild.findUnique({ where: { guildId: member.guild.id } });
          if (!guildRec) {
            guildRec = await prisma.guild.create({ data: { guildId: member.guild.id, name: member.guild.name } });
          }
          // upsert DiscordUser
          try {
            await prisma.discordUser.upsert({
              where: { discordId: member.id },
              create: {
                discordId: member.id,
                username: member.user?.username || '',
                discriminator: member.user?.discriminator || '',
                joinedAt: member.joinedAt || null,
                guildId: guildRec.id,
              },
              update: {
                username: member.user?.username || '',
                discriminator: member.user?.discriminator || '',
                joinedAt: member.joinedAt || null,
                guildId: guildRec.id,
              },
            });
          } catch (e) {
            console.error('[guildMemberAdd] DiscordUser upsert error:', e);
          }

          await prisma.memberEventLog.create({
            data: {
              guildId: guildRec.id,
              eventType: 'join',
              meta: { discordId: member.id, tag: member.user?.tag },
            },
          });
        } catch (e) {
          console.error('[guildMemberAdd] DB log error:', e);
        }
      }
    } else {
      console.warn(`[guildMemberAdd] 환영 메시지를 보낼 채널을 찾을 수 없습니다: guild=${member.guild.id}`);
    }
  } catch (err) {
    console.error('GuildMemberAdd 처리 중 오류:', err?.stack || err);
  }
}
