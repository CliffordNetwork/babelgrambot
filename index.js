'use strict'

// https://cloud.google.com/translate/docs/languages
const request = require('request');

if(process.env.NODE_ENV != 'production'){
  require('dotenv').config();
}

const TOKEN = process.env.BABELGRAM_TOKEN || '';
const GOOGLE_CLOUD_API_KEY = process.env.GOOGLE_CLOUD_API_KEY || '';

if(!TOKEN || !GOOGLE_CLOUD_API_KEY){
  console.error('Make sure you have BABELGRAM_TOKEN and GOOGLE_CLOUD_API_KEY set as environment variables')
  return;
}

function processTranslationAndAnswerInlineQuery(error, response, body, from, to, inline_query_id) {

  if(error) console.log('error:', error);
  // console.log('statusCode:', response && response.statusCode);
  if(response.statusCode != 200) return;

  const translationData = JSON.parse(body);
  const translatedPhrase = translationData.data.translations[0].translatedText;
  
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

function processInlineQuery(inline_query_id, query){

  const splitQuery = query.split(' ');
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
}

let offset = 0;

const requestResponse = (error, response, body) => {
  if(error) console.log('error:', error);
  // console.log('statusCode:', response && response.statusCode);
  const botResponse = JSON.parse(body)
  
  if(botResponse.ok && botResponse.result){
    botResponse.result.forEach(update => {
      offset = update.update_id + 1;

      if(update.inline_query){
        // console.log(`type: inline, id: ${update.update_id}, text: ${update.inline_query.query}, query_id: ${update.inline_query.id}`)
        processInlineQuery(update.inline_query.id, update.inline_query.query)
      }
    });
  }
}

function getUpdates() {
  request({
    uri: `https://api.telegram.org/bot${TOKEN}/getUpdates`,
    qs: { offset }
  }, requestResponse);
}

setInterval(getUpdates, 1000);
console.log('Babelgrambot started!');