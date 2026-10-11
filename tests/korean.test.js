const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/translit.js');
const { romaniseWord: w } = require('../src/scripts/korean.js');
const { transliterateLine, scriptOf, scriptInfo } = require('../src/translit.js');

test('basic syllables and vowels', () => {
  assert.equal(w('사랑해'), 'saranghae');
  assert.equal(w('하늘'), 'haneul');
  assert.equal(w('너를'), 'neoreul');
  assert.equal(w('보고'), 'bogo');
  assert.equal(w('의자'), 'uija');
  assert.equal(w('왜'), 'wae');
});

test('liaison moves a final into an empty ㅇ', () => {
  assert.equal(w('사랑을'), 'sarangeul');
  assert.equal(w('싶어'), 'sipeo');
  assert.equal(w('있어'), 'isseo');
  assert.equal(w('없어'), 'eopseo');
  assert.equal(w('읽어'), 'ilgeo');
  assert.equal(w('앉아'), 'anja');
  assert.equal(w('밖에'), 'bakke');
  assert.equal(w('맛있어'), 'masisseo');
});

test('ㅎ goes silent before a vowel', () => {
  assert.equal(w('좋아'), 'joa');
  assert.equal(w('괜찮아'), 'gwaenchana');
  assert.equal(w('싫어'), 'sireo');
});

test('palatalisation', () => {
  assert.equal(w('같이'), 'gachi');
  assert.equal(w('굳이'), 'guji');
});

test('aspiration with ㅎ', () => {
  assert.equal(w('좋다'), 'jota');
  assert.equal(w('좋고'), 'joko');
  assert.equal(w('않고'), 'anko');
  assert.equal(w('축하'), 'chuka');
  assert.equal(w('밝히다'), 'balkida');
  assert.equal(w('좋습니다'), 'josseumnida');
  assert.equal(w('좋네'), 'jonne');
});

test('nasalisation', () => {
  assert.equal(w('합니다'), 'hamnida');
  assert.equal(w('국물'), 'gungmul');
  assert.equal(w('있는'), 'inneun');
  assert.equal(w('없는'), 'eomneun');
  assert.equal(w('심리'), 'simni');
  assert.equal(w('국립'), 'gungnip');
});

test('ㄹ assimilation', () => {
  assert.equal(w('몰라'), 'molla');
  assert.equal(w('신라'), 'silla');
  assert.equal(w('설날'), 'seollal');
  assert.equal(w('싫네'), 'sille');
});

test('final consonant neutralisation and voicing', () => {
  assert.equal(w('꽃'), 'kkot');
  assert.equal(w('밖'), 'bak');
  assert.equal(w('닭'), 'dak');
  assert.equal(w('값'), 'gap');
  assert.equal(w('여덟'), 'yeodeol');
  assert.equal(w('학교'), 'hakgyo');
  assert.equal(w('바다'), 'bada');
  assert.equal(w('입술'), 'ipsul');
});

test('loose and conjoining jamo', () => {
  assert.equal(w('ㅋㅋㅋ'), 'kkk');
  assert.equal(w('ㅠㅠ'), 'yuyu');
  assert.equal(w('ㅇㅇ'), 'ngng');
  assert.equal(w('사랑'), 'sarang'); // conjoining 사랑
  assert.equal(w('ᄀ'), 'g'); // lone choseong
});

test('lines: spaces, punctuation, mixed English, capitalisation', () => {
  assert.equal(transliterateLine('보고 싶어'), 'Bogo sipeo');
  assert.equal(transliterateLine('baby 사랑해'), 'baby saranghae');
  assert.equal(transliterateLine('괜찮아, 괜찮아!'), 'Gwaenchana, gwaenchana!');
  assert.equal(transliterateLine('(사랑해) oh'), '(Saranghae) oh');
  assert.equal(transliterateLine('너를 사랑해 漢字'), 'Neoreul saranghae 漢字');
  // Rules don't cross spaces: 사랑 을 keeps the ng apart.
  assert.equal(transliterateLine('꽃 이'), 'Kkot i');
  assert.equal(transliterateLine('Already romanised'), 'Already romanised');
});

test('registered as Korean', () => {
  assert.equal(scriptOf('baby 사랑해'), 'ko');
  assert.deepEqual(scriptInfo('ko'), { code: 'ko', name: 'Korean', symbol: '한' });
});
