import express from "express";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "dist")));

app.get("/", (_req, res) => {
	res.send("index.html");
});

app.get("/api", (_req, res) => {
	res.sendStatus(200);
});

app.get("/api/auth", async (req, res) => {
	if (req.query.error) {
		res.send(req.query.error_description);
		return;
	} else if (req.query.code) {
		const config = JSON.parse(readFileSync(path.join(__dirname, "public/config.json"), "utf8"));
		if (!config.twitchClientId || !config.twitchClientSecret) {
			res.sendStatus(500);
			return;
		}
		const params = new URLSearchParams({
			client_id: config.twitchClientId,
			client_secret: config.twitchClientSecret,
			code: req.query.code as string,
			grant_type: "authorization_code",
			redirect_uri: "https://localhost:3030/api/auth"
		});
		const response = await fetch("https://id.twitch.tv/oauth2/token?" + params, { method: "POST" });
		const data = await response.json();
		writeFileSync(path.join(__dirname, "public/token.json"), JSON.stringify({
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresIn: data.expires_in,
			obtainmentTimestamp: Date.now()
		}, null, 2));
		res.send("Written to token.json");
	} else {
		const config = JSON.parse(readFileSync(path.join(__dirname, "public/config.json"), "utf8"));
		if (!config.twitchClientId) {
			res.sendStatus(500);
			return;
		}
		const params = new URLSearchParams({
			response_type: "code",
			client_id: config.twitchClientId,
			redirect_uri: "https://localhost:3030/api/auth",
			scope: "user:read:chat chat:read"
		});
		res.redirect("https://id.twitch.tv/oauth2/authorize?" + params);
	}
});

app.post("/api/token", express.json(), (req, res) => {
	if (!req.body) { 
		res.sendStatus(400);
		return;
	}
	writeFileSync(path.join(__dirname, "public/token.json"), JSON.stringify(req.body, null, 2));
	res.sendStatus(200);
});

app.listen(3030, () => console.log("Listening..."));