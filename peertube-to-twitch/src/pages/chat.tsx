import "../styles/chat.css";
import { useEffect, useState } from "preact/hooks";

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

const WEBSOCKET_URL = "wss://services.northwestw.in/peertube-to-twitch";

type ChatType = "system" | "user";
type AppendEventBody = {
	type: ChatType;
	message: string;
	author?: { name: string, color: string };
}

export default function ChatPage() {
	const [bodies, setBodies] = useState<AppendEventBody[]>([]);

	useEffect(() => {
		let instance: string | undefined;
		let roomId: string | undefined;
		// Testing
		//let instance = "peertube.wtf";
		//let roomId = "7f85efe2-07bb-4e93-9008-c6e20efbbf08";
		let socket: WebSocket | undefined;

		const loadConfig = () => {
			if (Twitch.ext.configuration.broadcaster) {
				console.log(Twitch.ext.configuration.broadcaster);
				try {
					const config = JSON.parse(Twitch.ext.configuration.broadcaster.content);
					// Checking the content is an object
					if (typeof config === 'object' && typeof config.instance === "string" && typeof config.roomId === "string") {
						instance = config.instance;
						roomId = config.roomId;
						console.log("Loaded config");
						socket?.send(`con ${config.instance} ${config.roomId}`);
					}
					else
						console.log("Invalid config");
				} catch (err) {
					console.log("Invalid config with error");
					console.error(err);
				}
			} else {
				console.log("Empty config");
			}
		};

		loadConfig();
		Twitch.ext.configuration.onChanged(loadConfig);

		const colors = new Map<string, string>(); // occupant id -> hex color
		const append = (type: ChatType, message: string, author?: { name: string, color: string }) => {
			setBodies(bodies => bodies.concat([{ type, message, author }]));
		};
		
		const handleMessage = (occupantId: string, nickname: string, body: string) => {
			let color = colors.get(occupantId);
			if (!color) {
				color = AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)];
				colors.set(occupantId, color);
			}
			append("user", body, { name: nickname, color });
		};

		const connect = () => {
			socket = new WebSocket(WEBSOCKET_URL);
	
			let ping = setInterval(() => {
				socket?.send("ping");
			}, 40000);
	
			socket.onclose = () => {
				clearInterval(ping);
				append("system", "Websocket disconnected! Reconnecting...");
				socket = new WebSocket(WEBSOCKET_URL);
			};
	
			let backfilling = false;
			socket.onmessage = (message) => {
				const args = (message.data as string).split(/\s+/);
				const first = args.shift()!;
				switch (first) {
					case "con": {
						append("system", `Connected to ${roomId}`);
						break;
					}
					case "old": {
						if (args.length < 2) break;
						const [occupantId, nickname, body] = args.map(encoded => decodeURIComponent(encoded));
						// Backfilling
						if (!backfilling) {
							backfilling = true;
							append("system", "Backfilling...");
						}
						handleMessage(occupantId, nickname, body);
						break;
					}
					case "new": {
						if (args.length < 2) break;
						const [occupantId, nickname, body] = args.map(encoded => decodeURIComponent(encoded));
						// Stop backfilling
						if (backfilling) {
							backfilling = false;
							append("system", "Backfilling completed");
						}
						handleMessage(occupantId, nickname, body);
						break;
					}
				}
			}

			socket.onopen = () => {
				if (instance && roomId)
					socket!.send(`con ${instance} ${roomId}`);
			};
		};

		connect();
	}, []);

	return <div class="chat">
		{bodies.map((body, ii) => {
			if (body.type == "system") return <div class="system" key={ii}>{body.message}</div>;
			const lines = body.message.split("\n");
			if (lines.length > 1) {
				// Multiline
				return <div class="user multiline" key={ii}>
					<div class="user">
						<div class="author" style={{ color: body.author!.color }}>{body.author!.name}</div>
						<div class="message hint">(multi-line)</div>
					</div>
					{lines.map((line, ii) => <div class="message multiline" key={ii}>{line}</div>)}
				</div>
			}
			return <div class="user" key={ii}>
				<div class="author" style={{ color: body.author!.color }}>{body.author!.name}</div>
				<div class="message">{body.message}</div>
			</div>
		})}
	</div>;
}