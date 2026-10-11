const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/translit.js');
const { romaniseWord: w } = require('../src/scripts/bengali.js');
const { transliterateLine, scriptOf, scriptInfo } = require('../src/translit.js');

test('inherent vowel is "o", silent at the end of a word', () => {
  assert.equal(w('মন'), 'mon');
  assert.equal(w('জল'), 'jol');
  assert.equal(w('কথা'), 'kotha');
  assert.equal(w('জীবন'), 'jibon');
  assert.equal(w('হৃদয়'), 'hridoy');
  assert.equal(w('উত্তর'), 'uttor');
});

test('final o kept after clusters, হ and in -to/-bo/-chho endings', () => {
  assert.equal(w('স্বপ্ন'), 'shopno');
  assert.equal(w('দেহ'), 'deho');
  assert.equal(w('কত'), 'koto');
  assert.equal(w('যাব'), 'jabo');
  assert.equal(w('করব'), 'korbo');
  assert.equal(w('দেখেছ'), 'dekhechho');
  assert.equal(w('প্রিয়'), 'priyo');
  assert.equal(w('রাত'), 'rat');
  assert.equal(w('সব'), 'sob');
});

test('medial o kept in stems, dropped before verb endings and suffixes', () => {
  assert.equal(w('নীরবে'), 'nirobe');
  assert.equal(w('জীবনে'), 'jibone');
  assert.equal(w('নয়নে'), 'noyone');
  assert.equal(w('করতে'), 'korte');
  assert.equal(w('একলা'), 'ekla');
  assert.equal(w('আমরা'), 'amra');
  assert.equal(w('একটু'), 'ektu');
  assert.equal(w('একদিন'), 'ekdin');
  assert.equal(w('পাগলের'), 'pagoler');
});

test('য-ফলা and other conjuncts', () => {
  assert.equal(w('বিদ্যা'), 'biddya');
  assert.equal(w('জন্য'), 'jonno');
  assert.equal(w('সত্যি'), 'sotti');
  assert.equal(w('ব্যথা'), 'byatha');
  assert.equal(w('সূর্য'), 'surjo');
  assert.equal(w('রক্ষা'), 'rokkha');
  assert.equal(w('জ্ঞান'), 'gyan');
  assert.equal(w('ইচ্ছে'), 'icche');
  assert.equal(w('দুঃখ'), 'dukkho');
});

test('nasal signs, ৎ, ড় ঢ় য়', () => {
  assert.equal(w('বাংলা'), 'bangla');
  assert.equal(w('চাঁদ'), 'chand');
  assert.equal(w('ছুঁয়ে'), 'chhuye');
  assert.equal(w('সঙ্গে'), 'songe');
  assert.equal(w('হঠাৎ'), 'hothat');
  assert.equal(w('বাড়ি'), 'bari');
  assert.equal(w('আষাঢ়'), 'asharh');
  assert.equal(w('তোমায়'), 'tomay');
});

test('nukta-decomposed and precomposed letters read the same', () => {
  // U+09DC ড়, U+09DF য় vs ড/য + U+09BC nukta.
  assert.equal(w('বাড়ি'), w('বাড়ি'));
  assert.equal(w('হয়'), w('হয়'));
  assert.equal(w('হয়'), 'hoy');
});

test('common words and ভালোবাসা', () => {
  assert.equal(w('কেন'), 'keno');
  assert.equal(w('ছিল'), 'chhilo');
  assert.equal(w('ভালোবাসি'), 'bhalobashi');
  assert.equal(w('ভালবাসা'), 'bhalobasha');
  assert.equal(w('আজও'), 'ajo');
  assert.equal(w('তোমারই'), 'tomari');
});

test('Assamese letters', () => {
  assert.equal(w('ৰাতি'), 'rati');
  assert.equal(w('ৱাৰ'), 'war');
});

test('lines', () => {
  assert.equal(transliterateLine('আমার সোনার বাংলা'), 'Amar sonar bangla');
  assert.equal(transliterateLine('তুমি রবে নীরবে'), 'Tumi robe nirobe');
  assert.equal(transliterateLine('যদি তোর ডাক শুনে কেউ না আসে তবে একলা চলো রে'),
    'Jodi tor dak shune keu na ase tobe ekla cholo re');
  assert.equal(transliterateLine('আমি তোমায় ভালবাসি।'), 'Ami tomay bhalobashi');
  assert.equal(transliterateLine('কাঁদে মনের কথা, প্রেম কি শুধু ব্যথা?'), 'Kande moner kotha, prem ki shudhu byatha?');
  assert.equal(transliterateLine('Baby, তুমি আমার ১০০ বার'), 'Baby, tumi amar 100 bar');
  assert.equal(transliterateLine('Hello world'), 'Hello world');
});

test('registered as Bengali', () => {
  assert.equal(scriptOf('আমি'), 'bn');
  assert.deepEqual(scriptInfo('bn'), { code: 'bn', name: 'Bengali', symbol: 'অ' });
});
