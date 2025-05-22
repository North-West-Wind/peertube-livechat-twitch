import "../styles/chat.css";
import { useEffect, useState } from "preact/hooks";
import chatManager, { type AppendEventBody } from "../shared/chat";

export default function ChatPage() {
	const [bodies, setBodies] = useState<AppendEventBody[]>([]);

	useEffect(() => {
		const onAppend = (ev: CustomEventInit<AppendEventBody>) => {
			if (ev.detail)
				setBodies(bodies => bodies.concat([ev.detail!]));
		}

		chatManager.addEventListener("append", onAppend);
		return () => chatManager.removeEventListener("append", onAppend);
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