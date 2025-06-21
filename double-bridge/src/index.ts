import "dotenv/config";
import {  mkdirSync } from "fs";
import { PeerTubeXMPPClient } from "peertube-livechat-xmpp";
import { getConfig } from "./config";
import { SwappableDoubleClient } from "./chat";
import { TwitchAuthenticator } from "./auth";
import { HelixChatUserColor } from "@twurple/api";
import EmoteTranslator from "./emote";

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

const emoteTranslator = new EmoteTranslator();

let botUser: { id: string, name: string } | undefined;
let currentColor: HelixChatUserColor | undefined;
const ignoredPeertubeUsers = new Set<string>();

const twitchColors = new Map<string, HelixChatUserColor>(); // occupant id -> color
const receiverClient = new PeerTubeXMPPClient(config.instance, config.roomId, { nickname: "Twitch Receiver #" + (Math.ceil(Math.random() * 20)) })
receiverClient.on("ready", () => {
	console.log("PeerTube is ready");
	emoteTranslator.updatePeertube(Array.from(receiverClient.customEmojis.keys()));
});
receiverClient.on("message", async message => {
	const author = message.author();
	if (swappable.chatClient.isConnected && author && !ignoredPeertubeUsers.has(author.occupantId)) {
		let text = message.body;
		if (botUser) {
			const emotes: { start: number, end: number, name: string }[] = [];
			for (const emote of receiverClient.customEmojis.keys()) {
				let index = text.indexOf(emote);
				if (index >= 0) {
					const replaced = emoteTranslator.findTwitch(emote);
					if (!replaced) continue;
					while (index >= 0) {
						emotes.push({ start: index, end: index + emote.length - 1, name: replaced });
						index = text.indexOf(emote, index + emote.length);
					}
				}
			}
			for (const emote of emotes.sort((a, b) => b.start - a.start)) {
				text = text.slice(0, emote.start) + emote.name + text.slice(emote.end + 1);
			}
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
		await swappable.chatClient.say(config.twitchChannel, `@${author.nickname} ${text}`);
	}
});

const xmppClients = new Map<string, PeerTubeXMPPClient>();
const messages = new Map<string, { originId: string, occupantId: string }>(); // twitch message id -> { origin id, occupant id }
const deleted = new Set<string>();
const auth = new TwitchAuthenticator(DATA_DIR);
const swappable = new SwappableDoubleClient({ channels: [config.twitchChannel] });

swappable.onSwap((chatClient, apiClient) => {
	const bttvEmotes: { code: string, id: string }[] = [];
	apiClient?.getTokenInfo().then(info => {
		if (info.userId && info.userName)
			botUser = { id: info.userId, name: info.userName };
		console.log("Twitch is logged in as " + info.userName);

		if (info.userId)
			apiClient?.chat.getColorForUser(info.userId).then(color => {
				if (color) currentColor = color as HelixChatUserColor;
				else currentColor = undefined;
			});


		apiClient?.users.getUserByName(config.twitchChannel).then(async user => {
			if (!user?.id) return;
			// BTTV emotes
			const bttvData = (await fetch("https://api.betterttv.net/3/cached/users/twitch/" + user.id).then(res => res.json()));
			bttvData.channelEmotes.forEach((emote: { code: string, id: string }) => {
				bttvEmotes.push({ code: emote.code, id: emote.id });
			});
			bttvData.sharedEmotes.forEach((emote: { code: string, id: string }) => {
				bttvEmotes.push({ code: emote.code, id: emote.id });
			});

			let tier: number;
			if (info.userId) {
				const subbed = await apiClient.subscriptions.checkUserSubscription(info.userId, user.id);
				tier = parseInt(subbed?.tier || "0");
			}

			const channelEmotes = await apiClient.chat.getChannelEmotes(user.id);
			const globalEmotes = await apiClient.chat.getGlobalEmotes();
			emoteTranslator.updateTwitch(globalEmotes.map(emote => emote.name)
				.concat(channelEmotes.filter(emote => !emote.tier || parseInt(emote.tier) <= tier).map(emote => emote.name))
				.concat(bttvEmotes.map(emote => emote.code)));
		});
	}).catch(console.error);

	chatClient.onMessage(async (_channel, user, text, message) => {
		if (user == botUser?.name) return;

		const emotes: { start: number, end: number, name: string }[] = [];
		for (const positions of message.emoteOffsets.values()) {
			let replaced: string | undefined;
			for (const position of positions) {
				const [start, end] = position.split("-").map(pos => parseInt(pos));
				if (replaced === undefined)
					replaced = emoteTranslator.findPeertube(text.slice(start, end + 1));
				if (!replaced) break;
				emotes.push({ start, end, name: replaced });
			}
		}
		bttvEmotes.forEach(emote => {
			let index = text.indexOf(emote.code);
			if (index >= 0) {
				const replaced = emoteTranslator.findPeertube(emote.code);
				if (!replaced) return;
				while (index >= 0) {
					emotes.push({ start: index, end: index + emote.code.length - 1, name: replaced });
					index = text.indexOf(emote.code, index + emote.code.length);
				}
			}
		});
		for (const emote of emotes.sort((a, b) => b.start - a.start)) {
			text = text.slice(0, emote.start) + emote.name + text.slice(emote.end + 1);
		}

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
			if (!deleted.has(message.id)) {
				const response = await xmpp.message(text);
				messages.set(message.id, { originId: response.originId, occupantId: response.authorId });
			} else deleted.delete(message.id);
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
		} else deleted.add(id);
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