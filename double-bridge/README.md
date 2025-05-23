# double-bridge
Bridges both ways: Twitch to PeerTube, PeerTube to Twitch

This is achieved by running a bot on Twitch and multiple anonymous XMPP clients for PeerTube.

## Usage
Currently, I only provide a single executable application (SEA) for Linux in [release](https://github.com/North-West-Wind/peertube-livechat-twitch/releases/latest). To use this on other OSes, see [Building](#building).

### Data Directory
By default, the program creates a `data/` directory at the current directory. You can change this path by specifying the `DATA_DIR` environment variable. For example:
```bash
DATA_DIR=$HOME/.config/peertube-bridge peertube-bridge
```

### Configuration
The program needs some configurations in order to run properly. You need to create `$DATA_DIR/config.json`:
```json
{
	"instance": "your.peertube.instance",
	"roomId": "livechat-room-id",
	"twitchChannel": "twitch-channel-name"
}
```

Obtaining the instance URL and Twitch channel name is trivial, so I will not go thourgh those.

Obtaining the livechat room ID is quite simple but not obvious. Follow these steps:
1. Open your PeerTube stream in the browser
2. You should see chat either to the right or bottom of the video player
3. Click on the button with a square with an arrow pointing out (open chat in new window)
4. In the new tab, the URL should end with `?room=<bunch-of-letters-and-numbers>`
5. Copy that `<bunch-of-letters-and-numbers>`. That's your chat room ID 

### Authorization
The program will automatically ask for authentication if no Twitch tokens are provided.
The console will print out a link to activate device on Twitch.
Simply authorize using that link.

After that, the program will run by itself.

## Building
You can build this program using Node.js (v20).

1. Clone the repository
2. `cd double-bridge` - Change the current directory
3. `npm i` - Install required packages
4. `npm test` - Runs the program