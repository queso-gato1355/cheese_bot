// src/config.js
// dotenv로 환경변수를 로드하고 필요한 상수를 export합니다. ESM 형식
import dotenv from 'dotenv';

// .env 파일을 프로젝트 루트에서 로드합니다.
dotenv.config();

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';
export const CLIENT_ID = process.env.CLIENT_ID || '';
export const DEV_GUILD_ID = process.env.DEV_GUILD_ID || '';

if (!DISCORD_TOKEN) {
	console.warn('Warning: DISCORD_TOKEN is not set in environment. Set it in .env or environment variables.');
}
if (!CLIENT_ID) {
	console.warn('Warning: CLIENT_ID is not set in environment. Some features (command registration) may fail.');
}
