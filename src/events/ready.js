// src/events/ready.js
export const name = 'ready';
export const once = true;

export async function execute(client) {
  console.log(`Logged in as ${client.user.tag}`);
}
