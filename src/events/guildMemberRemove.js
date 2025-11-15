// src/events/guildMemberRemove.js
export const name = 'guildMemberRemove';
export const once = false;

import * as settingsStore from '../utils/settingsStore.js';
import prisma from '../prismaClient.js';

export async function execute(member) {
  try {
    const guildId = member.guild.id;
    const guildSettings = await settingsStore.getGuildSettings(guildId);

    // Prefer a dedicated leave channel if provided, else fallback to welcomeChannelId
    let channelId = guildSettings?.leaveChannelId || guildSettings?.welcomeChannelId;

    let channel = null;
    if (channelId) {
      channel = member.guild.channels.cache.get(channelId) || null;
    }

    if (!channel) channel = member.guild.systemChannel;
    if (!channel) {
      channel = member.guild.channels.cache.find(
        (c) => c.type === 0 && c.permissionsFor(member.guild.members.me).has(0x00000800)
      );
    }

    if (channel) {
      const me = member.guild.members.me;
      const canSend = channel.permissionsFor(me)?.has(0x00000800);
      if (!canSend) {
        console.warn('[guildMemberRemove] Bot does not have SendMessages permission in channel:', channel.id);
      } else {
        await channel.send({ content: `안타깝게도 ${member.user.tag}님이 서버를 떠났습니다.` });
        // record leave event
        try {
          let guildRec = await prisma.guild.findUnique({ where: { guildId: member.guild.id } });
          if (!guildRec) {
            guildRec = await prisma.guild.create({ data: { guildId: member.guild.id, name: member.guild.name } });
          }
          await prisma.memberEventLog.create({
            data: {
              guildId: guildRec.id,
              eventType: 'leave',
              meta: { discordId: member.id, tag: member.user?.tag },
            },
          });
        } catch (e) {
          console.error('[guildMemberRemove] DB log error:', e);
        }
      }
    } else {
      console.warn(`[guildMemberRemove] 탈퇴 메시지를 보낼 채널을 찾을 수 없습니다: guild=${member.guild.id}`);
    }
  } catch (err) {
    console.error('GuildMemberRemove 처리 중 오류:', err?.stack || err);
  }
}
