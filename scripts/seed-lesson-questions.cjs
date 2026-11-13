const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const BaiGiang = require('../src/models/BaiGiang');
const LopHoc = require('../src/models/LopHoc');
const { catalogs } = require('./seed-free-lessons.cjs');
const concepts = require('./question-bank-concepts.cjs');
const { banks: numericBanks } = require('./question-bank-numeric.cjs');

const escape = (text) => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const plain = (html) => String(html).replace(/<[^>]*>/g, '').trim();

function buildBank(catalog, lessonIndex, salt = '') {
  const title = catalog.lessons[lessonIndex][0];
  let problems;
  if (concepts[catalog.key]) {
    const facts = concepts[catalog.key][lessonIndex];
    assert.equal(facts.length, 5);
    problems = facts.flatMap(([term, definition, situation], index) => {
      const others = facts.filter((_, i) => i !== index).slice(0, 3);
      return [
        { prompt: `Khái niệm “${term}” trong bài học được mô tả đúng ở phương án nào?`, answer: definition, wrong: others.map(fact => fact[1]), explanation: definition },
        { prompt: situation, answer: term, wrong: others.map(fact => fact[0]), explanation: `${term}: ${definition}` }
      ];
    });
  } else {
    const factory = numericBanks[catalog.key]?.[lessonIndex];
    assert.ok(factory, `Missing question bank: ${catalog.key}/${lessonIndex}`);
    problems = [2, 4].flatMap(n => factory(n));
  }
  assert.equal(problems.length, 10, title);
  assert.equal(new Set(problems.map(p => p.prompt)).size, 10, `Duplicate question in ${title}`);
  return problems.map((problem, index) => {
    const answers = [problem.answer, ...problem.wrong].map(String);
    assert.equal(answers.length, 4, problem.prompt);
    assert.equal(new Set(answers).size, 4, `Duplicate answer: ${problem.prompt}`);
    assert.ok(answers.every(answer => answer.trim()), problem.prompt);
    const correct = { noiDungDapAn: answers[0], laDapAnDung: true };
    const options = answers.slice(1).map(answer => ({ noiDungDapAn: answer, laDapAnDung: false }));
    // Balance correct answer positions across the bank without always using A.
    const offset = crypto.createHash('sha256').update(`${salt}:${title}`).digest()[0] % 4;
    options.splice((index + offset) % 4, 0, correct);
    return {
      noiDungCauHoi: `<p>${escape(problem.prompt)}</p>`,
      cacDapAn: options,
      giaiThich: `<p>${escape(problem.explanation)}</p>`
    };
  });
}

function validateBank(questions) {
  assert.ok(questions.length >= 10 && questions.length <= 20);
  const prompts = questions.map(q => plain(q.noiDungCauHoi));
  assert.ok(prompts.every(Boolean));
  assert.equal(new Set(prompts).size, prompts.length, 'Duplicate question prompts');
  for (const q of questions) {
    assert.equal(q.cacDapAn.length, 4);
    assert.equal(q.cacDapAn.filter(a => a.laDapAnDung).length, 1);
    assert.equal(new Set(q.cacDapAn.map(a => a.noiDungDapAn)).size, 4);
    assert.ok(plain(q.giaiThich));
  }
}

async function main() {
  // Validate every source bank before connecting or writing anything.
  for (const catalog of catalogs) {
    catalog.lessons.forEach((_, index) => validateBank(buildBank(catalog, index)));
  }
  const env = dotenv.parse(fs.readFileSync(path.join(__dirname, '../.env'), 'utf8'));
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const classes = await LopHoc.find().lean();
  const lessons = await BaiGiang.find().lean();
  const apply = process.argv.includes('--apply');
  const plan = [];
  for (const lesson of lessons) {
    const original = lesson.danhSachCauHoi || [];
    if (original.length >= 10) {
      assert.ok(original.length <= 20, 'Existing lesson exceeds 20 questions; left untouched');
      continue;
    }
    const catalog = catalogs.find(c => c.lessons.some(row => row[0] === lesson.ten_bai_giang));
    assert.ok(catalog, `No subject bank found for ${lesson.ten_bai_giang}`);
    const index = catalog.lessons.findIndex(row => row[0] === lesson.ten_bai_giang);
    const generated = buildBank(catalog, index, String(lesson._id));
    const existingPrompts = new Set(original.map(q => plain(q.noiDungCauHoi)));
    const additions = generated.filter(q => !existingPrompts.has(plain(q.noiDungCauHoi))).slice(0, 10 - original.length);
    assert.equal(original.length + additions.length, 10);
    const trial = new BaiGiang({ ...lesson, danhSachCauHoi: [...original, ...additions] });
    await trial.validate();
    plan.push({ lesson, additions });
  }
  let added = 0;
  if (apply) {
    for (const { lesson, additions } of plan) {
      // An append leaves existing questions intact and refuses concurrent count changes.
      const result = await BaiGiang.updateOne(
        { _id: lesson._id, danhSachCauHoi: { $size: (lesson.danhSachCauHoi || []).length } },
        { $push: { danhSachCauHoi: { $each: additions } } },
        { runValidators: true }
      );
      assert.equal(result.modifiedCount, 1, 'Question bank changed concurrently; re-run to inspect');
      added += additions.length;
    }
  }
  const saved = apply ? await BaiGiang.find().lean() : lessons.map(lesson => {
    const pending = plan.find(item => String(item.lesson._id) === String(lesson._id));
    return { ...lesson, danhSachCauHoi: [...(lesson.danhSachCauHoi || []), ...(pending?.additions || [])] };
  });
  for (const lesson of saved) validateBank(lesson.danhSachCauHoi);
  console.log(JSON.stringify({ applied: apply, classes: classes.length, lessons: saved.length, questionsAdded: added,
    totalQuestions: saved.reduce((sum, lesson) => sum + lesson.danhSachCauHoi.length, 0),
    minPerLesson: Math.min(...saved.map(lesson => lesson.danhSachCauHoi.length)),
    maxPerLesson: Math.max(...saved.map(lesson => lesson.danhSachCauHoi.length))
  }, null, 2));
}

module.exports = { buildBank, validateBank };
if (require.main === module) {
  const timer = setTimeout(() => { console.error('Database operation timed out; re-run safely to resume.'); process.exit(1); }, 120000);
  main().catch(error => { console.error('Question seeding failed: ' + error.message); process.exitCode = 1; })
    .finally(async () => { await mongoose.disconnect(); clearTimeout(timer); });
}
