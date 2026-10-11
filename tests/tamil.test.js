const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/translit.js');
const { romaniseWord: w } = require('../src/scripts/tamil.js');
const { transliterateLine, scriptOf, scriptInfo } = require('../src/translit.js');

test('consonants keep "a" unless they have pulli', () => {
  assert.equal(w('கண்'), 'kan');
  assert.equal(w('கண்ணா'), 'kanna');
  assert.equal(w('அம்மா'), 'amma');
  assert.equal(w('மழை'), 'mazhai');
});

test('k/g depends on position', () => {
  assert.equal(w('கனவு'), 'kanavu');
  assert.equal(w('முகம்'), 'mugam');
  assert.equal(w('தங்கம்'), 'thangam');
  assert.equal(w('நெஞ்சுக்குள்'), 'nenjukkul');
  assert.equal(w('சொல்கிறதே'), 'solgiradhe');
});

test('t/d and th/dh depend on position', () => {
  assert.equal(w('பாடல்'), 'paadal');
  assert.equal(w('வண்டி'), 'vandi');
  assert.equal(w('போட்டாய்'), 'pottaai');
  assert.equal(w('தமிழ்'), 'thamizh');
  assert.equal(w('காதல்'), 'kaadhal');
  assert.equal(w('சத்தம்'), 'satham');
  assert.equal(w('வந்தாலே'), 'vandhaale');
  assert.equal(w('பெய்திடும்'), 'peidhidum');
});

test('p/b and s/ch/j depend on position', () => {
  assert.equal(w('அன்பு'), 'anbu');
  assert.equal(w('நம்பிக்கை'), 'nambikkai');
  assert.equal(w('சாமி'), 'saami');
  assert.equal(w('பசி'), 'pasi');
  assert.equal(w('பச்சை'), 'pachai');
  assert.equal(w('நெஞ்சம்'), 'nenjam');
  assert.equal(w('லட்சியம்'), 'latchiyam');
  assert.equal(w('முயற்சி'), 'muyarchi');
});

test('ற: r, tr when doubled, ndr after ன்', () => {
  assert.equal(w('மறைந்து'), 'maraindhu');
  assert.equal(w('காற்று'), 'kaatru');
  assert.equal(w('என்று'), 'endru');
  assert.equal(w('ஒன்று'), 'ondru');
});

test('doubled stops after a consonant are written once', () => {
  assert.equal(w('போர்க்களமே'), 'porkalame');
  assert.equal(w('வாழ்க்கை'), 'vaazhkai');
  assert.equal(w('எதிர்ப்பார்க்கும்'), 'edhirpaarkum');
});

test('long vowels, final shortening and diphthongs', () => {
  assert.equal(w('வா'), 'vaa');
  assert.equal(w('நீ'), 'nee');
  assert.equal(w('பூ'), 'poo');
  assert.equal(w('வசீகரா'), 'vaseegara');
  assert.equal(w('தோழி'), 'thozhi');
  assert.equal(w('வெண்ணிலவே'), 'vennilave');
  assert.equal(w('ஏக்கங்கள்'), 'aekkangal');
  assert.equal(w('ஔவை'), 'auvai');
  assert.equal(w('தாய்'), 'thaai');
  assert.equal(w('நோய்'), 'noi');
});

test('Grantha letters, aytham and common words', () => {
  assert.equal(w('ஜென்மம்'), 'jenmam');
  assert.equal(w('ஷாலினி'), 'shaalini');
  assert.equal(w('ஹரி'), 'hari');
  assert.equal(w('க்ஷணம்'), 'kshanam');
  assert.equal(w('ஸ்ரீ'), 'sri');
  assert.equal(w('ஃபேன்'), 'fen');
  assert.equal(w('எஃகு'), 'ehku');
  assert.equal(w('ஏன்'), 'yen');
  assert.equal(w('டி'), 'di');
});

test('decomposed and composed vowel signs give the same result', () => {
  assert.equal(w('கொ'), 'ko'); // ொ as one code point
  assert.equal(w('\u0B95\u0BC6\u0BBE'), 'ko'); // ெ + ா
  assert.equal(w('போதும்'), 'podhum');
  assert.equal(w('\u0BAA\u0BC7\u0BBE\u0BA4\u0BC1\u0BAE\u0BCD'), 'podhum'); // ே + ா
  assert.equal(transliterateLine('\u0B95\u0BC6\u0BBE\u0BB2\u0BAE\u0BCD'), 'Kolam'); // decomposed in a line
  assert.equal(w('ஔவை'), w('ஔவை'.normalize('NFD')));
});

test('song titles people search for', () => {
  assert.equal(transliterateLine('கண்ணான கண்ணே'), 'Kannaana kanne');
  assert.equal(transliterateLine('முன்பே வா என் அன்பே வா'), 'Munbe vaa en anbe vaa');
  assert.equal(transliterateLine('வை திஸ் கொலவெறி டி'), 'Vai this kolaveri di');
  assert.equal(transliterateLine('வாத்தி'), 'Vaathi');
  assert.equal(transliterateLine('என்னவளே அடி என்னவளே'), 'Ennavale adi ennavale');
});

test('lines keep punctuation and Latin text, map digits, capitalise', () => {
  assert.equal(transliterateLine('நம்பிக்கை என்பது வேண்டும், நம் வாழ்வில்'), 'Nambikkai enbadhu vendum, nam vaazhvil');
  assert.equal(transliterateLine('Baby, நீ தான் என் உயிரே!'), 'Baby, nee thaan en uyire!');
  assert.equal(transliterateLine('உடைந்துப் போகக் கூடாது...'), 'Udaindhup pogak koodaadhu...');
  assert.equal(transliterateLine('௧௨ மணி'), '12 Mani');
});

test('script detection', () => {
  assert.equal(scriptOf('Hey, நீ'), 'ta');
  assert.equal(scriptInfo('ta').symbol, 'அ');
});
