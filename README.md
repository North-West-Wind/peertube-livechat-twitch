# peertube-livechat-twitch
A way to bridge PeerTube and Twitch chats together!

This repository houses a few components in sub-directory in order to bridge PeerTube chat with Twitch chat. The components are:
- `double-bridge`: A Twitch bot that mirrors from and to PeerTube chat
- `peertube-to-twitch`: A Twitch extension that shows PeerTube chat on the Twitch platform
- `twitch-to-peertube`: A program that listens to Twitch chat messages and mirrors them to PeerTube
- `peertube-comment-livechat`: A program that listens to PeerTube comments and mirrors them to PeerTube livechat

To use a two-way bridge, you can use the combinations like this:
- Only `double-bridge`
- Both `peertube-to-twitch` and `twitch-to-peertube`