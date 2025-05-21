import { existsSync, readFileSync } from "fs";
import * as path from "path";

type Config = {
	instance: string;
	roomId: string;
}

export function getConfig(dataDir: string) {
	const configPath = path.join(dataDir, "config.json");
	if (!existsSync(configPath)) return undefined;
	try {
		return JSON.parse(readFileSync(configPath, "utf8")) as Config;
	} catch (err) {
		return undefined;
	}
}