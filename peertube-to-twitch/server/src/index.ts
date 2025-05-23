import "dotenv/config";
import { Message, PeerTubeXMPPClient } from "peertube-livechat-xmpp";
import { WebSocketServer } from "ws";

let port = parseInt(process.env.PORT || "8180");
if (isNaN(port)) port = 8180;

const wsKeepAlive = parseInt(process.env.WS_KEEP_ALIVE || "0");

const xmppClients = new Map<string, { connected: number, client: PeerTubeXMPPClient, timeout?: NodeJS.Timeout }>(); // concat of instance and roomid -> client

const server = new WebSocketServer({ port });
server.on("connection", socket => {
	let tcpKeepAlive = setTimeout(() => {
		socket.close();
	}, 60000);

	let key: string | undefined;
	let xmpp: PeerTubeXMPPClient | undefined;

	const onReady = () => {
		socket.send("con");
	};

	const onOldMessage = (message: Message) => {
		const author = message.author();
		if (!author) return;
		socket.send(`old ${encodeURIComponent(author.occupantId)} ${encodeURIComponent(author.nickname)} ${encodeURIComponent(message.body)}`);
	};

	const onNewMessage = (message: Message) => {
		const author = message.author();
		if (!author) return;
		socket.send(`new ${encodeURIComponent(author.occupantId)} ${encodeURIComponent(author.nickname)} ${encodeURIComponent(message.body)}`);
	};

	const disconnect = () => {
		if (key && xmppClients.has(key)) {
			const immKey = key;
			const details = xmppClients.get(immKey)!;
			details.connected--;
			console.log(`Client disconnection for ${immKey}. Currently connected: ${details.connected}`);
			if (details.connected == 0 && !isNaN(wsKeepAlive) && wsKeepAlive > 0) {
				details.timeout = setTimeout(() => {
					xmppClients.delete(immKey);
				}, wsKeepAlive);
				console.log(`Scheduled deletion of ${immKey} in ${wsKeepAlive}`);
			}
		}
		xmpp?.removeListener("ready", onReady);
		xmpp?.removeListener("oldMessage", onOldMessage);
		xmpp?.removeListener("message", onNewMessage);
		xmpp = undefined;
		key = undefined;
	};

	socket.on("message", data => {
		const args = data.toString().split(/\s+/);
		const first = args.shift()!;
		switch (first) {
			case "ping": {
				tcpKeepAlive.refresh();
				socket.send("pong");
				break;
			}
			case "con": {
				if (args.length < 2) socket.send("err no-args");
				else {
					const [instance, roomId] = args;
					key = `${roomId}@${instance}`;
					// Obtain suitable XMPP client
					if (xmppClients.has(key)) {
						const details = xmppClients.get(key)!;
						details.connected++;
						if (details.timeout) {
							clearTimeout(details.timeout);
							details.timeout = undefined;
						}
						xmpp = details.client;
						console.log(`New client connected to ${key}. Currently connected: ${details.connected}`);
					} else {
						xmpp = new PeerTubeXMPPClient(instance, roomId, { nickname: "Twitch Bridge #" + Math.ceil(Math.random() * 20) });
						xmppClients.set(key, { connected: 1, client: xmpp });
						console.log(`Opened new connection to ${key}`);
					}
					// Setup events to redirect to WS
					xmpp.on("ready", onReady);
					xmpp.on("oldMessage", onOldMessage);
					xmpp.on("message", onNewMessage);
				}
				break;
			}
			case "dis": {
				disconnect();
				socket.send("dis");
				break;
			}
		}
	});

	socket.on("close", () => {
		disconnect();
	});
});

console.log("Started websocket server at port " + port);