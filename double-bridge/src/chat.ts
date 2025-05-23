import { ApiClient } from "@twurple/api";
import { ChatClient, ChatClientOptions } from "@twurple/chat";

export class SwappableDoubleClient {
	apiClient?: ApiClient;
	chatClient: ChatClient;
	config?: ChatClientOptions;
	private _onSwap?: (client: ChatClient, api?: ApiClient) => void;

	constructor(config?: ChatClientOptions) {
		this.chatClient = new ChatClient(config);
		this.config = config;
	}

	connect() {
		this.chatClient.connect();
	}

	mergeConfig(config: ChatClientOptions) {
		if (this.config) this.config = Object.assign(this.config, config);
		else this.config = config;

		this.updateConfig(this.config);
	}

	updateConfig(config?: ChatClientOptions) {
		if (this.chatClient.isConnected)
			this.chatClient.quit();

		this.config = config;
		if (this.config?.authProvider)
			this.apiClient = new ApiClient({ authProvider: this.config.authProvider });
		else
			this.apiClient = undefined;
		this.chatClient = new ChatClient(config);
		if (this._onSwap)
			this._onSwap(this.chatClient, this.apiClient);
	}

	onSwap(func?: (client: ChatClient, api?: ApiClient) => void) {
		this._onSwap = func;
	}
}