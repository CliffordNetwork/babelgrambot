# Babelgram Bot
A Telegram bot using Google Translate API to facilitate comunication throught the Telegram inline interface.

### Usage
Write in any chat `@BabelgramBot <translate from language> <translate to language> <phrase to translate>` and wait for the inline translation to load. Then click on it and it will be sent as a message.

### Installation in development environment
Install the dependencies and devDependencies and start the server.

```sh
$ npm install -d
$ npm start
```

You will need to create a `.env` file with the environment variables BABELGRAM_TOKEN and GOOGLE_CLOUD_API_KEY. See below for further information about where to get this information.

### Deployment in Heroku

Deploy the app in Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

And set the environment variables BABELGRAM_TOKEN and GOOGLE_CLOUD_API_KEY.

### Environment variables
* **BABELGRAM_TOKEN**: Get this token from the @BotFather bot in Telegram when creating a new bot
* **GOOGLE_CLOUD_API_KEY**: Get this token from the Google Translate API