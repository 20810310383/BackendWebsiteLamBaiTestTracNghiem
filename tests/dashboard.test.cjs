const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const KetQuaBaiThi = require('../src/models/KetQuaBaiThi');
const LopHoc = require('../src/models/LopHoc');
const { getDashboard } = require('../src/controllers/baigiang/LichSuThiController');
const original = { aggregate: KetQuaBaiThi.aggregate, find: LopHoc.find };
const userId = '507f1f77bcf86cd799439011';
const classId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');
let pipelines;
KetQuaBaiThi.aggregate = async pipeline => { pipelines.push(pipeline); return [{ summary: [], daily: [], classes: [] }]; };
LopHoc.find = query => ({ select() { return this; }, async lean() { assert.equal(String(query.id_giaovien), userId); return [{ _id: classId }]; } });
after(() => { KetQuaBaiThi.aggregate = original.aggregate; LopHoc.find = original.find; });
async function request(role, days = '7') {
  pipelines = [];
  let body;
  await getDashboard({ user: { id: userId, _id: new mongoose.Types.ObjectId(userId), role }, query: { days } }, { json(data) { body = data; }, status(code) { throw new Error(`Unexpected status ${code}`); } });
  return body;
}
test('student dashboard uses only the authenticated student and completed attempts', async () => {
  const result = await request('hocsinh');
  assert.equal(pipelines.length, 1);
  assert.equal(String(pipelines[0][0].$match.id_hoc_sinh), userId);
  assert.deepEqual(pipelines[0][0].$match.trang_thai.$in, ['da_nop_bai', 'da_xem_dap_an']);
  assert.equal(result.data.management, null);
  assert.equal(result.data.personal.summary.attempts, 0);
});
test('teacher management statistics are restricted to their classes', async () => {
  const result = await request('giaovien', '30');
  assert.equal(pipelines.length, 2);
  assert.deepEqual(pipelines[1][0].$match.id_lop_hoc.$in.map(String), [String(classId)]);
  assert.equal(result.data.days, 30);
});
test('admin receives system statistics and invalid periods use the default', async () => {
  const result = await request('admin', '9999');
  assert.equal(pipelines.length, 2);
  assert.equal(pipelines[1][0].$match.id_lop_hoc, undefined);
  assert.equal(result.data.days, 30);
});
