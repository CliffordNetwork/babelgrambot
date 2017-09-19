const TelegramBot = require('node-telegram-bot-api')
const request = require('request')

if(process.env.NODE_ENV != 'production'){
  require('dotenv').config();
}

const TOKEN = process.env.TOKEN || '';
const GOOGLE_CLOUD_API_KEY = process.env.GOOGLE_CLOUD_API_KEY || '';
const WEBHOOK_URL = process.env.APP_URL || '';

if(!TOKEN || !GOOGLE_CLOUD_API_KEY || !WEBHOOK_URL){
  throw new Error('Make sure you have TOKEN, GOOGLE_CLOUD_API_KEY, AND APP_URL set as environment variables')
}

function processHTMLEntityCodes(phrase){
  return phrase.replace(/&#(\d+);/g, function(m, p1){
    return String.fromCharCode(p1)
  })
}
function processTranslationAndAnswerInlineQuery(error, response, body, from, to, inline_query_id) {

  if(error) console.log('error:', error);
  // console.log('statusCode:', response && response.statusCode);
  if(response.statusCode != 200) return;
  
  const translationData = JSON.parse(body);
  const translatedPhrase = processHTMLEntityCodes(translationData.data.translations[0].translatedText);

  const inlineQueryResult = {
    type: 'article',
    id: '0',
    title: `Translation from ${from} to ${to}`,
    description: `${translatedPhrase}`,
    input_message_content: {
      message_text: `${translatedPhrase}`
    },
    thumb_url: 'http://dev.noware.ca/images/website/Articles/babel.png'
  }

  const inlineQueryResultArray = [];
  inlineQueryResultArray.push(inlineQueryResult);

  request({
    uri: `https://api.telegram.org/bot${TOKEN}/answerInlineQuery`,
    qs: {
      inline_query_id,
      results: JSON.stringify(inlineQueryResultArray),
      cache_time: 60
    }
  }, (error, response, body) => {
    if(error) console.log('error:', error);
    // console.log(body); 
  });
}

const options = {
  webHook: {
    port: process.env.PORT
  }
};

const bot = new TelegramBot(TOKEN, options);
bot.setWebHook(`${WEBHOOK_URL}/bot${TOKEN}`);

bot.on('inline_query', (query) => {
  
  const inline_query_id = query.id
  const queryText = query.query

  const splitQuery = queryText.split(' ');
  const fromTo = splitQuery.splice(0, 2);
  if(fromTo.length != 2) return;

  const from = fromTo[0];
  const to = fromTo[1];
  const phrase = splitQuery.join(' ');

  if(!to || !from || !phrase) return;

  request({
    uri: 'https://translation.googleapis.com/language/translate/v2',
    qs: {
      source: from,
      target: to,
      q: phrase,
      key: GOOGLE_CLOUD_API_KEY
    }
  }, (error, response, body) => {
    processTranslationAndAnswerInlineQuery(error, response, body, from, to, inline_query_id);
  });
});

bot.on('message', (message) => {
  if(message.text == '/start'){
    messageOptions = {
      parse_mode: 'markdown',
    }
    const startMessage = '*How to use BabelgramBot*\nThis is an inline bot so you can use it from any conversation.\n\nFor that, write in any chat box \'@BabelgramBot\' followed by the language you want to translate from, the language you want to translate to, and the text to translate.\n\nFor example: _\'@BabelgramBot en es Hello how are you\'_\n\nThis will try to translate "Hello" from English to Spanish.\n\nYou can find the code languages in https://cloud.google.com/translate/docs/languages\n\n*Note from the developer*\nThis bot is currently used a lot so the API costs are $15\/month. Now I\'m using my free credit from Google Cloud but the bot will be shutdown when this credit runs out. If you want to help me with the costs, contact @heyjon for donations'
    bot.sendMessage(message.from.id, startMessage, messageOptions)
  }
});

console.log('Babelgrambot started!');