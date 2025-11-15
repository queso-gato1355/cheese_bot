import prisma from '../prismaClient.js';

async function findOrCreateGuild(guildIdString, guildName) {
  if (!guildIdString) return null;
  let guild = await prisma.guild.findUnique({ where: { guildId: guildIdString } });
  if (!guild) {
    guild = await prisma.guild.create({ data: { guildId: guildIdString, name: guildName || null } });
  }
  return guild;
}

/**
 * Write a log entry into AppLog.
 * level: 'info'|'warn'|'error'
 */
export async function log(level, message, meta = null, guildIdString = null, guildName = null) {
  try {
    let guildId = null;
    if (guildIdString) {
      const guild = await findOrCreateGuild(guildIdString, guildName);
      if (guild) guildId = guild.id;
    }
    const rec = await prisma.appLog.create({ data: { guildId, level, message: String(message || ''), meta } });
    return rec;
  } catch (err) {
    // best-effort: log to console if DB write fails
    console.error('[logger] failed to persist log:', err);
    return null;
  }
}

export async function info(message, meta = null, guildIdString = null, guildName = null) {
  return log('info', message, meta, guildIdString, guildName);
}

export async function warn(message, meta = null, guildIdString = null, guildName = null) {
  return log('warn', message, meta, guildIdString, guildName);
}

export async function error(message, meta = null, guildIdString = null, guildName = null) {
  return log('error', message, meta, guildIdString, guildName);
}

export default { log, info, warn, error };
