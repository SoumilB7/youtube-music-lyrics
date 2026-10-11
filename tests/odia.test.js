const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/translit.js');
const { romaniseWord: w } = require('../src/scripts/odia.js');
const { transliterateLine, scriptOf, scriptInfo } = require('../src/translit.js');

test('registers as Odia', () => {
  assert.equal(scriptOf('ମୋ ମନ'), 'or');
  assert.deepEqual(scriptInfo('or'), { code: 'or', name: 'Odia', symbol: 'ଅ' });
});

test('common words', () => {
  assert.equal(w('ମୁଁ'), 'mu');
  assert.equal(w('ମୋ'), 'mo');
  assert.equal(w('ତୁମେ'), 'tume');
  assert.equal(w('ନାହିଁ'), 'nahin');
  assert.equal(w('ଦିଲ'), 'dil');
});

test('the inherent vowel is kept, even at the end', () => {
  assert.equal(w('ମନ'), 'mana');
  assert.equal(w('ପ୍ରେମ'), 'prema');
  assert.equal(w('ହଳଦୀ'), 'haladi');
  assert.equal(w('ରଙ୍ଗବତୀ'), 'rangabati');
  assert.equal(w('ଅଭୁଲା'), 'abhula');
});

test('vowel length is not marked', () => {
  assert.equal(w('ଜୀବନ'), 'jibana');
  assert.equal(w('ଆଜି'), 'aji');
  assert.equal(w('ରାତି'), 'rati');
  assert.equal(w('ଦୂରେ'), 'dure');
  assert.equal(w('ହୃଦୟ'), 'hrudaya');
});

test('Odia letter values', () => {
  assert.equal(w('ଯିବି'), 'jibi'); // ଯ is j
  assert.equal(w('ଭୁବନେଶ୍ୱର'), 'bhubaneswara'); // ବ b, ଶ s, ୱ w
  assert.equal(w('ଦିୱାନୀ'), 'diwani');
  assert.equal(w('ଚଢ଼େଇ'), 'chadhei'); // ଢ଼ (nukta)
  assert.equal(w('ବୁଢ଼ା'), 'budha');
  assert.equal(w('ଗୋକୁଳ'), 'gokula');
  assert.equal(w('ଛାଇ'), 'chhai');
});

test('conjuncts', () => {
  assert.equal(w('ସାଙ୍ଗେ'), 'sange');
  assert.equal(w('ଜହ୍ନ'), 'janha'); // ହ୍ନ is said "nh"
  assert.equal(w('କୃଷ୍ଣ'), 'krushna');
  assert.equal(w('ଜ୍ଞାନ'), 'gyana');
  assert.equal(w('ପ୍ରଶ୍ନ'), 'prasna');
  assert.equal(w('ଜ୍ୟୋତ୍ସ୍ନା'), 'jyotsna');
  assert.equal(w('ପୂର୍ଣ୍ଣ'), 'purna'); // consonant doubled after reph said once
  assert.equal(w('ଧିଗ୍'), 'dhig'); // explicit virama
});

test('nasal signs and vowel sequences', () => {
  assert.equal(w('ପାଇଁ'), 'pain');
  assert.equal(w('କାହିଁ'), 'kahin');
  assert.equal(w('ଝମ୍ପି'), 'jhampi');
  assert.equal(w('ପାଏ'), 'paye');
  assert.equal(w('ଦେଇ'), 'dei');
  assert.equal(w('ଦୁଃଖ'), 'dukha');
});

test('NFC-decomposed input gives the same result', () => {
  assert.equal(w('ଚଢ଼େଇ'.normalize('NFD')), 'chadhei');
});

test('lines keep punctuation and Latin text, capitalise, map digits', () => {
  assert.equal(transliterateLine('କେମିତି ଭୁଲିବି ସେ ଅଭୁଲା ଦିନ?'), 'Kemiti bhulibi se abhula dina?');
  assert.equal(transliterateLine('ଏ ରଙ୍ଗବତୀ, ରଙ୍ଗବତୀ'), 'E rangabati, rangabati');
  assert.equal(transliterateLine('ତୋ heart କଥା ଆଗ ମୋ heart କହିଦେଲା'), 'To heart katha aga mo heart kahidela');
  assert.equal(transliterateLine('ଜଗତର ନାଥ, ଜଗନ୍ନାଥ ପାଇଁ।'), 'Jagatara natha, jagannatha pain');
  assert.equal(transliterateLine('ମୁଁ ୧୦ ଟା ଝିଅ ଦେଖିଲି।'), 'Mu 10 ta jhia dekhili');
  assert.equal(transliterateLine('Baby, ତୁ ମୋ ସୁନା'), 'Baby, tu mo suna');
});
