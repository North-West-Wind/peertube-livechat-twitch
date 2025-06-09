import { useEffect, useState } from 'preact/hooks';
import Message from './components/message';
import { PeerTubeXMPPClient } from 'peertube-livechat-xmpp';
import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';

type ChatComponent = { type: "text" | "image", body: string };

export type Chat = {
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
	const [messages, setMessages] = useState<Chat[]>([
		{
			badges: ["https://assets.twitch.tv/assets/favicon-32-e29e246c157142c94346.png", "https://static-cdn.jtvnw.net/badges/v1/c249bc20-eb68-405a-8f6b-9f2832bc4964/3"],
			username: "northwestwindnww",
			color: "#ff0000",
			components: [
				{ type: "text", body: "test" },
				{ type: "image", body: "https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_faafc021d0d24c318e361859c84ad6e7/default/dark/4.0" },
				{ type: "text", body: "this is a really long message that i completely made up to solely test for text wrapping for long messages" }
			]
		},
		{
			badges: ["https://joinpeertube.org/img/icons/favicon.png"],
			username: "northwestwind",
			color: "#00ff00",
			components: [{ type: "text", body: "test peertube" }]
		}
	]);

	useEffect(() => {
		fetch("/config.json").then(async res => {
			const fail = () => {
				setMessages([{ badges: [], username: "system", color: "#777", components: [{ type: "text", body: "Failed to read config" }] }]);
			};
			if (!res.ok) return fail();
			try {
				const config = await res.json() as Config;
				if (!config) return fail();
				if (!config.twitchChannel || !config.twitchClientId || !config.twitchClientSecret || !config.peertubeInstance || !config.peertubeRoom) {
					setMessages([{ badges: [], username: "system", color: "#777", components: [{ type: "text", body: "Config is invalid" }] }]);
					return;
				}
				// PeerTube setup
				const peertubeColor = new Map<string, string>(); // occupant id -> color
				const xmpp = new PeerTubeXMPPClient(config.peertubeInstance, config.peertubeRoom, { nickname: "Merged Chat" });
				xmpp.on("message", message => {
					const author = message.author();
					if (!author) return;
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
					if (res.ok)
						authProvider.addUserForToken(await res.json());
				});
				const twitch = new ChatClient({ authProvider, channels: [config.twitchChannel], readOnly: true });
				twitch.onMessage((_channel, _user, _text, msg) => {
					console.log(msg.userInfo);
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
