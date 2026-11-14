const { test, after, before } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
let connectSocket;
try { ({ io: connectSocket } = require('socket.io-client')); }
catch { try { ({ io: connectSocket } = require('../../GiaoDienWebsiteLamBaiTest2026/node_modules/socket.io-client')); } catch { /* The live test requires a Socket.IO client. */ } }
const auth = require('../src/middlewares/authMiddleware');
const LopHoc = require('../src/models/LopHoc');
const NguoiDung = require('../src/models/NguoiDung');
const Conversation = require('../src/models/ChatConversation');
const Message = require('../src/models/ChatMessage');
const id = text => new mongoose.Types.ObjectId(text.repeat(24));
const ids = { classA: id('a'), classB: id('b'), alice: id('1'), bob: id('2'), outsider: id('3'), teacher: id('4'), conversation: id('5'), message: id('6') };
const users = Object.fromEntries(['alice', 'bob', 'outsider', 'teacher'].map(name => [String(ids[name]), { _id: ids[name], ho_ten: name, role: name === 'teacher' ? 'giaovien' : 'hocsinh', isActive: true }]));
const classes = {
  [String(ids.classA)]: { _id: ids.classA, ten_lop: 'A', id_giaovien: ids.teacher, danh_sach_hoc_vien: [ids.alice, ids.bob].map(id => ({ id_hoc_vien: id, trang_thai_phe_duyet: 'da_tham_gia' })) },
  [String(ids.classB)]: { _id: ids.classB, ten_lop: 'B', id_giaovien: ids.teacher, danh_sach_hoc_vien: [...[ids.alice, ids.bob].map(id => ({ id_hoc_vien: id, trang_thai_phe_duyet: 'da_tham_gia' })), { id_hoc_vien: ids.outsider, trang_thai_phe_duyet: 'cho_phe_duyet' }] },
};
const originals = { protect: auth.protect, classFind: LopHoc.findById, classExists: LopHoc.exists, userFindById: NguoiDung.findById, userFind: NguoiDung.find, conversationFind: Conversation.find, conversationFindOne: Conversation.findOne, conversationFindById: Conversation.findById, conversationUpsert: Conversation.findOneAndUpdate, conversationUpdate: Conversation.updateOne, messageUpsert: Message.findOneAndUpdate, messageUpdate: Message.updateMany, messageFind: Message.find, messageFindOne: Message.findOne, messageCount: Message.countDocuments };
auth.protect = (req, res, next) => { req.user = users[req.headers['x-user']]; if (!req.user) return res.sendStatus(401); next(); };
const lean = value => ({ select() { return this; }, lean: async () => value });
LopHoc.findById = value => lean(classes[String(value)] || null);
LopHoc.exists = async query => Object.values(classes).some(classroom => (query.$and || []).every(condition => condition.id_giaovien ? String(classroom.id_giaovien) === String(condition.id_giaovien) : classroom.danh_sach_hoc_vien.some(member => String(member.id_hoc_vien) === String(condition.danh_sach_hoc_vien.$elemMatch.id_hoc_vien) && member.trang_thai_phe_duyet === 'da_tham_gia')));
NguoiDung.findById = value => lean(users[String(value)] || null);
NguoiDung.find = query => lean((query._id.$in || []).map(value => users[String(value)]).filter(Boolean));
let conversation = { _id: ids.conversation, classId: ids.classA, participants: [ids.alice, ids.bob], pairKey: [String(ids.alice), String(ids.bob)].sort().join(':') };
Conversation.findById = value => lean(String(value) === String(ids.conversation) ? conversation : null);
const oldThreadId = id('7');
Conversation.find = query => lean(query.pairKey ? [{ _id: ids.conversation }, { _id: oldThreadId }] : [conversation]);
Conversation.findOne = () => lean(null);
let upserts = [];
Conversation.findOneAndUpdate = (filter, update) => { upserts.push({ filter, update }); return lean({ _id: ids.conversation, ...update.$setOnInsert }); };
Conversation.updateOne = async () => ({});
let storedMessage;
Message.findOneAndUpdate = (filter, update) => { storedMessage ||= { _id: ids.message, ...update.$setOnInsert, createdAt: new Date(), deliveredAt: null, seenAt: null }; return lean(storedMessage); };
let receiptFilters = [];
Message.updateMany = async (filter, update) => { receiptFilters.push({ filter, update }); return { modifiedCount: 1 }; };
Message.find = filter => lean(filter.recipientId && String(filter.recipientId) === String(ids.bob) ? [{ _id: ids.message, deliveredAt: new Date(), seenAt: null }] : []);
const cursorTime = new Date('2026-11-14T01:00:00Z');
Message.findOne = filter => lean(String(filter._id) === String(ids.message) ? { _id: ids.message, createdAt: cursorTime } : null);
Message.countDocuments = async () => 0;
const router = require('../src/routes/chatRoutes');
let server, base, app;
before(async () => { app = express(); app.use(express.json()); app.use('/api/chat', router); await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); }); base = `http://127.0.0.1:${server.address().port}/api/chat`; });
after(async () => { await new Promise(resolve => server.close(resolve)); auth.protect = originals.protect; LopHoc.findById = originals.classFind; LopHoc.exists = originals.classExists; NguoiDung.findById = originals.userFindById; NguoiDung.find = originals.userFind; Conversation.find = originals.conversationFind; Conversation.findOne = originals.conversationFindOne; Conversation.findById = originals.conversationFindById; Conversation.findOneAndUpdate = originals.conversationUpsert; Conversation.updateOne = originals.conversationUpdate; Message.findOneAndUpdate = originals.messageUpsert; Message.updateMany = originals.messageUpdate; Message.find = originals.messageFind; Message.findOne = originals.messageFindOne; Message.countDocuments = originals.messageCount; });
async function post(path, user, body) { const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user': String(user) }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() }; }
async function get(path, user) { const response = await fetch(base + path, { headers: { 'x-user': String(user) } }); return { status: response.status, body: await response.json() }; }
test('participants share one pair across classes; teacher can contact a student', async () => {
  upserts = [];
  assert.equal((await post('/conversations', ids.alice, { classId: ids.classA, recipientId: ids.bob })).status, 200);
  assert.equal((await post('/conversations', ids.bob, { classId: ids.classA, recipientId: ids.alice })).status, 200);
  assert.equal(upserts[0].filter.pairKey, upserts[1].filter.pairKey);
  assert.equal((await post('/conversations', ids.alice, { classId: ids.classB, recipientId: ids.bob })).status, 200);
  assert.deepEqual(upserts[0].filter, upserts[2].filter);
  assert.equal((await post('/conversations', ids.teacher, { classId: ids.classA, recipientId: ids.alice })).status, 200);
  assert.equal(upserts[3].filter.classId, null);
  assert.equal((await post('/conversations', ids.teacher, { classId: ids.classB, recipientId: ids.alice })).status, 200);
  assert.deepEqual(upserts[3].filter, upserts[4].filter);
});
test('outsiders, unapproved students, and self-chat cannot open conversations', async () => {
  assert.equal((await post('/conversations', ids.outsider, { classId: ids.classA, recipientId: ids.alice })).status, 403);
  assert.equal((await post('/conversations', ids.teacher, { classId: ids.classB, recipientId: ids.outsider })).status, 403);
  assert.equal((await post('/conversations', ids.alice, { classId: ids.classA, recipientId: ids.alice })).status, 400);
});
test('history includes legacy threads across classes and preserves their original message IDs', async () => {
  const previousFind = Message.find;
  let filter;
  const oldMessage = { _id: ids.message, conversationId: oldThreadId, text: 'Cũ' };
  Message.find = query => { filter = query; return { sort() { return this; }, limit() { return this; }, async lean() { return [oldMessage]; } }; };
  try {
    const result = await get(`/conversations/${ids.conversation}/messages`, ids.alice);
    assert.equal(result.status, 200);
    assert.deepEqual(filter.conversationId.$in.map(String), [String(ids.conversation), String(oldThreadId)]);
    assert.equal(result.body.items[0].text, 'Cũ');
    assert.equal(result.body.items[0]._id, String(ids.message));
  } finally { Message.find = previousFind; }
});
test('access ends when the pair no longer shares an approved class', async () => {
  const a = classes[String(ids.classA)].danh_sach_hoc_vien;
  const b = classes[String(ids.classB)].danh_sach_hoc_vien;
  const members = [...a, ...b].filter(member => String(member.id_hoc_vien) === String(ids.bob));
  members.forEach(member => { member.trang_thai_phe_duyet = 'bi_tu_choi'; });
  try { assert.equal((await get(`/conversations/${ids.conversation}/messages`, ids.alice)).status, 403); }
  finally { members.forEach(member => { member.trang_thai_phe_duyet = 'da_tham_gia'; }); }
});
test('messages are scoped to participants and retries preserve the original message', async () => {
  storedMessage = null;
  const path = `/conversations/${ids.conversation}/messages`;
  assert.equal((await post(path, ids.outsider, { text: 'test', clientId: 'client-1' })).status, 403);
  const first = await post(path, ids.alice, { text: 'hello', clientId: 'client-1' });
  const retry = await post(path, ids.alice, { text: 'hello', clientId: 'client-1' });
  assert.equal(first.status, 200); assert.equal(String(first.body.message.recipientId), String(ids.bob));
  assert.equal(String(first.body.message._id), String(retry.body.message._id));
});
test('read receipts are restricted to the authenticated recipient and conversation', async () => {
  receiptFilters = [];
  const path = `/conversations/${ids.conversation}/receipt`;
  assert.equal((await post(path, ids.outsider, { messageIds: [ids.message], seen: true })).status, 403);
  assert.equal((await post(path, ids.bob, { messageIds: [ids.message], seen: true })).status, 200);
  assert.equal(receiptFilters.length, 2);
  for (const entry of receiptFilters) { assert.equal(String(entry.filter.recipientId), String(ids.bob)); assert.deepEqual(entry.filter.conversationId.$in.map(String), [String(ids.conversation), String(oldThreadId)]); }
});
test('reading marks all incoming messages through the viewed cursor, including older threads', async () => {
  receiptFilters = [];
  const path = `/conversations/${ids.conversation}/read`;
  assert.equal((await post(path, ids.outsider, { through: ids.message })).status, 403);
  const result = await post(path, ids.bob, { through: ids.message });
  assert.equal(result.status, 200);
  assert.equal(result.body.unread, 0);
  assert.equal(receiptFilters.length, 2);
  for (const entry of receiptFilters) {
    assert.equal(String(entry.filter.recipientId), String(ids.bob));
    assert.deepEqual(entry.filter.conversationId.$in.map(String), [String(ids.conversation), String(oldThreadId)]);
    assert.equal(entry.filter.$or[0].createdAt.$lt.toISOString(), cursorTime.toISOString());
    assert.equal(String(entry.filter.$or[1]._id.$lte), String(ids.message));
  }
  assert.equal((await post(path, ids.bob, { through: id('8') })).status, 400);
});
test('socket events reach only authenticated devices of the two participants', async () => {
  const oldSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = 'chat-test-secret';
  const events = [];
  const sockets = {};
  for (const name of ['alice', 'bob', 'outsider']) {
    const token = jwt.sign({ id: String(ids[name]) }, process.env.JWT_ACCESS_SECRET);
    users[String(ids[name])].currentToken = token;
    sockets[String(ids[name])] = [{ handshake: { auth: { token } }, emit: (event, payload) => events.push({ user: name, event, payload }), disconnect() { throw new Error('valid socket disconnected'); } }];
  }
  let disconnected = false;
  sockets[String(ids.bob)].push({ handshake: { auth: { token: 'revoked' } }, emit() { throw new Error('revoked socket received message'); }, disconnect() { disconnected = true; } });
  app.set('socketio', { in: room => ({ fetchSockets: async () => sockets[room.slice(5)] || [] }) });
  storedMessage = null;
  const response = await post(`/conversations/${ids.conversation}/messages`, ids.alice, { text: 'private', clientId: 'test-socket' });
  assert.equal(response.status, 200);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(events.map(event => event.user).sort(), ['alice', 'bob']);
  assert.ok(events.every(event => event.event === 'chat:message' && String(event.payload.conversationId) === String(ids.conversation)));
  assert.equal(disconnected, true);
  app.set('socketio', null);
  if (oldSecret === undefined) delete process.env.JWT_ACCESS_SECRET; else process.env.JWT_ACCESS_SECRET = oldSecret;
});
test('a saved message is delivered over real Socket.IO only to its participants', { skip: !connectSocket }, async () => {
  const oldSecret = process.env.JWT_ACCESS_SECRET;
  const oldBase = base;
  process.env.JWT_ACCESS_SECRET = 'chat-live-test-secret';
  const liveServer = http.createServer(app);
  const io = new Server(liveServer);
  io.use((socket, next) => {
    try { socket.data.id = jwt.verify(socket.handshake.auth.token, process.env.JWT_ACCESS_SECRET).id; next(); }
    catch { next(new Error('Unauthorized')); }
  });
  io.on('connection', socket => socket.join(`user:${socket.data.id}`));
  app.set('socketio', io);
  await new Promise(resolve => liveServer.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${liveServer.address().port}/api/chat`;
  const clients = [];
  try {
    for (const name of ['alice', 'bob', 'outsider']) {
      const token = jwt.sign({ id: String(ids[name]) }, process.env.JWT_ACCESS_SECRET);
      users[String(ids[name])].currentToken = token;
      const client = connectSocket(`http://127.0.0.1:${liveServer.address().port}`, { auth: { token }, reconnection: false });
      clients.push(client);
      await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
    }
    const events = [];
    clients.forEach((client, index) => client.on('chat:message', payload => events.push({ index, payload })));
    storedMessage = null;
    const response = await post(`/conversations/${ids.conversation}/messages`, ids.alice, { text: 'realtime', clientId: 'live-socket' });
    assert.equal(response.status, 200);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.deepEqual(events.map(event => event.index).sort(), [0, 1]);
    assert.ok(events.every(event => event.payload.message.text === 'realtime'));
  } finally {
    clients.forEach(client => client.disconnect());
    await new Promise(resolve => io.close(resolve));
    base = oldBase;
    app.set('socketio', null);
    if (oldSecret === undefined) delete process.env.JWT_ACCESS_SECRET; else process.env.JWT_ACCESS_SECRET = oldSecret;
  }
});
