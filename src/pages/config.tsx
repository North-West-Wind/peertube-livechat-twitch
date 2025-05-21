import "../styles/config.css";
import { useEffect, useState } from "preact/hooks";

export default function ConfigPage() {
	const [instance, setInstance] = useState("");
	const [roomId, setRoomId] = useState("");
	const [saved, setSaved] = useState(false);

	const loadConfig = () => {
		if (Twitch.ext.configuration.broadcaster) {
			try {
				const config = JSON.parse(Twitch.ext.configuration.broadcaster.content);
				// Checking the content is an object
				if (typeof config === 'object' && typeof config.instance == "string" && typeof config.roomId == "string") {
					setInstance(config.instance);
					setRoomId(config.roomId);
				} else
					console.log("Invalid config");
			} catch (err) {
				console.log("Invalid config");
			}
		}
	};

	useEffect(() => {
		loadConfig();
		Twitch.ext.configuration.onChanged(() => loadConfig());
	}, []);

	const save = () => {
		Twitch.ext.configuration.set("broadcaster", "", JSON.stringify({ instance, roomId }));
		setSaved(true);
		setTimeout(() => {
			setSaved(false);
		}, 3000);
	};

	return <div class="config">
		<h1>PeerTube Bridge Config</h1>
		<div class="field-title">
			<h2>PeerTube Instance</h2>
			<p>The instance's URL where the chat room is hosted</p>
		</div>
		<input type="text" value={instance} onChange={ev => setInstance(ev.currentTarget.value)} />
		<div class="field-title">
			<h2>Chat Room ID</h2>
			<p>The PeerTube chat room to connect to</p>
		</div>
		<input type="text" value={roomId} onChange={ev => setRoomId(ev.currentTarget.value)} />
		<br />
		<div class="save" onClick={save}>{saved ? "Saved!" : "Save"}</div>
	</div>;
}