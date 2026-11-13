const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const BaiGiang = require('../src/models/BaiGiang');
const BaiGiangDaMua = require('../src/models/BaiGiangDaMua');
const { getBaiGiangById } = require('../src/controllers/baigiang/BaiGiangController');
const { getDanhSachDaMua } = require('../src/controllers/baigiang/BaiGiangThuongMaiController');
const studentQuestions = require('../src/utils/studentQuestions');

const question = {
  _id: 'question-1', noiDungCauHoi: '<p>2 + 2 = ?</p>',
  giaiThich: '<p>Two pairs make four.</p>',
  privateNote: 'Do not expose internal fields',
  cacDapAn: [
    { _id: 'a', noiDungDapAn: '4', laDapAnDung: true },
    { _id: 'b', noiDungDapAn: '5', laDapAnDung: false },
  ],
};
const lesson = {
  _id: 'lesson-1', ten_bai_giang: 'Addition', noi_dung_bai_hoc: '<p>Lesson content</p>',
  id_lop_hoc: { id_giaovien: 'teacher-1', danh_sach_hoc_vien: [
    { id_hoc_vien: 'student-1', trang_thai_phe_duyet: 'da_tham_gia' },
    { id_hoc_vien: 'pending-1', trang_thai_phe_duyet: 'cho_phe_duyet' },
  ] },
  danhSachCauHoi: [question],
};
const original = { findById: BaiGiang.findById, find: BaiGiangDaMua.find, countDocuments: BaiGiangDaMua.countDocuments };
BaiGiang.findById = () => ({ populate: async () => ({ ...lesson, toObject: () => structuredClone(lesson) }) });
BaiGiangDaMua.countDocuments = async () => 1;
BaiGiangDaMua.find = () => {
  const query = {
    populate() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; },
    then(resolve, reject) {
      return Promise.resolve([{ id_bai_giang: lesson, toObject: () => structuredClone({ id_bai_giang: lesson }) }]).then(resolve, reject);
    },
  };
  return query;
};
after(() => { BaiGiang.findById = original.findById; BaiGiangDaMua.find = original.find; BaiGiangDaMua.countDocuments = original.countDocuments; });

async function request(handler, role, id) {
  let status, body;
  await handler({ params: { id: 'lesson-1' }, query: {}, user: { role, id } }, {
    status(value) { status = value; return this; }, json(value) { body = value; },
  });
  return { status, body };
}
function assertNoSolutions(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    assert.notEqual(key, 'giaiThich');
    assert.notEqual(key, 'laDapAnDung');
    assert.notEqual(key, 'privateNote');
    assertNoSolutions(nested);
  }
}

test('student detail includes question choices but no explanations or correctness flags', async () => {
  const result = await request(getBaiGiangById, 'hocsinh', 'student-1');
  assert.equal(result.status, 200);
  assertNoSolutions(result.body);
  assert.equal(result.body.data.noi_dung_bai_hoc, lesson.noi_dung_bai_hoc);
  assert.equal(result.body.data.danhSachCauHoi[0].cacDapAn[0].noiDungDapAn, '4');
  assert.equal(result.body.data.danhSachCauHoi[0]._id, 'question-1');
});

test('admin and the assigned teacher retain explanations and correct answers', async () => {
  for (const [role, id] of [['admin', 'admin-1'], ['giaovien', 'teacher-1']]) {
    const result = await request(getBaiGiangById, role, id);
    assert.equal(result.status, 200);
    assert.equal(result.body.data.danhSachCauHoi[0].giaiThich, question.giaiThich);
    assert.equal(result.body.data.danhSachCauHoi[0].cacDapAn[0].laDapAnDung, true);
  }
});

test('pending students and unrelated teachers cannot read the lesson', async () => {
  for (const [role, id] of [['hocsinh', 'pending-1'], ['hocsinh', 'outsider-1'], ['giaovien', 'teacher-2']]) {
    const result = await request(getBaiGiangById, role, id);
    assert.equal(result.status, 403);
    assert.equal(result.body.data, undefined);
  }
});

test('collection listing cannot bypass student answer privacy', async () => {
  const result = await request(getDanhSachDaMua, 'hocsinh', 'student-1');
  assert.equal(result.status, 200);
  assertNoSolutions(result.body);
  const questions = result.body.data.items[0].id_bai_giang.danhSachCauHoi;
  assert.equal(questions.length, 1);
  assert.equal(questions[0].cacDapAn.length, 2);
});

test('student serialization is an allowlist and does not modify source questions', () => {
  const safe = studentQuestions([question]);
  assertNoSolutions(safe);
  assert.equal(question.cacDapAn[0].laDapAnDung, true);
  assert.equal(question.giaiThich, '<p>Two pairs make four.</p>');
});
