import { Message, PeerTubeXMPPClient } from "peertube-livechat-xmpp";

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

type ChatType = "system" | "user";

export type AppendEventBody = {
	type: ChatType;
	message: string;
	author?: { name: string, color: string };
}

class ChatManager extends EventTarget {
	instance: string;
	roomId: string;
	xmpp?: PeerTubeXMPPClient;
	colors = new Map<string, string>(); // occupant id -> hex color
	backfilling = false;

	constructor() {
		super();
		this.instance = "";
		this.roomId = "";

		this.loadConfig();
		Twitch.ext.configuration.onChanged(() => this.loadConfig());
	}

	async loadConfig() {
		if (Twitch.ext.configuration.broadcaster) {
			try {
				const config = JSON.parse(Twitch.ext.configuration.broadcaster.content);
				// Checking the content is an object
				if (typeof config === 'object') {
					if (this.instance != config.instance || this.roomId != config.roomId) {
						// Ignore change from initial
						if (this.instance || this.roomId)
							this.append("system", "Configuration changed. Reconnecting...");
						this.instance = config.instance;
						this.roomId = config.roomId;

						await this.setupXmpp();
					}
				} else
					console.log("Invalid config");
			} catch (err) {
				console.log("Invalid config");
			}
		} else {
			// Local testing
			/*
			this.instance = "peertube.wtf";
			this.roomId = "7f85efe2-07bb-4e93-9008-c6e20efbbf08";
			await this.setupXmpp();
			*/
		}
	}

	async setupXmpp() {
		if (this.xmpp) await this.xmpp.stop();
		this.backfilling = false;
		this.colors.clear();
		this.xmpp = new PeerTubeXMPPClient(this.instance, this.roomId, { nickname: "Twitch Bridge " + Math.floor(Math.random() * 10000) });
	
		this.xmpp.on("ready", () => {
			chatManager.append("system", "Connected to " + this.roomId);
		});

		this.xmpp.on("oldMessage", (message) => {
			// Backfilling
			if (!this.backfilling) {
				this.backfilling = true;
				chatManager.append("system", "Backfilling...");
			}
			this.handleMessage(message);
		});
	
		this.xmpp.on("message", (message) => {
			// Stop backfilling
			if (this.backfilling) {
				this.backfilling = false;
				chatManager.append("system", "Backfilling completed");
			}
			this.handleMessage(message);
		});
	}

	private handleMessage(message: Message) {
		const author = message.author();
		if (!author) return;
		let color = this.colors.get(author.occupantId);
		if (!color) {
			color = AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)];
			this.colors.set(author.occupantId, color);
		}
		this.append("user", message.body, { name: author.nickname, color });
	}

	append(type: ChatType, message: string, author?: { name: string, color: string }) {
		this.dispatchEvent(new CustomEvent("append", { detail: { type, message, author } }));
	}
}

const chatManager = new ChatManager();
export default chatManager;