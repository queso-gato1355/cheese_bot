import prisma from '../prismaClient.js';

function utcMidnight(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function recordAttendance(guildIdString, discordUserId, when = new Date()) {
  const guild = await prisma.guild.findUnique({ where: { guildId: guildIdString } });
  if (!guild) return null;
  const date = utcMidnight(when);
  try {
    const rec = await prisma.attendance.create({ data: { guildId: guild.id, discordUserId, date } });
    return rec;
  } catch (err) {
    // if unique constraint violated, ignore
    if (err && err.code === 'P2002') return null;
    throw err;
  }
}

export async function hasAttendance(guildIdString, discordUserId, when = new Date()) {
  const guild = await prisma.guild.findUnique({ where: { guildId: guildIdString } });
  if (!guild) return false;
  const date = utcMidnight(when);
  const rec = await prisma.attendance.findUnique({ where: { guildId_discordUserId_date: { guildId: guild.id, discordUserId, date } } }).catch(() => null);
  return !!rec;
}

export async function getUserAttendanceDates(guildIdString, discordUserId, months = 6) {
  const guild = await prisma.guild.findUnique({ where: { guildId: guildIdString } });
  if (!guild) return [];
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const rows = await prisma.attendance.findMany({ where: { guildId: guild.id, discordUserId, date: { gte: cutoff } }, orderBy: { date: 'asc' } });
  return rows.map((r) => r.date);
}

export async function getUserStats(guildIdString, discordUserId) {
  const guild = await prisma.guild.findUnique({ where: { guildId: guildIdString } });
  if (!guild) return { total: 0, streak: 0 };
  const total = await prisma.attendance.count({ where: { guildId: guild.id, discordUserId } });

  // compute current streak: count consecutive days up to today
  const today = utcMidnight(new Date());
  let streak = 0;
  let cursor = new Date(today);
  while (true) {
    const rec = await prisma.attendance.findUnique({ where: { guildId_discordUserId_date: { guildId: guild.id, discordUserId, date: cursor } } }).catch(() => null);
    if (rec) {
      streak += 1;
      cursor = new Date(cursor);
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }
  return { total, streak };
}

export async function getLeaderboard(guildIdString, top = 10) {
  const guild = await prisma.guild.findUnique({ where: { guildId: guildIdString } });
  if (!guild) return [];
  // aggregate counts per discordUserId
  const rows = await prisma.$queryRaw`
    SELECT "discordUserId", COUNT(*) as cnt
    FROM "Attendance"
    WHERE "guildId" = ${guild.id}
    GROUP BY "discordUserId"
    ORDER BY cnt DESC
    LIMIT ${top}
  `;
  // rows contain discordUserId and cnt
  return rows.map((r) => ({ discordUserId: r.discordUserId, count: Number(r.cnt) }));
}

export default { recordAttendance, hasAttendance, getUserAttendanceDates, getUserStats, getLeaderboard };
