const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const BaiGiang = require('../src/models/BaiGiang');
const LopHoc = require('../src/models/LopHoc');
const studentListingPage = require('../src/utils/studentListingPage');

const original = { lessons: BaiGiang.find, classes: LopHoc.find };
const classes = [{ _id: 'class-a', ten_lop: 'Python' }, { _id: 'class-b', ten_lop: 'Excel [A]' }];
const lessons = Array.from({ length: 25 }, (_, i) => ({ _id: `lesson-${i}`, ten_bai_giang: i === 20 ? 'Unique distant topic' : `Lesson ${i}`, id_lop_hoc: i < 15 ? 'class-a' : 'class-b' }));
const records = [
  ...lessons.map(lesson => ({ id_hoc_sinh: 'student-a', id_bai_giang: lesson._id })),
  ...lessons.map(lesson => ({ id_hoc_sinh: 'student-b', id_bai_giang: lesson._id })),
];
const regexMatches = (value, filter) => new RegExp(filter.$regex, filter.$options).test(value);
LopHoc.find = query => ({ select() { return this; }, async lean() { return classes.filter(item => regexMatches(item.ten_lop, query.ten_lop)); } });
BaiGiang.find = query => ({ select() { return this; }, async lean() {
  return lessons.filter(item => regexMatches(item.ten_bai_giang, query.$or[0].ten_bai_giang) || query.$or[1].id_lop_hoc.$in.includes(item.id_lop_hoc));
} });
const Model = { async countDocuments(query) { return records.filter(item => item.id_hoc_sinh === query.id_hoc_sinh && (!query.id_bai_giang || query.id_bai_giang.$in.includes(item.id_bai_giang))).length; } };
after(() => { BaiGiang.find = original.lessons; LopHoc.find = original.classes; });

test('three- and four-column page sizes produce correct offsets and totals', async () => {
  const three = await studentListingPage(Model, 'student-a', { page: '2', limit: '6' });
  assert.equal(three.skip, 6);
  assert.equal(three.pagination.totalPages, 5);
  const four = await studentListingPage(Model, 'student-a', { page: '3', limit: '8' });
  assert.equal(four.skip, 16);
  assert.equal(four.pagination.total, 25);
  assert.equal(four.pagination.totalPages, 4);
});

test('search finds a matching lesson beyond the original first page', async () => {
  const result = await studentListingPage(Model, 'student-a', { page: '1', limit: '6', search: 'distant' });
  assert.deepEqual(result.query.id_bai_giang.$in, ['lesson-20']);
  assert.equal(result.pagination.total, 1);
  assert.equal(result.summary.total, 25);
});

test('class-name search is literal and stays scoped to the signed-in student', async () => {
  const result = await studentListingPage(Model, 'student-a', { search: '[A]', limit: '8' });
  assert.equal(result.query.id_hoc_sinh, 'student-a');
  assert.equal(result.pagination.total, 10);
  assert.equal(result.summary.total, 25);
});

test('overflow pages and empty searches cannot create blank trailing pages', async () => {
  const last = await studentListingPage(Model, 'student-a', { page: '99', limit: '8' });
  assert.equal(last.pagination.page, 4);
  assert.equal(last.skip, 24);
  const empty = await studentListingPage(Model, 'student-a', { page: '99', search: 'no such lesson' });
  assert.equal(empty.pagination.page, 1);
  assert.equal(empty.pagination.total, 0);
  assert.equal(empty.skip, 0);
  assert.equal(empty.summary.total, 25);
});

test('page and limit values are bounded and whitespace does not filter totals', async () => {
  const bounded = await studentListingPage(Model, 'student-a', { page: '-5', limit: '99999', search: '  ' });
  assert.equal(bounded.pagination.page, 1);
  assert.equal(bounded.pagination.limit, 60);
  assert.equal(bounded.pagination.total, 25);
  assert.equal(bounded.query.id_bai_giang, undefined);
});
