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

const HOST = "services.northwestw.in/peertube-to-twitch";
const WEBSOCKET_URL = `wss://${HOST}`;
const EMPTY_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

type ChatType = "system" | "user";
type AppendEventBodyComponent = { type: "span" | "img", body: string };
type AppendEventBody = {
	type: ChatType;
	components: AppendEventBodyComponent[];
	author?: { name: string, color: string };
}

export default function ChatPage() {
	const [bodies, setBodies] = useState<AppendEventBody[]>([]);
	const [imageCache, setImageCache] = useState<Record<string, string>>({}); // short name -> base64

	useEffect(() => {
		//let instance: string | undefined;
		//let roomId: string | undefined;
		// Testing
		let instance = "peertube.wtf";
		let roomId = "7f85efe2-07bb-4e93-9008-c6e20efbbf08";
		let socket: WebSocket | undefined;
		let emojis: string[] = [];

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
			if (type == "system")
				return setBodies(bodies => bodies.concat([{ type, components: [{ type: "span", body: message }] }]));
			const components: AppendEventBodyComponent[] = [];
			let firstMatch = Array.from(emojis.values())
				.map(short => ({ index: message.indexOf(short), short }))
				.filter(({ index }) => index >= 0)
				.sort((a, b) => a.index - b.index)[0];
			const shortCodes = new Set<string>();
			while (firstMatch) {
				const before = message.slice(0, firstMatch.index);
				message = message.slice(firstMatch.index + firstMatch.short.length);
				components.push({ type: "span", body: before }, { type: "img", body: firstMatch.short });
				shortCodes.add(firstMatch.short);
				firstMatch = emojis
					.map(short => ({ index: message.indexOf(short), short }))
					.filter(({ index }) => index >= 0)
					.sort((a, b) => a.index - b.index)[0];
			}
			shortCodes.forEach(short => {
				if (!imageCache[short])
					socket?.send("img " + short);
			});
			components.push({ type: "span", body: message });
			setBodies(bodies => bodies.concat([{ type, components, author }]));
		};
		
		const handleMessage = (occupantId: string, nickname: string, body: string) => {
			let color = colors.get(occupantId);
			if (!color) {
				color = AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)];
				colors.set(occupantId, color);
			}
			append("user", body, { name: nickname, color });
		};

		const connect = (retries = 0) => {
			socket = new WebSocket(WEBSOCKET_URL);
	
			let ping = setInterval(() => {
				socket?.send("ping");
			}, 40000);
	
			socket.onclose = () => {
				clearInterval(ping);
				retries++;
				const wait = Math.pow(2, retries);
				append("system", `Websocket disconnected! Reconnecting in ${wait} seconds...`);
				setTimeout(() => {
					connect(retries);
				}, wait * 1000);
			};
	
			let backfilling = false;
			socket.onmessage = (message) => {
				const args = (message.data as string).split(/\s+/);
				const first = args.shift()!;
				switch (first) {
					case "con": {
						append("system", `Connected to ${roomId}`);
						if (args.length >= 1) {
							emojis = [];
							try {
								emojis = JSON.parse(decodeURIComponent(args[0]));
							} catch (err) {
								console.error(err);
							}
						}
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
					case "img": {
						if (args.length < 2) break;
						const [short, data] = args;
						imageCache[short] = data;
						setImageCache({ ...imageCache });
						break;
					}
				}
			}

			socket.onopen = () => {
				retries = 0;
				if (instance && roomId)
					socket!.send(`con ${instance} ${roomId}`);
			};
		};

		connect();
	}, []);

	return <div class="chat">
		{bodies.map((body, ii) => {
			if (body.type == "system") return <div class="system" key={ii}>{body.components[0].body}</div>;
			const isMultiline = body.components.some(component => component.type == "span" && component.body.includes("\n"));
			if (isMultiline) {
				const lineComponents: AppendEventBodyComponent[][] = [[]];
				let index = 0;
				body.components.forEach(component => {
					if (component.type == "span") {
						const lines = component.body.split("\n");
						if (lines.length > 1) {
							lineComponents[index].push({ type: "span", body: lines.shift()! });
							lines.forEach(line => {
								lineComponents.push([{ type: "span", body: line }]);
								index++;
							});
						} else
							lineComponents[index].push(component);
					} else
						lineComponents[index].push(component);
				});
				// Multiline
				return <div class="user multiline" key={ii}>
					<div class="user">
						<div class="author" style={{ color: body.author!.color }}><div>{body.author!.name}</div></div>
						<div class="message hint">(multi-line)</div>
					</div>
					{lineComponents.map((components, ii) => <div class="message multiline" key={ii}>
						{components.map(({ type, body }, ii) => {
							if (type == "span")
								return <span key={ii}>{body}</span>
							return <img key={ii} src={imageCache[body] ?? EMPTY_IMAGE} />
						})}
					</div>)}
				</div>
			}
			return <div class="user" key={ii}>
				<div class="author" style={{ color: body.author!.color }}><div>{body.author!.name}</div></div>
				<div class="message">
					{body.components.map(({ type, body }, ii) => {
						if (type == "span")
							return <span key={ii}>{body}</span>
						return <img key={ii} src={imageCache[body] ?? EMPTY_IMAGE} />
					})}
				</div>
			</div>
		})}
	</div>;
}