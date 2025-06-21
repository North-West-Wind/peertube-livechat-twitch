import { snakecase } from "stringcase";

export default class EmoteTranslator {
	private peertube: string[] = [];
	private twitch: string[] = [];

	private peertubeWords: string[][] = [];
	private twitchWords: string[][] = [];

	updatePeertube(emotes: string[]) {
		this.peertube = emotes;
		this.peertubeWords = emotes.map(emote => snakecase(emote.replace(/\W/g, "")).split("_"));
	}

	updateTwitch(emotes: string[]) {
		this.twitch = emotes;
		this.twitchWords = emotes.map(emote => snakecase(emote.replace(/\W/g, "")).split("_"));
	}

	findPeertube(emote: string): string | undefined {
		return this.find(emote, this.peertube, this.peertubeWords);
	}

	findTwitch(emote: string): string | undefined {
		return this.find(emote, this.twitch, this.twitchWords);
	}

	private find(emote: string, list: string[], wordList: string[][]): string | undefined {
		if (!list.length) return undefined;

		// Direct match
		let found = list.includes(emote) ? emote : undefined;
		if (found) return found;

		// Word match
		const words = snakecase(emote.replace(/\W/g, "")).split("_");
		const scores = wordList.map((lWords, index) => {
			let score = 0;
			let iScore = 0;
			words.forEach(word => {
				lWords.forEach(lWord => {
					if (word == lWord) {
						score++;
						iScore++;
					} else if (word.toLowerCase() == lWord.toLowerCase()) {
						iScore++;
					}
				});
			});
			return { score, iScore, index };
		});
		let maxScore = scores.reduce((a, b) => a.score >= b.score ? a : b);
		if (maxScore.score != 0) return list[maxScore.index];
		else {
			maxScore = scores.reduce((a, b) => a.iScore >= b.iScore ? a : b);
			if (maxScore.iScore != 0) return list[maxScore.index];
		}

		return undefined;
	}
}