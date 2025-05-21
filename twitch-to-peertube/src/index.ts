import "dotenv/config";
import {  mkdirSync } from "fs";
import { PeerTubeXMPPClient } from "peertube-livechat-xmpp";
import { getConfig } from "./config";
import { SwappableChatClient } from "./chat";
import { TwitchAuthenticator } from "./auth";

const DATA_DIR = process.env.DATA_DIR || "data";
mkdirSync(DATA_DIR, { recursive: true });

const config = getConfig(DATA_DIR);
if (!config?.instance || !config.roomId) throw new Error(`No "instance" or "roomId" in ${DATA_DIR}/config.json`);

const xmppClients = new Map<string, PeerTubeXMPPClient>();
const auth = new TwitchAuthenticator(DATA_DIR);
const swappable = new SwappableChatClient();

swappable.onSwap((chatClient) => {
	chatClient.onMessage(async (channel, user, text, message) => {
		if (!xmppClients.has(user)) {
			const xmpp = new PeerTubeXMPPClient(config.instance, config.roomId, { nickname: user });
			xmppClients.set(user, xmpp);
			await new Promise<void>(res => {
				xmpp.on("ready", () => res());
			});
		}
	
		const xmpp = xmppClients.get(user)!;
		await xmpp.message(text);
	});
	
	chatClient.onDisconnect(() => {
		auth.getAuthProvider().then(authProvider => swappable.updateConfig({ authProvider }));
	});

	swappable.connect();
});

auth.getAuthProvider().then(authProvider => swappable.updateConfig({ authProvider }));