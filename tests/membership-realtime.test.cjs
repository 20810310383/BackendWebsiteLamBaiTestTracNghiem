const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const Class = require('../src/models/LopHoc');
const controller = require('../src/controllers/lophoc/lopHocController');
const original = Class.findOne;
after(() => { Class.findOne = original; });

test('join and admin approval notify only admins, owner and affected student after saving', async () => {
  let saved = false;
  const classroom = { _id: 'class', id_giaovien: 'teacher', si_so_toi_da: 30, danh_sach_hoc_vien: [], async save() { saved = true; } };
  Class.findOne = async () => classroom;
  const rooms = [], events = [];
  const io = { to(room) { rooms.push(room); return this; }, emit(event, payload) { assert.ok(saved); events.push({ event, payload }); } };
  let status;
  const res = { status(value) { status = value; return this; }, json() {} };
  const req = { user: { id: 'student', role: 'hocsinh' }, body: { ma_lop_random: 'CODE' }, app: { get() { return io; } } };
  await controller.joinClassByCode(req, res);
  assert.equal(status, 200);
  assert.deepEqual(rooms, ['admins', 'user:teacher', 'user:student', 'user:teacher']);
  assert.equal(events[0].payload.status, 'cho_phe_duyet');
  saved = false;
  let filter;
  Class.findOne = async value => { filter = value; return classroom; };
  await controller.approveStudent({ ...req, user: { id: 'admin', role: 'admin' }, body: { classId: 'class', studentId: 'student', status: 'da_tham_gia' } }, res);
  assert.deepEqual(filter, { _id: 'class' });
  assert.equal(events[1].event, 'class:approval-notification');
  assert.equal(events[2].payload.status, 'da_tham_gia');
  assert.equal(classroom.danh_sach_hoc_vien[0].trang_thai_phe_duyet, 'da_tham_gia');
});

test('invalid approval status does not mutate or emit', async () => {
  let accessed = false;
  Class.findOne = async () => { accessed = true; };
  let status;
  await controller.approveStudent({ user: { id: 'admin', role: 'admin' }, body: { status: 'invalid' } }, { status(value) { status = value; return this; }, json() {} });
  assert.equal(status, 400);
  assert.equal(accessed, false);
});

test('rejected students can request again without duplicating membership and notify the owner', async () => {
  const member = { id_hoc_vien: 'student', trang_thai_phe_duyet: 'bi_tu_choi', ngay_vao_lop: new Date(0) };
  const classroom = { _id: 'class', id_giaovien: 'teacher', si_so_toi_da: 1, danh_sach_hoc_vien: [member], async save() {} };
  Class.findOne = async () => classroom;
  const events = [];
  const io = { to() { return this; }, emit(event, payload) { events.push({ event, payload }); } };
  let status;
  const req = { user: { id: 'student' }, body: { ma_lop_random: 'CODE' }, app: { get() { return io; } } };
  const res = { status(value) { status = value; return this; }, json() {} };
  await controller.joinClassByCode(req, res);
  assert.equal(status, 200);
  assert.equal(classroom.danh_sach_hoc_vien.length, 1);
  assert.equal(member.trang_thai_phe_duyet, 'cho_phe_duyet');
  assert.ok(member.ngay_vao_lop.getTime() > 0);
  assert.equal(events[0].payload.status, 'cho_phe_duyet');
  await controller.joinClassByCode(req, res);
  assert.equal(status, 400);
  assert.equal(events.length, 2);
});

test('rejoining is blocked when approved enrollment has reached capacity', async () => {
  const member = { id_hoc_vien: 'student', trang_thai_phe_duyet: 'bi_tu_choi' };
  Class.findOne = async () => ({ si_so_toi_da: 1, danh_sach_hoc_vien: [member, { id_hoc_vien: 'other', trang_thai_phe_duyet: 'da_tham_gia' }] });
  let status;
  await controller.joinClassByCode({ user: { id: 'student' }, body: { ma_lop_random: 'CODE' } }, { status(value) { status = value; return this; }, json() {} });
  assert.equal(status, 400);
  assert.equal(member.trang_thai_phe_duyet, 'bi_tu_choi');
});

test('pending notifications always scope classes to the current owner including admins', async () => {
  const originalFind = Class.find;
  try {
    for (const role of ['admin', 'giaovien']) {
      let filter;
      Class.find = value => {
        filter = value;
        return { select() { return this; }, async populate() { return [{ _id: 'owned', ten_lop: 'My class', danh_sach_hoc_vien: [
          { id_hoc_vien: { _id: 'student', ho_ten: 'Student', ma_so: 'SV01' }, trang_thai_phe_duyet: 'cho_phe_duyet', ngay_vao_lop: new Date() },
          { id_hoc_vien: { _id: 'approved' }, trang_thai_phe_duyet: 'da_tham_gia' },
          { id_hoc_vien: null, trang_thai_phe_duyet: 'cho_phe_duyet' },
        ] }]; } };
      };
      let body, status;
      await controller.pendingRequests({ user: { id: 'owner', role } }, { status(value) { status = value; return this; }, json(value) { body = value; } });
      assert.equal(status, 200);
      assert.equal(filter.id_giaovien, 'owner');
      assert.equal(body.items.length, 1);
      assert.equal(body.items[0].studentId, 'student');
    }
  } finally { Class.find = originalFind; }
});
