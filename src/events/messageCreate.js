export const name = 'messageCreate';
export const once = false;

import attendanceStore from '../utils/attendanceStore.js';

export async function execute(message, client) {
  try {
    if (!message.guild || message.author.bot) return;
    // auto-record attendance when user sends any message in the guild
    await attendanceStore.recordAttendance(message.guild.id, message.author.id, new Date());
  } catch (err) {
    console.error('messageCreate attendance error:', err);
  }
}
