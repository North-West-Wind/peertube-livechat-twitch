import { useEffect, useState } from 'preact/hooks';
import Message from './components/message';
import { PeerTubeXMPPClient } from 'peertube-livechat-xmpp';
import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { ApiClient } from '@twurple/api';

type ChatComponent = { type: "text" | "image", body: string };

export type Chat = {
	id: string,
	badges: string[];
	username: string;
	color: string;
	components: ChatComponent[];
};

type Config = {
	twitchChannel: string;
	twitchClientId: string;
	twitchClientSecret: string;
	peertubeInstance: string;
	peertubeRoom: string;
	ignoredTwitchUsers?: string[];
	ignoredPeertubePattern?: string;
};

// These are Twitch colors
// They should in theory work great with either light or dark background
const AVAILABLE_COLORS = [
	"#ff0000",
	"#0000ff",
	"#008000",
	"#b22222",
	"#ff7f50",
	"#9acd32",
	"#ff4500",
	"#2e8b57",
	"#daa520",
	"#d2691e",
	"#5f9ea0",
	"#1e90ff",
	"#ff69b4",
	"#8a2be2",
	"#00ff7f"
];

export function App() {
	const [messages, setMessages] = useState<Chat[]>([]);

	useEffect(() => {
		fetch("/config.json").then(async res => {
			const fail = () => {
				setMessages([{ id: "", badges: [], username: "system", color: "#777", components: [{ type: "text", body: "Failed to read config" }] }]);
			};
			if (!res.ok) return fail();
			try {
				const config = await res.json() as Config;
				if (!config) return fail();
				if (!config.twitchChannel || !config.twitchClientId || !config.twitchClientSecret || !config.peertubeInstance || !config.peertubeRoom) {
					setMessages([{ id: "", badges: [], username: "system", color: "#777", components: [{ type: "text", body: "Config is invalid" }] }]);
					return;
				}
				// PeerTube setup
				const peertubeColor = new Map<string, string>(); // occupant id -> color
				const peertubeRegex = config.ignoredPeertubePattern ? new RegExp(config.ignoredPeertubePattern) : undefined;
				const xmpp = new PeerTubeXMPPClient(config.peertubeInstance, config.peertubeRoom, { nickname: "Merged Chat" });
				xmpp.on("message", message => {
					const author = message.author();
					if (!author || peertubeRegex?.test(author.nickname)) return;
					let color = peertubeColor.get(author.occupantId);
					if (!color) {
						color = AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)];
						peertubeColor.set(author.occupantId, color);
					}
					let body = message.body;
					const components: ChatComponent[] = [];
					let foundEmoji = Array.from(xmpp.customEmojis.keys())
						.map(short => ({ index: body.indexOf(short), short }))
						.filter(({ index }) => index >= 0)
						.sort((a, b) => a.index - b.index)[0];
					const shortCodes = new Set<string>();
					while (foundEmoji) {
						const before = body.slice(0, foundEmoji.index);
						body = body.slice(foundEmoji.index + foundEmoji.short.length);
						components.push({ type: "text", body: before }, { type: "image", body: xmpp.customEmojis.get(foundEmoji.short)! });
						shortCodes.add(foundEmoji.short);
						foundEmoji = Array.from(xmpp.customEmojis.keys())
							.map(short => ({ index: body.indexOf(short), short }))
							.filter(({ index }) => index >= 0)
							.sort((a, b) => a.index - b.index)[0];
					}
					components.push({ type: "text", body });
					setMessages(messages => {
						return messages.concat([{
							id: message.id,
							badges: ["https://joinpeertube.org/img/icons/favicon.png"],
							username: author.nickname,
							color,
							components
						}]);
					});
				});
				// Twitch setup
				const authProvider = new RefreshingAuthProvider({ clientId: config.twitchClientId, clientSecret: config.twitchClientSecret });
				authProvider.onRefresh((_userId, tokenData) => fetch("/api/token", { method: "POST", body: JSON.stringify(tokenData), headers: { "Content-Type": "application/json" } }));
				fetch("/token.json").then(async res => {
					if (res.ok) {
						const id = await authProvider.addUserForToken(await res.json(), ["chat"]);

						// BTTV emotes
						const bttvEmotes: { code: string, id: string }[] = [];
						const bttvData = (await fetch("https://api.betterttv.net/3/cached/users/twitch/" + id).then(res => res.json()));
						bttvData.channelEmotes.forEach((emote: { code: string, id: string }) => {
							bttvEmotes.push({ code: emote.code, id: emote.id });
						});
						bttvData.sharedEmotes.forEach((emote: { code: string, id: string }) => {
							bttvEmotes.push({ code: emote.code, id: emote.id });
						});

						const api = new ApiClient({ authProvider });
						const globalBadges = await api.chat.getGlobalBadges();
						const channelBadges = await api.chat.getChannelBadges(id);
						const twitch = new ChatClient({ authProvider, channels: [config.twitchChannel], readOnly: true });
						const twitchColors = new Map<string, string>();
						twitch.onMessage((_channel, user, text, msg) => {
							if (config.ignoredTwitchUsers?.includes(user)) return;
							const badges = ["https://assets.twitch.tv/assets/favicon-32-e29e246c157142c94346.png"];
							for (const [badge, version] of msg.userInfo.badges.entries()) {
								let found = globalBadges.find(set => set.id == badge)?.getVersion(version)?.getImageUrl(4);
								if (found) badges.push(found);
								else {
									found = channelBadges.find(set => set.id == badge)?.getVersion(version)?.getImageUrl(4);
									if (found) badges.push(found);
								}
							}
							let color = msg.userInfo.color;
							if (!color) {
								color = twitchColors.get(msg.userInfo.userId);
								if (!color) {
									color = AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)];
									twitchColors.set(msg.userInfo.userId, color);
								}
							}
							const emotes: { start: number, end: number, id: string, type: "twitch" | "bttv" }[] = [];
							msg.emoteOffsets.forEach((poses, id) => {
								poses.forEach(pos => {
									const [start, end] = pos.split("-").map(pos => parseInt(pos));
									const emote: { start: number, end: number, id: string, type: "twitch" | "bttv" } = { start, end, id, type: "twitch" };
									if (!emotes.length) emotes.push(emote);
									else {
										let broke = false;
										for (let ii = 0; ii < emotes.length; ii++) {
											if (emotes[ii].start < start) continue;
											emotes.splice(ii, 0, emote);
											broke = true;
											break;
										}
										if (!broke) emotes.unshift(emote);
									}
								});
							});
							bttvEmotes.forEach(emote => {
								let index = text.indexOf(emote.code);
								while (index >= 0) {
									emotes.push({ start: index, end: index + emote.code.length - 1, id: emote.id, type: "bttv" });
									index = text.indexOf(emote.code, index + emote.code.length);
								}
							});

							const components: ChatComponent[] = [];
							while (emotes.length) {
								const emote = emotes.shift()!;
								const trimmed = text.slice(emote.end + 1).trim();
								if (trimmed) components.unshift({ type: "text", body: trimmed });
								let url: string;
								if (emote.type == "twitch") url = `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/4.0`;
								else url = `https://cdn.betterttv.net/emote/${emote.id}/3x`;
								components.unshift({ type: "image", body: url });
								text = text.slice(0, emote.start);
							}
							components.unshift({ type: "text", body: text.trim() });

							setMessages(messages => messages.concat([{
								id: msg.id,
								badges,
								username: msg.userInfo.displayName,
								color,
								components
							}]));
						});
						twitch.onMessageRemove((_channel, msgId, _msg) => {
							setMessages(messages => {
								const newMessages: typeof messages = [];
								messages.forEach(message => {
									if (message.id == msgId) return;
									newMessages.push(message);
								});
								return newMessages;
							});
						});
						twitch.connect();
					}
				});
			} catch (err) {
				console.error(err);
				fail();
			}
		});
	}, []);

  return <>
		{messages.map((chat, ii) => <Message key={ii} chat={chat}/>)}
	</>;
}
