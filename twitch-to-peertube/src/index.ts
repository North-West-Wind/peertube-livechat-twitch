import "dotenv/config";
import {  mkdirSync } from "fs";
import { PeerTubeXMPPClient } from "peertube-livechat-xmpp";
import { getConfig } from "./config";
import { SwappableChatClient } from "./chat";
import { TwitchAuthenticator } from "./auth";

const DATA_DIR = process.env.DATA_DIR || "data";
mkdirSync(DATA_DIR, { recursive: true });

const config = getConfig(DATA_DIR);
if (!config?.instance || !config.roomId || !config.twitchChannel)
	throw new Error(`No "instance", "roomId" or "twitchChannel" in ${DATA_DIR}/config.json`);

const xmppClients = new Map<string, PeerTubeXMPPClient>();
const messages = new Map<string, { originId: string, occupantId: string }>(); // twitch message id -> { origin id, occupant id }
const auth = new TwitchAuthenticator(DATA_DIR);
const swappable = new SwappableChatClient({ readOnly: true, channels: [config.twitchChannel] });

swappable.onSwap((chatClient) => {
	chatClient.onMessage(async (_channel, user, text, message) => {
		if (!xmppClients.has(user)) {
			const xmpp = new PeerTubeXMPPClient(config.instance, config.roomId, { nickname: message.userInfo.displayName });
			xmppClients.set(user, xmpp);
			await new Promise<void>(res => {
				xmpp.on("ready", () => res());
			});
		}
	
		const xmpp = xmppClients.get(user)!;
		const response = await xmpp.message(text);
		messages.set(message.id, { originId: response.originId, occupantId: response.authorId });
	});

	chatClient.onMessageRemove(async (_channel, id, _message) => {
		if (messages.has(id)) {
			const { originId, occupantId } = messages.get(id)!;
			const xmpp = xmppClients.get(occupantId);
			if (xmpp)
				await xmpp.delete(originId);

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