const { test } = require('node:test');
const assert = require('node:assert/strict');
const { catalogs } = require('../scripts/seed-free-lessons.cjs');
const { buildBank, validateBank } = require('../scripts/seed-lesson-questions.cjs');
const { banks } = require('../scripts/question-bank-numeric.cjs');

test('all 60 distinct lesson topics have 10 valid questions with answers and explanations', () => {
  let count = 0;
  for (const catalog of catalogs) for (let index = 0; index < catalog.lessons.length; index++) {
    const questions = buildBank(catalog, index, 'fixture');
    validateBank(questions);
    assert.equal(questions.length, 10);
    const positions = questions.map(q => q.cacDapAn.findIndex(a => a.laDapAnDung));
    assert.equal(new Set(positions).size, 4);
    count += questions.length;
  }
  assert.equal(count, 600);
});

test('Python examples distinguish strings, integers and return values', () => {
  assert.equal(banks.python[0](2)[4].answer, '22');
  assert.equal(banks.python[1](4)[3].answer, '4');
  assert.equal(banks.python[4](2)[3].answer, 'None');
  assert.equal(banks.python[4](4)[4].answer, '4');
});

test('math and physics examples preserve signs and unit conversions', () => {
  assert.equal(banks.math[3](4)[4].answer, '-16');
  assert.equal(banks.math[1](2)[2].answer, '16');
  assert.equal(banks.physics[2](2)[1].answer, '293.15');
  assert.equal(banks.physics[3](4)[1].answer, '0');
  assert.equal(banks.physics[5](4)[0].answer, '50');
});

test('Excel distinguishes blank cells from zero in averages', () => {
  assert.equal(banks.excel[2](4)[3].answer, '2');
  assert.equal(banks.excel[2](4)[4].answer, '4');
});
