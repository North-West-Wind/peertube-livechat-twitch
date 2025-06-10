import "dotenv/config";
import {  mkdirSync } from "fs";
import { PeerTubeXMPPClient } from "peertube-livechat-xmpp";
import { getConfig } from "./config";
import { SwappableDoubleClient } from "./chat";
import { TwitchAuthenticator } from "./auth";
import { HelixChatUserColor } from "@twurple/api";

const DATA_DIR = process.env.DATA_DIR || "data";
mkdirSync(DATA_DIR, { recursive: true });

const config = getConfig(DATA_DIR);
if (!config?.instance || !config.roomId || !config.twitchChannel)
	throw new Error(`No "instance", "roomId" or "twitchChannel" in ${DATA_DIR}/config.json`);

const COLOR_CHOICES: HelixChatUserColor[] = [
	"blue",
	"blue_violet",
	"cadet_blue",
	"chocolate",
	"coral",
	"dodger_blue",
	"firebrick",
	"golden_rod",
	"green",
	"hot_pink",
	"orange_red",
	"red",
	"sea_green",
	"spring_green",
	"yellow_green"
];

let botUser: { id: string, name: string } | undefined;
let currentColor: HelixChatUserColor | undefined;
const ignoredPeertubeUsers = new Set<string>();

const twitchColors = new Map<string, HelixChatUserColor>(); // occupant id -> color
const receiverClient = new PeerTubeXMPPClient(config.instance, config.roomId, { nickname: "Twitch Receiver #" + (Math.ceil(Math.random() * 20)) })
receiverClient.on("message", async message => {
	const author = message.author();
	if (swappable.chatClient.isConnected && author && !ignoredPeertubeUsers.has(author.occupantId)) {
		if (botUser) {
			if (twitchColors.has(author.occupantId)) {
				const color = twitchColors.get(author.occupantId)!;
				if (color != currentColor)
					await swappable.apiClient?.chat.setColorForUser(botUser.id, color);
			} else {
				// pick a new color different from current
				let color = COLOR_CHOICES[Math.floor(Math.random() * COLOR_CHOICES.length)];
				while (color == currentColor)
					color = COLOR_CHOICES[Math.floor(Math.random() * COLOR_CHOICES.length)];
				twitchColors.set(author.occupantId, color);
				await swappable.apiClient?.chat.setColorForUser(botUser.id, color);
			}
		}
		await swappable.chatClient.say(config.twitchChannel, `@${author.nickname} ${message.body}`);
	}
});

const xmppClients = new Map<string, PeerTubeXMPPClient>();
const messages = new Map<string, { originId: string, occupantId: string }>(); // twitch message id -> { origin id, occupant id }
const auth = new TwitchAuthenticator(DATA_DIR);
const swappable = new SwappableDoubleClient({ channels: [config.twitchChannel] });

swappable.onSwap((chatClient, apiClient) => {
	apiClient?.getTokenInfo().then(info => {
		if (info.userId && info.userName)
			botUser = { id: info.userId, name: info.userName };
		console.log("Twitch is logged in as " + info.userName);

		if (info.userId)
			apiClient?.chat.getColorForUser(info.userId).then(color => {
				if (color) currentColor = color as HelixChatUserColor;
				else currentColor = undefined;
			});
	}).catch(console.error);


	chatClient.onMessage(async (_channel, user, text, message) => {
		if (user == botUser?.name) return;

		if (!xmppClients.has(user)) {
			const xmpp = new PeerTubeXMPPClient(config.instance, config.roomId, { nickname: `${message.userInfo.displayName} (Twitch)` });
			xmppClients.set(user, xmpp);
			await new Promise<void>(res => {
				xmpp.on("ready", () => res());
			});
			if (xmpp.users.self?.occupantId)
				ignoredPeertubeUsers.add(xmpp.users.self.occupantId);
		}
	
		const xmpp = xmppClients.get(user)!;
		try {
			const response = await xmpp.message(text);
			messages.set(message.id, { originId: response.originId, occupantId: response.authorId });
		} catch (err) {
			console.error(err);
		}
	});

	chatClient.onMessageRemove(async (_channel, id, _message) => {
		if (messages.has(id)) {
			const { originId, occupantId } = messages.get(id)!;
			const xmpp = xmppClients.get(occupantId);
			if (xmpp) {
				try {
					await xmpp.delete(originId);
				} catch (err) {
					console.error(err);
				}
			}

			messages.delete(id);
		}
	});

	chatClient.onConnect(() => {
		console.log("Connected to Twitch!");
	});
	
	chatClient.onDisconnect(() => {
		auth.getAuthProvider().then(authProvider => swappable.mergeConfig({ authProvider }));
	});

	swappable.connect();
});

auth.getAuthProvider().then(authProvider => swappable.mergeConfig({ authProvider }));
auth.on("refresh", authProvider => {
	if (authProvider)
		swappable.mergeConfig({ authProvider });
});