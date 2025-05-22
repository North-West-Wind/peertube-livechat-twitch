import { ChatClient, ChatClientOptions } from "@twurple/chat";

export class SwappableChatClient {
	client: ChatClient;
	config?: ChatClientOptions;
	private _onSwap?: (client: ChatClient) => void;

	constructor(config?: ChatClientOptions) {
		this.client = new ChatClient(config);
		this.config = config;
	}

	connect() {
		this.client.connect();
	}

	mergeConfig(config: ChatClientOptions) {
		if (this.config) this.config = Object.assign(this.config, config);
		else this.config = config;

		this.updateConfig(this.config);
	}

	updateConfig(config?: ChatClientOptions) {
		if (this.client.isConnected)
			this.client.quit();

		this.config = config;
		this.client = new ChatClient(config);
		if (this._onSwap)
			this._onSwap(this.client);
	}

	onSwap(func?: (client: ChatClient) => void) {
		this._onSwap = func;
	}
}