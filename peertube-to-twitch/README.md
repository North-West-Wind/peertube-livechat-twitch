# peertube-to-twitch
This is a Twitch extension that shows PeerTube chat on a Twitch stream as a component. If it is successfully reviewed and published, it will be named "PeerTube Bridge".

I may scrap this idea because Twitch is probably not too happy about bridging with PeerTube. In that case, use `double-bridge` instead.

## Configuration
This extension is meant to be used by the streamer. The streamer must configure the following (only) 2 options for it to work:
- Your PeerTube instance URL
- The PeerTube livechat room ID

Obtaining the instance URL is trivial, so I will not go thourgh that.

Obtaining the livechat room ID is quite simple but not obvious. Follow these steps:
1. Open your PeerTube stream in the browser
2. You should see chat either to the right or bottom of the video player
3. Click on the button with a square with an arrow pointing out (open chat in new window)
4. In the new tab, the URL should end with `?room=<bunch-of-letters-and-numbers>`
5. Copy that `<bunch-of-letters-and-numbers>`. That's your chat room ID 