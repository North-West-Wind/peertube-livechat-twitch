import { AppTokenAuthProvider, RefreshingAuthProvider, StaticAuthProvider } from "@twurple/auth";
import pressAnyKey from "press-any-key";

const CLIENT_ID = "cn9f0aw2nr0uiq79ou5b29mtiajssr";

type AuthFile = {
	accessToken: string;
	refreshToken: string;
}

export class TwitchAuthenticator {
	auth?: {
		aToken: string;
		rToken: string;
		tokenType: string;
		expiresAt: number;
	};

	constructor(dataDir: string) {

	}

	private async askLogin() {
		let params = new URLSearchParams({
			client_id: CLIENT_ID,
			scopes: ["chat:read"].join(" ")
		});

		let res = await fetch("https://id.twitch.tv/oauth2/device?" + params);
		if (!res.ok) throw new Error("Start Device Code Flow failed. " + res.status);
		const { device_code: device, user_code: code, verification_uri: uri } = await res.json();

		console.log("Login by following these steps:");
		console.log("1. Go to this link: " + uri);
		console.log("2. Enter this code if not automatically filled: " + code);
		console.log("3. Authorize the login");
		await pressAnyKey("When you are done, press any key");

		params.append("device_code", device);
		params.append("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
		
		res = await fetch("https://id.twitch.tv/oauth2/token?" + params);
		if (!res.ok) throw new Error("Token obtainment failed. " + res.status);
		const result = await res.json();
		if (result.status && result.message) throw new Error(result.status + " " + result.message);

		this.auth = {
			aToken: result.access_token,
			rToken: result.refresh_token,
			tokenType: result.token_type,
			expiresAt: Date.now() + result.expires_in * 1000
		};
	}

	private async tryRefresh() {
		// Falls back to login
		if (!this.auth) return await this.askLogin();

		const params = new URLSearchParams({
			client_id: CLIENT_ID,
			grant_type: "refresh_token",
			refresh_token: this.auth.rToken
		});

		const res = await fetch("https://id.twitch.tv/oauth2/token?" + params);
		if (!res.ok) throw new Error("Token refreshing failed. " + res.status);
		const result = await res.json();
		if (result.status && result.message) throw new Error(result.status + " " + result.message);

		this.auth = {
			aToken: result.access_token,
			rToken: result.refresh_token,
			tokenType: result.token_type,
			expiresAt: Date.now() + result.expires_in * 1000
		};
	}

	async getAuthProvider() {
		if (!this.auth) await this.askLogin();
		else if (Date.now() > this.auth.expiresAt) await this.tryRefresh();

		return new StaticAuthProvider(CLIENT_ID, this.auth!.aToken, ["chat:read"]);
	}
}