const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
let connectSocket;
try { ({ io: connectSocket } = require('socket.io-client')); }
catch { try { ({ io: connectSocket } = require('../../GiaoDienWebsiteLamBaiTest2026/node_modules/socket.io-client')); } catch {} }
const createPresence = require('../src/realtime/presence');
const NguoiDung = require('../src/models/NguoiDung');
const id = s => new mongoose.Types.ObjectId(s.repeat(24));
const ids = { classroom: id('a'), teacher: id('1'), alice: id('2'), bob: id('3'), outsider: id('4'), pending: id('5') };
const accounts = Object.fromEntries(['teacher', 'alice', 'bob', 'outsider', 'pending'].map(name => [String(ids[name]), { _id: ids[name], role: name === 'teacher' ? 'giaovien' : 'hocsinh', isActive: true, currentToken: `token-${name}`, last_seen_at: null }]));
let writes = [];
const members = [
  { id_hoc_vien: ids.alice, trang_thai_phe_duyet: 'da_tham_gia' },
  { id_hoc_vien: ids.bob, trang_thai_phe_duyet: 'da_tham_gia' },
  { id_hoc_vien: ids.pending, trang_thai_phe_duyet: 'cho_phe_duyet' },
];
const classroom = { _id: ids.classroom, id_giaovien: ids.teacher, danh_sach_hoc_vien: members };
let populatedDelay = 0;
const chain = value => ({ select() { return this; }, populate() { this.populated = true; return this; }, async lean() {
  if (value === classroom && this.populated) {
    if (populatedDelay) await new Promise(resolve => setTimeout(resolve, populatedDelay));
    return { ...classroom, id_giaovien: { ...accounts[String(ids.teacher)] }, danh_sach_hoc_vien: classroom.danh_sach_hoc_vien.map(member => ({ ...member, id_hoc_vien: { ...accounts[String(member.id_hoc_vien)] } })) };
  }
  return value;
} });
const Users = {
  findById: value => chain(accounts[String(value)] || null),
  find: query => chain(query._id.$in.map(value => accounts[String(value)]).filter(Boolean)),
  updateOne: async (filter, update) => { const user = accounts[String(filter._id)]; if (user) user.last_seen_at = update.$max.last_seen_at; writes.push(String(filter._id)); },
};
const Classes = {
  findById: value => chain(String(value) === String(ids.classroom) ? classroom : null),
  find: query => {
    const target = String(query.$or[0].id_giaovien);
    return chain(String(classroom.id_giaovien) === target || members.some(member => String(member.id_hoc_vien) === target && member.trang_thai_phe_duyet === 'da_tham_gia') ? [classroom] : []);
  },
};
const verify = token => { const user = Object.values(accounts).find(value => value.currentToken === token); if (!user) throw new Error('Unauthorized'); return { id: String(user._id) }; };
let server, io, base;
const clients = [];
before(async () => {
  if (!connectSocket) return;
  server = http.createServer(); io = new Server(server);
  const presence = createPresence(io, { Users, Classes, verify });
  io.use((socket, next) => { try { socket.data.user = accounts[verify(socket.handshake.auth.token).id]; next(); } catch { next(new Error('Unauthorized')); } });
  io.on('connection', socket => { socket.join(`user:${socket.data.user._id}`); presence.register(socket); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { clients.forEach(socket => socket.disconnect()); if (io) await new Promise(resolve => io.close(resolve)); });
async function connect(name) {
  const socket = connectSocket(base, { auth: { token: `token-${name}` }, reconnection: false, forceNew: true }); clients.push(socket);
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  return socket;
}
const subscribe = (socket, classId = ids.classroom) => new Promise((resolve, reject) => socket.timeout(3000).emit('presence:subscribe', { classId: String(classId) }, (err, data) => err ? reject(err) : resolve(data)));
const waitUntil = async condition => { for (let i = 0; i < 60; i++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw new Error('Timed out waiting for presence update'); };

test('last-seen data is hidden from ordinary user queries unless explicitly selected', () => {
  const ordinary = NguoiDung.find().select('-mat_khau');
  ordinary._applyPaths();
  assert.equal(ordinary.projection().last_seen_at, 0);
  const presence = NguoiDung.find().select('last_seen_at isActive currentToken');
  presence._applyPaths();
  assert.equal(presence.projection().last_seen_at, 1);
});

test('only authorized class members can subscribe; snapshot includes teacher and approved students without tokens', { skip: !connectSocket }, async () => {
  const teacher = await connect('teacher');
  const snapshot = await subscribe(teacher);
  assert.equal(snapshot.success, true);
  assert.deepEqual(snapshot.items.map(item => item.userId).sort(), [String(ids.teacher), String(ids.alice), String(ids.bob)].sort());
  assert.equal(snapshot.items.find(item => item.userId === String(ids.teacher)).online, true);
  assert.equal(snapshot.items.find(item => item.userId === String(ids.alice)).online, false);
  assert.ok(snapshot.items.every(item => !('currentToken' in item)));
  const outsider = await connect('outsider');
  const pending = await connect('pending');
  assert.equal((await subscribe(outsider)).success, false);
  assert.equal((await subscribe(pending)).success, false);
});
test('multiple tabs remain online until the final valid connection disconnects', { skip: !connectSocket }, async () => {
  const watcher = clients[0]; const received = [];
  watcher.on('presence:update', item => { if (item.userId === String(ids.alice)) received.push(item); });
  writes = [];
  const first = await connect('alice');
  await waitUntil(() => received.some(item => item.online));
  const second = await connect('alice');
  await new Promise(resolve => setTimeout(resolve, 60));
  first.disconnect();
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(received.filter(item => !item.online).length, 0);
  assert.equal(writes.filter(value => value === String(ids.alice)).length, 0);
  second.disconnect();
  await waitUntil(() => received.some(item => !item.online));
  const offline = received.find(item => !item.online);
  assert.ok(offline.lastSeenAt);
  assert.equal(writes.filter(value => value === String(ids.alice)).length, 1);
  const again = await connect('alice');
  await waitUntil(() => received.filter(item => item.online).length === 2);
  const snapshot = await subscribe(watcher);
  assert.equal(snapshot.items.find(item => item.userId === String(ids.alice)).online, true);
  again.disconnect();
});
test('a viewer removed from the class receives no later presence updates', { skip: !connectSocket }, async () => {
  const bob = await connect('bob');
  assert.equal((await subscribe(bob)).success, true);
  const received = [];
  bob.on('presence:update', item => { if (item.userId === String(ids.alice)) received.push(item); });
  members.find(member => String(member.id_hoc_vien) === String(ids.bob)).trang_thai_phe_duyet = 'bi_tu_choi';
  const alice = await connect('alice');
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(received.length, 0);
  assert.equal((await subscribe(bob)).success, false);
  alice.disconnect();
  members.find(member => String(member.id_hoc_vien) === String(ids.bob)).trang_thai_phe_duyet = 'da_tham_gia';
});
test('leaving a class while subscription is pending cannot retain its presence room', { skip: !connectSocket }, async () => {
  const watcher = await connect('teacher');
  const received = [];
  watcher.on('presence:update', item => { if (item.userId === String(ids.alice)) received.push(item); });
  populatedDelay = 100;
  try {
    watcher.emit('presence:subscribe', { classId: String(ids.classroom) }, () => {});
    watcher.emit('presence:unsubscribe', { classId: String(ids.classroom) });
    await new Promise(resolve => setTimeout(resolve, 160));
    const alice = await connect('alice');
    await new Promise(resolve => setTimeout(resolve, 180));
    assert.equal(received.length, 0);
    assert.equal((await subscribe(watcher)).success, true);
    alice.disconnect();
    await waitUntil(() => received.some(item => !item.online));
  } finally { populatedDelay = 0; }
});
