# bric-a-brac

## Overview

![a screenshot of bric-a-brac](/screenshot.png)


bric a brac is a 2 player variant of the atari classic breakout built using [Hathora](https://hathora.dev/).

## Running locally 

To run locally:
- Have node installed
- Get a Hathora `appId` and `appSecret` via https://console.hathora.dev/
- Get a Hathora developer token (see https://hathora.dev/docs/guides/generate-developer-token)
- Create a .env file at the root with
```
HATHORA_APP_ID=<appId>
HATHORA_APP_SECRET=<appSecret>
DEVELOPER_TOKEN=<appToken>
```
- Start server: inside `server` directory run `npm start` (remember to `npm install` first)
- Start client: inside `client` directory run `npm start` (remember to `npm install` first)

## Deploying

Server:
- Run `hathora-cloud deploy --appId <appId> --roomsPerProcess 1 --planName tiny --transportType tls --containerPort 4000 --env '[{"name": "DEVELOPER_TOKEN", "value": "<appToken>"}]'`

Client:
- cd to `common` and run `npm install && npx tsc`
- Then cd to `client` and `npm run build`
- Now you can deploy `dist` to any CDN like Vercel or Netlify
