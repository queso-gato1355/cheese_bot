// src/index.js
// 간단한 Discord 봇: 환영 메시지, '/핑' (한국어 로컬라이제이션 포함) 슬래시 명령

import { Client, GatewayIntentBits, Events } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
import * as config from './config.js';

const TOKEN = config.DISCORD_TOKEN;
const CLIENT_ID = config.CLIENT_ID;
const DEV_GUILD_ID = config.DEV_GUILD_ID;

if (!TOKEN) {
	console.error('DISCORD_TOKEN이 설정되어 있지 않습니다. .env 또는 환경변수를 확인하세요.');
	process.exit(1);
}

// file path helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 클라이언트 생성: Guilds와 GuildMembers 권한 필요
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// commands 및 events 동적 로드
client.commands = new Map();

async function loadCommands() {
	const commandsPath = path.join(__dirname, 'commands');
	if (!fs.existsSync(commandsPath)) return;
	const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));
	for (const file of files) {
		const fileUrl = pathToFileURL(path.join(commandsPath, file)).href;
		const mod = await import(fileUrl);
		if (mod && mod.data) {
			// store the module under the command name; data will be read at registration time
			client.commands.set(mod.data.name, mod);
		}
	}
}

async function loadEvents() {
  /* The line `console.log("이벤트를 등록합니다..");` is logging a message in Korean to the console. The message
  translates to "Registering events.." and it is used to indicate that events are being registered
  in the code. This log message helps in providing information to the developer about the current
  operation being performed in the code related to event registration. */
  console.log("이벤트를 등록합니다...");
	const eventsPath = path.join(__dirname, 'events');
	if (!fs.existsSync(eventsPath)) return;
	const files = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'));
	for (const file of files) {
		const fileUrl = pathToFileURL(path.join(eventsPath, file)).href;
		const mod = await import(fileUrl);
		if (!mod || !mod.name || !mod.execute) continue;
		if (mod.once) {
			client.once(mod.name, (...args) => mod.execute(...args, client));
		} else {
			client.on(mod.name, (...args) => mod.execute(...args, client));
		}
	}
}

async function registerCommands() {
	if (!CLIENT_ID) {
		console.warn('CLIENT_ID가 설정되어 있지 않아 명령 등록을 건너뜁니다. (환경변수를 확인하세요)');
		return;
	}

	// Allow disabling runtime registration (recommended for production where CI handles it)
	const SHOULD_REGISTER = (process.env.REGISTER_COMMANDS || 'true').toLowerCase();
	if (SHOULD_REGISTER === 'false' || SHOULD_REGISTER === '0') {
		console.log('REGISTER_COMMANDS is false - skipping runtime command registration.');
		return;
	}

	// DEPLOY_TARGET 환경변수로 배포 대상을 제어합니다. (development => DEV_GUILD_ID에 길드 전용 등록)
	const DEPLOY_TARGET = process.env.DEPLOY_TARGET || process.env.NODE_ENV || 'production';

	try {
		const rest = new REST({ version: '10' }).setToken(TOKEN);

			// Build commandsData from loaded modules and deduplicate by name
			const commandsData = Array.from(client.commands.values())
				.map((m) => m.data)
				.filter((v, i, a) => a.findIndex((x) => x.name === v.name) === i);

			if (DEPLOY_TARGET === 'development') {
				// 개발 모드에서는 전역 명령 등록을 절대 수행하지 않습니다.
				if (DEV_GUILD_ID) {
					console.log(`개발용 길드 명령을 등록합니다 (guildId=${DEV_GUILD_ID})`);
					await rest.put(Routes.applicationGuildCommands(CLIENT_ID, DEV_GUILD_ID), { body: commandsData });
					console.log('개발용 길드 명령 등록 요청이 전송되었습니다.');
				} else {
					console.warn('DEPLOY_TARGET이 development로 설정되어 있으나 DEV_GUILD_ID가 설정되어 있지 않습니다. 개발 환경에서는 전역 명령 등록을 수행하지 않습니다. DEV_GUILD_ID를 설정하면 길드 전용 등록이 수행됩니다.');
				}
				return;
			}

			// 기본: 전역으로 등록 (PUT overwrites existing set)
			console.log('전역 슬래시 명령을 등록합니다 (applicationCommands)... 이 작업은 전파되기까지 최대 1시간이 걸릴 수 있습니다.');
			await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandsData });
			console.log('전역 슬래시 명령 등록 요청이 전송되었습니다. 전파 완료까지 시간이 걸릴 수 있습니다.');
	} catch (err) {
		console.error('명령 등록 중 오류:', err);
	}
}

async function main() {
	await loadCommands();
	await loadEvents();
	client.once(Events.ClientReady, async () => {
		// ready 이벤트 모듈에서도 로그를 남기지만, 등록은 여기서 보장
		await registerCommands();
	});
	await client.login(TOKEN);
}

main().catch((err) => {
	console.error('봇 실행 중 오류:', err);
	process.exit(1);
});
