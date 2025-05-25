# PeerTube Bridge Extension
Despite the name, this is actually an extension for Twitch.

If you take a look at the other folders beside this one, you can see a lot of other bridge components. In particular, `double-bridge` bridges PeerTube messages using a chatbot, and it can be quite hard to distinguish which PeerTube user is chatting when they all come from the same account.

This extension automatically overwrites the username of the bot account with the PeerTube user if the message is sent in the format like this:
```
@{user} Hello!
```

The bot's username will be replaced by `{user}` and the first mention of `@{user}` will be removed.

## Configuration
You need to configure the bot's username the extension should look for. The name is case-insensitive.

## Building (Firefox)
To build this extension, you need Node.js installed. `cd` to this directory, and do the following:

Install the required packages:
```bash
npm i
```

Compile Typescript into Javascript:
```bash
npm run build
# same as running "npx tsc"
```

Package the files into XPI:
```bash
npm run package:firefox
# same as running:
# "cd firefox && mkdir -p build && zip -r -FS build/peertube-bridge.xpi * --exclude *.ts --exclude popup/*.ts"
```