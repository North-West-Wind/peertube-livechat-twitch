import type { Chat } from "../app";
import Badge from "./badge";

export default function Message(props: { chat: Chat }) {
	return <div class="message">
		<div class="badges">
			{props.chat.badges.map(badge => <Badge src={badge} />)}
		</div>
		<div class="username" style={{ color: props.chat.color }}>{props.chat.username}</div>
		<div class="bodies">
			{props.chat.components.map(component => {
				if (component.type == "text")
					return component.body;
				else 
					return <div class="image"><img src={component.body} /></div>
			})}
		</div>
	</div>;
}