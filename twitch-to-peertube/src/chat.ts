import { ChatClient, ChatClientOptions } from "@twurple/chat";

export class SwappableChatClient {
	client: ChatClient;
	private _onSwap?: (client: ChatClient) => void;

	constructor(config?: ChatClientOptions) {
		this.client = new ChatClient(config);
	}

	connect() {
		this.client.connect();
	}

	updateConfig(config?: ChatClientOptions) {
		if (this.client.isConnected)
			this.client.quit();

		this.client = new ChatClient(config);
		if (this._onSwap)
			this._onSwap(this.client);
	}

	onSwap(func?: (client: ChatClient) => void) {
		this._onSwap = func;
	}
}