// src/utils/settingsStore.js
// Migrate settings storage to Prisma (PostgreSQL). Uses the Guild and GuildSetting models.
import prisma from '../prismaClient.js';

const ALLOWED_KEYS = ['welcomeChannelId', 'leaveChannelId'];
const ROLE_TYPES = ['OWNER', 'ADMIN', 'USER', 'MUTE'];

async function findOrCreateGuild(guildIdString) {
  // guildIdString is the Discord guild ID (string)
  let guild = await prisma.guild.findUnique({ where: { guildId: guildIdString } });
  if (!guild) {
    guild = await prisma.guild.create({ data: { guildId: guildIdString } });
  }
  return guild;
}

export async function getGuildSettings(guildIdString) {
  try {
    const guild = await findOrCreateGuild(guildIdString);
    const setting = await prisma.guildSetting.findUnique({ where: { guildId: guild.id } });
    if (!setting) return {};
    // return plain object with relevant keys
    return {
      welcomeChannelId: setting.welcomeChannelId || undefined,
      leaveChannelId: setting.leaveChannelId || undefined,
    };
  } catch (err) {
    console.error('settingsStore.getGuildSettings error:', err);
    return {};
  }
}

// Roles helpers
export async function getGuildRoles(guildIdString) {
  try {
    const guild = await findOrCreateGuild(guildIdString);
    const rows = await prisma.guildRole.findMany({ where: { guildId: guild.id } });
    const result = {};
    for (const r of rows) {
      result[r.type] = r.roleId;
    }
    return result;
  } catch (err) {
    console.error('settingsStore.getGuildRoles error:', err);
    return {};
  }
}

export async function setGuildRole(guildIdString, type, roleId) {
  if (!ROLE_TYPES.includes(type)) throw new Error('Invalid role type');
  try {
    const guild = await findOrCreateGuild(guildIdString);
    await prisma.guildRole.upsert({
      where: { guildId_type: { guildId: guild.id, type } },
      create: { guildId: guild.id, type, roleId },
      update: { roleId },
    });
  } catch (err) {
    console.error('settingsStore.setGuildRole error:', err);
    throw err;
  }
}

export async function setGuildRoles(guildIdString, rolesObject) {
  try {
    const guild = await findOrCreateGuild(guildIdString);
    const ops = [];
    for (const [k, v] of Object.entries(rolesObject || {})) {
      if (!ROLE_TYPES.includes(k)) continue;
      ops.push(
        prisma.guildRole.upsert({
          where: { guildId_type: { guildId: guild.id, type: k } },
          create: { guildId: guild.id, type: k, roleId: v },
          update: { roleId: v },
        })
      );
    }
    await Promise.all(ops);
  } catch (err) {
    console.error('settingsStore.setGuildRoles error:', err);
    throw err;
  }
}

export async function removeGuildRoles(guildIdString) {
  try {
    const guild = await findOrCreateGuild(guildIdString);
    await prisma.guildRole.deleteMany({ where: { guildId: guild.id } });
  } catch (err) {
    console.error('settingsStore.removeGuildRoles error:', err);
    throw err;
  }
}

export async function setGuildSetting(guildIdString, key, value) {
  if (!ALLOWED_KEYS.includes(key)) {
    throw new Error(`Invalid settings key: ${key}`);
  }
  try {
    const guild = await findOrCreateGuild(guildIdString);
    // upsert GuildSetting by guildId (which is unique int fk)
    await prisma.guildSetting.upsert({
      where: { guildId: guild.id },
      create: { guildId: guild.id, [key]: value },
      update: { [key]: value },
    });
  } catch (err) {
    console.error('settingsStore.setGuildSetting error:', err);
    throw err;
  }
}

export async function setGuildSettings(guildIdString, settings) {
  // filter allowed keys
  const toSave = {};
  for (const k of Object.keys(settings || {})) {
    if (ALLOWED_KEYS.includes(k)) toSave[k] = settings[k];
  }
  if (Object.keys(toSave).length === 0) return;
  try {
    const guild = await findOrCreateGuild(guildIdString);
    await prisma.guildSetting.upsert({
      where: { guildId: guild.id },
      create: { guildId: guild.id, ...toSave },
      update: { ...toSave },
    });
  } catch (err) {
    console.error('settingsStore.setGuildSettings error:', err);
    throw err;
  }
}

export default {
  getGuildSettings,
  setGuildSetting,
  setGuildSettings,
};
