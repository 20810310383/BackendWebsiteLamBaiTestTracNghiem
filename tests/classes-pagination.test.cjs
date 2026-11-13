const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const LopHoc = require('../src/models/LopHoc');
const { getAllClasses } = require('../src/controllers/lophoc/lopHocController');

const teacherId = '507f1f77bcf86cd799439011';
const original = { find: LopHoc.find, countDocuments: LopHoc.countDocuments, aggregate: LopHoc.aggregate };
const fixtures = Array.from({ length: 25 }, (_, i) => ({
  _id: String(i + 1).padStart(2, '0'),
  ten_lop: i === 0 ? 'Class [A]' : `Class ${i + 1}`,
  id_giaovien: i < 10 ? teacherId : '507f1f77bcf86cd799439012',
  ma_lop_random: 'PRIVATE'
}));
const matching = (filter) => fixtures.filter((item) =>
  (!filter.id_giaovien || item.id_giaovien === filter.id_giaovien) &&
  (!filter.ten_lop || new RegExp(filter.ten_lop.$regex, filter.ten_lop.$options).test(item.ten_lop))
);
LopHoc.countDocuments = async (filter) => matching(filter).length;
LopHoc.aggregate = async (pipeline) => {
  const owner = pipeline[0].$match.id_giaovien?.toString();
  return [{ totalClasses: owner ? fixtures.filter((item) => item.id_giaovien === owner).length : fixtures.length, totalStudents: 8, pendingStudents: 2 }];
};
LopHoc.find = (filter) => {
  let items = matching(filter).map((item) => ({ ...item }));
  return {
    select(fields) { if (fields === '-ma_lop_random') items.forEach((item) => delete item.ma_lop_random); return this; },
    populate() { return this; },
    sort() { items.sort((a, b) => b._id.localeCompare(a._id)); return this; },
    skip(count) { items = items.slice(count); return this; },
    limit(count) { items = items.slice(0, count); return this; },
    then(resolve, reject) { return Promise.resolve(items).then(resolve, reject); }
  };
};
after(() => Object.assign(LopHoc, original));

async function request(query, role = 'admin') {
  let status;
  let body;
  await getAllClasses({ query, user: { id: teacherId, role } }, {
    status(code) { status = code; return this; },
    json(value) { body = value; }
  });
  assert.equal(status, 200);
  return body;
}

test('pages are distinct, bounded, and preserve collection totals', async () => {
  const first = await request({ page: '1', limit: '6' });
  const second = await request({ page: '2', limit: '6' });
  assert.equal(first.items.length, 6);
  assert.equal(second.items.length, 6);
  assert.equal(second.pagination.total, 25);
  assert.equal(second.pagination.totalPages, 5);
  assert.ok(second.items.every((item) => !first.items.some((other) => other._id === item._id)));
  assert.deepEqual(first.summary, second.summary);
});

test('four-column limits and deletion-style page overflow are handled', async () => {
  const result = await request({ page: '99', limit: '8' });
  assert.equal(result.pagination.page, 4);
  assert.equal(result.items.length, 1);
  assert.equal(result.pagination.limit, 8);
});

test('search applies before pagination and treats regex characters literally', async () => {
  const result = await request({ page: '1', limit: '6', search: '[A]' });
  assert.equal(result.pagination.total, 1);
  assert.equal(result.items[0].ten_lop, 'Class [A]');
  assert.equal(result.summary.totalClasses, 25);
  const empty = await request({ page: '5', limit: '6', search: 'missing-class' });
  assert.equal(empty.pagination.page, 1);
  assert.equal(empty.pagination.total, 0);
  assert.deepEqual(empty.items, []);
});

test('teacher pagination and summary stay scoped to their own classes', async () => {
  const result = await request({ page: '2', limit: '6' }, 'giaovien');
  assert.equal(result.pagination.total, 10);
  assert.equal(result.items.length, 4);
  assert.equal(result.summary.totalClasses, 10);
  assert.ok(result.items.every((item) => item.id_giaovien === teacherId));
});

test('unpaginated callers retain array responses and student class codes stay hidden', async () => {
  const legacy = await request({});
  assert.ok(Array.isArray(legacy));
  assert.equal(legacy.length, 25);
  const student = await request({ page: '1', limit: '8' }, 'hocsinh');
  assert.ok(student.items.every((item) => !Object.hasOwn(item, 'ma_lop_random')));
});

test('invalid limits are bounded', async () => {
  const negative = await request({ page: '-9', limit: '-4' });
  assert.equal(negative.pagination.page, 1);
  assert.equal(negative.pagination.limit, 1);
  const excessive = await request({ page: '1', limit: '9999' });
  assert.equal(excessive.pagination.limit, 60);
});
