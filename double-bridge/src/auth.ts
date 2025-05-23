import { StaticAuthProvider } from "@twurple/auth";
import EventEmitter from "events";
import { existsSync, readFileSync, writeFileSync } from "fs";
import * as path from "path";

const CLIENT_ID = "7cr1n72yd5xaxd8y86g8bd60petwhc";
const SCOPES = ["user:read:chat", "chat:read", "chat:edit", "channel:bot", "user:manage:chat_color"];

type AuthData = {
	aToken: string;
	rToken: string;
	tokenType: string;
	expiresAt: number;
}

export interface TwitchAuthenticator {
	on(event: "refresh", listener: (authProvider?: StaticAuthProvider) => void): this;
}

export class TwitchAuthenticator extends EventEmitter {
	readonly authFile: string;
	auth?: AuthData;

	constructor(dataDir: string) {
		super();
		this.authFile = path.join(dataDir, "auth.json");
		if (existsSync(this.authFile)) {
			try {
				this.auth = JSON.parse(readFileSync(this.authFile, "utf8")) as AuthData;
			} catch (err) {
				console.error(err);
			}
		}
	}

	private async askLogin() {
		let params = new URLSearchParams({
			client_id: CLIENT_ID,
			scopes: SCOPES.join(" ")
		});

		let res = await fetch("https://id.twitch.tv/oauth2/device?" + params, { method: "POST" });
		if (!res.ok) throw new Error("Start Device Code Flow failed. " + res.status);
		const { device_code: device, user_code: code, verification_uri: uri, expires_in: expireSecond } = await res.json();
		const timesUp = Date.now() + expireSecond * 1000;

		console.log("Login by following these steps:");
		console.log("1. Go to this link: " + uri);
		console.log("2. Enter this code if not automatically filled: " + code);
		console.log("3. Authorize the login");

		params.append("device_code", device);
		params.append("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
		
		while (true) {
			if (Date.now() > timesUp) throw new Error("No authorization in time");
			
			console.log("Checking if authorized...");
			res = await fetch("https://id.twitch.tv/oauth2/token?" + params, { method: "POST" });
			const result = await res.json();
			if (result.message == "authorization_pending")
				await this.sleep(10000);
			else if (result.access_token) {
				this.auth = {
					aToken: result.access_token,
					rToken: result.refresh_token,
					tokenType: result.token_type,
					expiresAt: Date.now() + result.expires_in * 1000
				};
				// Try to refresh before expiration
				this.autoRefresh(result.expires_in * 900);
				this.saveToFile();
				console.log("Obtained authorization!");
				break;
			} else if (result.message) throw new Error(result.message);
			else throw new Error("Authorization failed");
		}
	}

	private async tryRefresh() {
		// Falls back to login
		if (!this.auth) return await this.askLogin();

		const params = new URLSearchParams({
			client_id: CLIENT_ID,
			grant_type: "refresh_token",
			refresh_token: this.auth.rToken
		});

		const res = await fetch("https://id.twitch.tv/oauth2/token?" + params, { method: "POST" });
		if (!res.ok) throw new Error("Token refreshing failed. " + res.status);
		const result = await res.json();
		if (result.status && result.message) throw new Error(result.status + " " + result.message);

		this.auth = {
			aToken: result.access_token,
			rToken: result.refresh_token,
			tokenType: result.token_type,
			expiresAt: Date.now() + result.expires_in * 1000
		};
		// Try to refresh before expiration
		this.autoRefresh(result.expires_in * 900);
		this.saveToFile();
	}

	private autoRefresh(delay: number) {
		setTimeout(async () => {
			await this.tryRefresh();
			this.emit("refresh", this.auth?.aToken ?  new StaticAuthProvider(CLIENT_ID, this.auth.aToken, SCOPES) : undefined);
		}, delay);
	}

	async getAuthProvider() {
		if (!this.auth) await this.askLogin();
		else if (Date.now() > this.auth.expiresAt) await this.tryRefresh();

		return new StaticAuthProvider(CLIENT_ID, this.auth!.aToken, SCOPES);
	}

	private sleep(ms: number) {
		return new Promise<void>((res, rej) => {
			process.once("SIGTERM", () => rej("Terminated by user"));
			process.once("SIGINT", () => rej("Interrupted by user"));
			setTimeout(res, ms);
		});
	}

	private saveToFile() {
		if (!this.auth) return;
		console.log("Saving auth to file...");
		writeFileSync(this.authFile, JSON.stringify(this.auth));
	}
}