const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/translit.js');
const { romaniseWord: w } = require('../src/scripts/telugu.js');
const { transliterateLine, scriptOf, scriptInfo } = require('../src/translit.js');

test('inherent a is kept (no schwa deletion)', () => {
  assert.equal(w('మనసు'), 'manasu');
  assert.equal(w('ప్రేమ'), 'prema');
  assert.equal(w('సామజవరగమన'), 'saamajavaragamana');
  assert.equal(w('వదలనన్నవి'), 'vadalanannavi');
});

test('virama clusters and doubled consonants', () => {
  assert.equal(w('నువ్వు'), 'nuvvu');
  assert.equal(w('బుట్టబొమ్మ'), 'buttabomma');
  assert.equal(w('వచ్చి'), 'vacchi');
  assert.equal(w('కొత్త'), 'kotta');
  assert.equal(w('నిష్టూరపు'), 'nishtoorapu');
  assert.equal(w('యుద్ధం'), 'yuddham');
});

test('anusvara: m at the end and before labials, n before other stops', () => {
  assert.equal(w('ఇంకేం'), 'inkem');
  assert.equal(w('ఆనందం'), 'aanandam');
  assert.equal(w('మంచి'), 'manchi');
  assert.equal(w('అంబరం'), 'ambaram');
  assert.equal(w('సంసారం'), 'samsaaram');
  assert.equal(w('గుమ్మంలోకి'), 'gummamloki');
});

test('long vowels, e/o and diphthongs', () => {
  assert.equal(w('నా'), 'naa');
  assert.equal(w('నీ'), 'nee');
  assert.equal(w('కావాలే'), 'kaavaale');
  assert.equal(w('జతగా'), 'jathagaa');
  assert.equal(w('ఎదురు'), 'eduru');
  assert.equal(w('ఓ'), 'o');
  assert.equal(w('జన్మై'), 'janmai');
  assert.equal(w('మౌనం'), 'maunam');
});

test('final long ee/oo shortened after the first syllable', () => {
  assert.equal(w('మళ్లీ'), 'malli');
  assert.equal(w('హోలీ'), 'holi');
  assert.equal(w('ఊగుతూ'), 'ooguthu');
});

test('aspirates, sibilants and retroflex letters', () => {
  assert.equal(w('భామ'), 'bhaama');
  assert.equal(w('మధురమైన'), 'madhuramaina');
  assert.equal(w('రథము'), 'rathamu');
  assert.equal(w('వశమా'), 'vashamaa');
  assert.equal(w('ఖర్చు'), 'kharchu');
  assert.equal(w('కళ్లు'), 'kallu');
  assert.equal(w('ప్రాణం'), 'praanam');
  assert.equal(w('ఱంపం'), 'rampam');
});

test('special clusters and signs', () => {
  assert.equal(w('విజ్ఞానం'), 'vignaanam');
  assert.equal(w('లక్ష్మి'), 'lakshmi');
  assert.equal(w('హృదయం'), 'hrudayam');
  assert.equal(w('కృష్ణ'), 'krishna');
  assert.equal(w('దుఃఖం'), 'duhkham');
  assert.equal(w('ఫ఼ోన్'), 'fon');
});

test('decomposed vowel signs match composed ones', () => {
  // ై is U+0C46 U+0C56 when decomposed.
  assert.equal(w('జన్మై'.normalize('NFD')), 'janmai');
  assert.equal(w('జన్మై'), 'janmai');
});

test('full lines', () => {
  assert.equal(transliterateLine('నువ్వుంటే నా జతగా నేనుంటా ఊపిరిగా'), 'Nuvvunte naa jathagaa nenuntaa oopirigaa');
  assert.equal(transliterateLine('ఇంకేం ఇంకేం ఇంకేం కావాలే...'), 'Inkem inkem inkem kaavaale...');
  assert.equal(transliterateLine('సామజవరగమన, నిను చూసి ఆగగలనా'), 'Saamajavaragamana, ninu choosi aagagalanaa');
  assert.equal(
    transliterateLine('Multiplex లోని audience లాగా మౌనంగున్నాగాని అమ్ము'),
    'Multiplex loni audience laagaa maunangunnaagaani ammu',
  );
  assert.equal(transliterateLine('(నా జతగా)'), '(Naa jathagaa)');
  assert.equal(transliterateLine('౨౦౨౦ లో  ప్రేమ ।'), '2020 Lo prema');
});

test('registered as Telugu', () => {
  assert.equal(scriptOf('అమ్ము'), 'te');
  assert.deepEqual(scriptInfo('te'), { code: 'te', name: 'Telugu', symbol: 'అ' });
});
