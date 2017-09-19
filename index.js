const TelegramBot = require('node-telegram-bot-api')
const request = require('request')
const { Client } = require('pg')

if(process.env.NODE_ENV != 'production'){
  require('dotenv').config();
}

const TOKEN = process.env.TOKEN || '';
const GOOGLE_CLOUD_API_KEY = process.env.GOOGLE_CLOUD_API_KEY || '';
const WEBHOOK_URL = process.env.APP_URL || '';
const DATABASE_URL = process.env.DATABASE_URL || ''

if(!TOKEN || !GOOGLE_CLOUD_API_KEY || !WEBHOOK_URL || !DATABASE_URL){
  throw new Error('Make sure you have TOKEN, GOOGLE_CLOUD_API_KEY, DATABASE_URL, AND APP_URL set as environment variables')
}

function processHTMLEntityCodes(phrase){
  return phrase.replace(/&#(\d+);/g, function(m, p1){
    return String.fromCharCode(p1)
  })
}

function translate(fromLanguageCode, toLanguageCode, phrase, chatId, callback){
  request({
    uri: 'https://translation.googleapis.com/language/translate/v2',
    qs: {
      source: fromLanguageCode,
      target: toLanguageCode,
      q: phrase,
      key: GOOGLE_CLOUD_API_KEY
    }
  }, (error, response, body) => {
    if(error) console.log('error:', error);
    // console.log('statusCode:', response && response.statusCode);
    if(response.statusCode != 200) return;
    const translationData = JSON.parse(body);
    const translatedPhrase = processHTMLEntityCodes(translationData.data.translations[0].translatedText);
    callback(chatId, fromLanguageCode, toLanguageCode, translatedPhrase)
  });
}

function processTranslationAndAnswerInlineQuery(inline_query_id, from, to, translatedPhrase) {
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
function saveIntoDB(groupId, userId, userName, firstName, lastName, fromLanguageCode, toLanguageCode, sucesssOnSaveCallback){
  const selectQuery = 'DELETE FROM autotranslate WHERE groupId=$1 and userId=$2'
  const selectValues = [groupId, userId]
  const insertQuery = 'INSERT INTO autotranslate(groupId, userId, userName, firstName, lastName, fromLanguageCode, toLanguageCode) VALUES($1, $2, $3, $4, $5, $6, $7)'
  const insertValues = [groupId, userId, userName, firstName, lastName, fromLanguageCode, toLanguageCode]
  
  db.get(userId).query(selectQuery, selectValues, (err, res) => {
    if(err){ console.log(err); return}
    console.log(res)
    db.get(userId).query(insertQuery, insertValues, (err, res) => {
      if(err){ console.log(err); return}
      console.log(res)
      sucesssOnSaveCallback()
    })
  })
}
function checkIfAutoTranslate(message){
  const messageId = message.message_id
  const groupId = message.chat.id
  const userId = message.from.id
  const text = message.text
  const selectQuery = 'SELECT * FROM autotranslate WHERE groupId=$1 and userId=$2'
  const selectValues = [groupId, userId]

  db.get(userId).query(selectQuery, selectValues, (err, res) => {
    if(err){ console.log(err); return}
    if (res.rowCount == 1){
      const replyWithTranslation = function(chatId, from, to, translatedPhrase){
        messageOptions = {
          reply_to_message_id: messageId
        }
        bot.sendMessage(chatId, translatedPhrase, messageOptions)
      }
      translate(res.rows[0].fromlanguagecode, res.rows[0].tolanguagecode, text, groupId, replyWithTranslation)
    }
  })
}

const db = {
  clients: [],
  get: function (userId) {
    if(!db.clients[userId] || !db.clients[userId]._connected){
      db.clients[userId] = new Client({
        connectionString: DATABASE_URL,
      })
      db.clients[userId].connect()
    }
    return db.clients[userId]
  }
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

  translate(from, to, phrase, inline_query_id, processTranslationAndAnswerInlineQuery)
  
});

bot.on('message', (message) => {
  console.log(message)
  if(message.text == '/start'){
    messageOptions = {
      parse_mode: 'markdown',
    }
    const startMessage = '*How to use BabelgramBot*\nThis is an inline bot so you can use it from any conversation.\n\nFor that, write in any chat box \'@BabelgramBot\' followed by the language you want to translate from, the language you want to translate to, and the text to translate.\n\nFor example: _\'@BabelgramBot en es Hello how are you\'_\n\nThis will try to translate "Hello" from English to Spanish.\n\nYou can find the code languages in https://cloud.google.com/translate/docs/languages\n\n*Note from the developer*\nThis bot is currently used a lot so the API costs are $15\/month. Now I\'m using my free credit from Google Cloud but the bot will be shutdown when this credit runs out. If you want to help me with the costs, contact @heyjon for donations'
    bot.sendMessage(message.from.id, startMessage, messageOptions)
  }
  else if(message.new_chat_participant){
    if(message.new_chat_participant.is_bot && message.new_chat_participant.username == 'BabelgramBot'){
      const autoTranslateFeatureMessage = '*Auto Translate Group feature*\nHi, thanks for adding me to this group. The Auto Translate Group feature allows any user to let me translate his messages to the desired language of his choice.\n\nTo let me translate your messages uses the following command:\n\n\/autotranslate <language to translate from> <language to translate to>\n\nFor example to translate from English to Russian: _\'\/autotranslate en ru\'_\n\nTo turn off the feature just write /autotranslate off off\n\nYou can find the code languages in https://cloud.google.com/translate/docs/languages'
      messageOptions = {
        parse_mode: 'markdown',
      }
      bot.sendMessage(message.chat.id, autoTranslateFeatureMessage, messageOptions)
    }
  }
  else if(message.text.startsWith('/autotranslate')){
    const fromLanguageCode = message.text.split(' ')[1]
    const toLanguageCode = message.text.split(' ')[2]
    
    if(!fromLanguageCode || !toLanguageCode){
      const noLanguageCodeMessage = 'Sorry you need to specify the language codes after the command.\n\nYou can find the code languages in https://cloud.google.com/translate/docs/languages'
      messageOptions = {
        parse_mode: 'markdown',
      }
      bot.sendMessage(message.chat.id, noLanguageCodeMessage, messageOptions)
    }
    else{
      const userId = message.from.id
      const groupId = message.chat.id
      const userName = message.from.username || ''
      const firstName = message.from.first_name || ''
      const lastName = message.from.last_name || ''

      const sucesssOnSaveCallback = function(){
        messageOptions = {
          parse_mode: 'markdown',
          reply_to_message_id: message.message_id
        }
        bot.sendMessage(message.chat.id, 'AutoTranslate has been enabled for you', messageOptions)
      }
      saveIntoDB(groupId, userId, userName, firstName, lastName, fromLanguageCode, toLanguageCode, sucesssOnSaveCallback)

    }
    
  }
  else if(message.chat.id < 0){
    checkIfAutoTranslate(message)
  }
});

console.log('Babelgrambot started!');