const button = document.getElementById("save")!;
const input = document.getElementById("username") as HTMLInputElement;

button.onclick = () => {
	///@ts-ignore
	let setting: Promise<void> = browser.storage.local.set({
		botUsername: input.value
	});
	setting.then(() => {
		button.innerHTML = "Saved!";
		setTimeout(() => button.innerHTML = "Save", 3000);
	}).catch(err => {
		console.error(err);
		button.innerHTML = "Error!";
		setTimeout(() => button.innerHTML = "Save", 3000);
	});
};

document.addEventListener("DOMContentLoaded", () => {
	///@ts-ignore
  let getting: Promise<{ botUsername?: string }> = browser.storage.local.get("botUsername");
	getting.then(({ botUsername }) => {
		input.value = botUsername || "";
	}).catch(console.error);
});