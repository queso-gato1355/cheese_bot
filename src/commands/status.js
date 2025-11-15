import { EmbedBuilder, PermissionsBitField } from 'discord.js';
import os from 'os';
import prisma from '../prismaClient.js';

export const data = {
  name: 'status',
  name_localizations: { ko: '상태' },
  description: '봇의 상태(로그, DB 크기, CPU/RAM)를 확인합니다.',
  description_localizations: { ko: '봇의 상태(로그, DB 크기, CPU/RAM)를 확인합니다.' },
  // keep as production command by default
  development: false,
};

// Note: recent logs are read from AppLog (DB). File-based log helpers removed.

function bytesToHuman(bytes) {
  const thresh = 1024;
  if (Math.abs(bytes) < thresh) return bytes + ' B';
  const units = ['KB','MB','GB','TB','PB','EB','ZB','YB'];
  let u = -1;
  do {
    bytes /= thresh;
    ++u;
  } while (Math.abs(bytes) >= thresh && u < units.length - 1);
  return bytes.toFixed(2)+' '+units[u];
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

async function getProcessCpuPercent(sampleMs = 200) {
  const startUsage = process.cpuUsage();
  const startTime = process.hrtime.bigint();
  await sleep(sampleMs);
  const endUsage = process.cpuUsage();
  const endTime = process.hrtime.bigint();

  const userDiff = endUsage.user - startUsage.user;
  const systemDiff = endUsage.system - startUsage.system;
  const cpuMicros = userDiff + systemDiff; // microseconds
  const elapsedMs = Number(endTime - startTime) / 1e6;
  const cpuMs = cpuMicros / 1000;
  const cpus = os.cpus().length || 1;
  const percent = (cpuMs / (elapsedMs * cpus)) * 100;
  return Math.max(0, percent);
}

export async function execute(interaction) {
  // restrict to guild admins
  const member = interaction.member;
  if (member && !member.permissions.has(PermissionsBitField.Flags.Administrator) && !member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ content: '이 명령은 서버 관리자만 사용할 수 있습니다.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // 1) recent logs from DB (AppLog)
  let logsText = 'DB에 기록된 최근 로그가 없습니다.';
  try {
    const guildId = interaction.guildId;
    if (guildId) {
      const guildRec = await prisma.guild.findUnique({ where: { guildId } });
      if (guildRec) {
        const recent = await prisma.appLog.findMany({
          where: { guildId: guildRec.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
        if (recent && recent.length) {
          logsText = recent
            .map((r) => `${r.createdAt.toISOString()} • ${r.level.toUpperCase()} • ${r.message} ${r.meta ? `• ${JSON.stringify(r.meta)}` : ''}`)
            .join('\n');
        }
      } else {
        logsText = '이 길드에 대한 DB 레코드가 없습니다.';
      }
    } else {
      logsText = '이 명령은 길드 컨텍스트에서만 로그를 보여줍니다.';
    }
  } catch (e) {
    logsText = `로그 조회 실패: ${e.message}`;
  }

  // 2) DB size (Postgres)
  let dbSizeHuman = '알 수 없음';
  try {
    const res = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size_pretty, pg_database_size(current_database()) as size_bytes`;
    // prisma returns an array of objects
    if (Array.isArray(res) && res[0]) {
      dbSizeHuman = res[0].size_pretty || dbSizeHuman;
    }
  } catch (err) {
    dbSizeHuman = `DB 조회 실패: ${err.message}`;
  }

  // 3) CPU & RAM
  let cpuPercent = 0;
  try {
    cpuPercent = await getProcessCpuPercent(200);
  } catch (e) {
    cpuPercent = 0;
  }
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const processMem = process.memoryUsage();

  const embed = new EmbedBuilder()
    .setTitle('봇 상태')
    .setColor(0x2b2d31)
    .addFields(
      { name: '데이터베이스 크기', value: `${dbSizeHuman}`, inline: true },
      { name: 'CPU 사용량 (프로세스)', value: `${cpuPercent.toFixed(2)}%`, inline: true },
      { name: '시스템 메모리', value: `${bytesToHuman(usedMem)} / ${bytesToHuman(totalMem)}`, inline: false },
      { name: '프로세스 메모리(RSS)', value: `${bytesToHuman(processMem.rss)}`, inline: true },
      { name: 'Heap Used', value: `${bytesToHuman(processMem.heapUsed)}`, inline: true }
    )
    .setFooter({ text: '최근 로그(최대 10줄) — 로그가 없으면 파일로 저장되지 않았을 수 있습니다.' });

  // add logs to embed (truncate if long)
  let logsValue = logsText;
  if (logsValue.length > 1000) logsValue = logsValue.slice(0, 1000) + '\n...';
  embed.addFields({ name: '최근 로그 (DB)', value: `\n\`\`\`${logsValue}\n\`\`\`` });

  await interaction.editReply({ embeds: [embed] });
}

export default { data, execute };
