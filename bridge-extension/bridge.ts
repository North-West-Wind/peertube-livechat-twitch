const log = (...data: any[]) => {
	console.log(`[PeerTube Bridge]`, ...data);
};

log("Hello from PeerTube Bridge!");

///@ts-ignore
let getting: Promise<{ botUsername?: string }> = browser.storage.local.get("botUsername");
getting.then(({ botUsername }) => {
	if (!botUsername) return;
	init(botUsername);
}).catch(console.error);

function init(botUsername: string) {
	log("We will be converting messages from " + botUsername);

	let found7TV = false;
	let foundTwitch = false;

	const waitFor7TV = () => new Promise<{ type: "7tv" | "twitch", element: Element }>(res => {
		const bodyObserver = new MutationObserver(() => {
			const sevenTvMain = document.querySelector("main.seventv-chat-list");
			if (sevenTvMain) {
				found7TV = true;
				bodyObserver.disconnect();
				res({ type: "7tv", element: sevenTvMain });
			}
		});
		bodyObserver.observe(document.body, { childList: true, subtree: true });
	});

	const waitForTwitch = () => new Promise<{ type: "7tv" | "twitch", element: Element }>(res => {
		const bodyObserver = new MutationObserver(() => {
			const twitchMain = document.querySelector("div.chat-scrollable-area__message-container");
			if (twitchMain) {
				foundTwitch = true;
				bodyObserver.disconnect();
				res({ type: "twitch", element: twitchMain });
			}
		});
		bodyObserver.observe(document.body, { childList: true, subtree: true });
	});

	const setup = (result: { type: "7tv" | "twitch", element: Element }) => {
		if (result.type == "7tv") log("Found 7TV chat!");
		else log("Found Twitch chat!");

		let usernameSelector: string;
		let bodySelector: string;
		let mentionClass: string;
		if (result.type == "7tv") {
			usernameSelector = "span.seventv-chat-user-username";
			bodySelector = "span.seventv-chat-message-body";
			mentionClass = "mention-token";
		} else {
			usernameSelector = "span.chat-line__username";
			bodySelector = "span[data-a-target=\"chat-line-message-body\"";
			mentionClass = "mention-fragment";
		}

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				mutation.addedNodes.forEach(node => {
					const element = node as Element;
					const username = element.querySelector(usernameSelector);
					const body = element.querySelector(bodySelector);
					log("username", username?.textContent, "bot", botUsername);
					if (!username || !body || username.textContent?.toLowerCase() != botUsername) return;
					const firstElementChild = body.firstElementChild;
					if (!firstElementChild?.classList.contains(mentionClass) || !firstElementChild.textContent?.startsWith("@")) return;
					const name = firstElementChild.textContent.slice(1);
					firstElementChild.remove();
					const nameSpan = username.firstElementChild?.firstElementChild || username.firstElementChild;
					if (!nameSpan) return;
					if (result.type == "7tv")
						(nameSpan as HTMLElement).style.color = window.getComputedStyle(nameSpan).color;
					(nameSpan as HTMLElement).innerText = name;
				});
			}
		});
		observer.observe(result.element, { childList: true });
	};

	waitFor7TV().then(setup).catch(console.error);
	waitForTwitch().then(setup).catch(console.error);

	const bodyObserver = new MutationObserver(() => {
		if (found7TV) {
			const sevenTvMain = document.querySelector("main.seventv-chat-list");
			if (!sevenTvMain)
				waitFor7TV().then(setup).catch(console.error);
		}
		if (foundTwitch) {
			const twitchMain = document.querySelector("div.chat-scrollable-area__message-container");
			if (!twitchMain)
				waitForTwitch().then(setup).catch(console.error);
		}
	});
	bodyObserver.observe(document.body, { childList: true, subtree: true });
}