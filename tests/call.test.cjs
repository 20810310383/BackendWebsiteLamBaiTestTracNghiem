const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { RoomServiceClient } = require('livekit-server-sdk');
const auth = require('../src/middlewares/authMiddleware');
const Chat = require('../src/routes/chatRoutes');
const Call = require('../src/models/CallSession');
const User = require('../src/models/NguoiDung');
const id = text => new mongoose.Types.ObjectId(text.repeat(24));
const ids = { caller: id('1'), callee: id('2'), other: id('3'), conversation: id('4'), call: id('5') };
const users = Object.fromEntries(['caller', 'callee', 'other'].map(name => [String(ids[name]), { _id: ids[name], ho_ten: name, role: 'hocsinh', isActive: true }]));
const orig = { protect: auth.protect, access: Chat.accessConversation, emit: Chat.emitToUsers, init: Call.init, find: Call.find, findOne: Call.findOne, exists: Call.exists, create: Call.create, update: Call.findOneAndUpdate, userFind: User.find };
const roomService = { remove: RoomServiceClient.prototype.removeParticipant, delete: RoomServiceClient.prototype.deleteRoom };
let roomActions = [];
RoomServiceClient.prototype.removeParticipant = async (room, identity, options) => { roomActions.push({ action: 'remove', room, identity, cutoff: options.revokeTokenTs }); };
RoomServiceClient.prototype.deleteRoom = async room => { roomActions.push({ action: 'delete', room }); };
auth.protect = (req, res, next) => { req.user = users[req.headers['x-user']]; if (!req.user) return res.sendStatus(401); next(); };
let accessRevoked = false;
Chat.accessConversation = async (conversationId, user) => !accessRevoked && String(conversationId) === String(ids.conversation) && [String(ids.caller), String(ids.callee)].includes(String(user._id)) ? { conversation: { _id: ids.conversation, participants: [ids.caller, ids.callee] }, users: [users[String(ids.caller)], users[String(ids.callee)]] } : null;
let events = [];
Chat.emitToUsers = async (req, targets, event, payload) => { events.push({ targets: targets.map(String), event, payload }); };
const chain = value => ({ select() { return this; }, lean: async () => value });
Call.init = async () => {};
let staleResults = [];
Call.find = () => chain(staleResults);
let stored = null;
let busyHistory = null;
let busyOverride = null;
Call.exists = async filter => busyOverride ? busyOverride[String(filter.participants)] || null : (stored?.active && stored.participants.some(id => String(id) === String(filter.participants)) ? { _id: stored._id } : null);
Call.findOne = filter => chain(stored && String(filter._id || stored._id) === String(stored._id) && (!filter.participants || stored.participants.some(p => String(p) === String(filter.participants))) && (filter.active === undefined || filter.active === stored.active) && (!filter.status || filter.status === stored.status) ? stored : null);
Call.create = async value => { if (value.active === false) { busyHistory = { _id: id('9'), ...value }; return busyHistory; } if (stored?.active) { const e = new Error('duplicate'); e.code = 11000; throw e; } stored = { _id: ids.call, ...value, active: true, status: 'ringing' }; return stored; };
Call.findOneAndUpdate = (filter, update) => {
  const participantFilter = filter.participants?.$in || (filter.participants ? [filter.participants] : []);
  if (!stored || !stored.active || (participantFilter.length && !stored.participants.some(id => participantFilter.some(value => String(id) === String(value)))) || (filter.status && filter.status !== stored.status) || (filter.calleeId && String(filter.calleeId) !== String(stored.calleeId)) || (filter.expiresAt?.$gt && stored.expiresAt <= filter.expiresAt.$gt)) return chain(null);
  Object.assign(stored, update.$set); return chain({ ...stored });
};
User.find = filter => chain(filter._id.$in.map(value => users[String(value)]).filter(Boolean));
const router = require('../src/routes/callRoutes');
let server, base;
before(async () => { const app = express(); app.use(express.json()); app.use('/api/calls', router); await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); }); base = `http://127.0.0.1:${server.address().port}/api/calls`; });
after(async () => { await new Promise(resolve => server.close(resolve)); auth.protect = orig.protect; Chat.accessConversation = orig.access; Chat.emitToUsers = orig.emit; Call.init = orig.init; Call.find = orig.find; Call.findOne = orig.findOne; Call.exists = orig.exists; Call.create = orig.create; Call.findOneAndUpdate = orig.update; User.find = orig.userFind; RoomServiceClient.prototype.removeParticipant = roomService.remove; RoomServiceClient.prototype.deleteRoom = roomService.delete; delete process.env.LIVEKIT_URL; delete process.env.LIVEKIT_API_KEY; delete process.env.LIVEKIT_API_SECRET; });
async function post(path, user, body = {}) { const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-user': String(user) }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() }; }
async function get(path, user) { const response = await fetch(base + path, { headers: { 'x-user': String(user) } }); return { status: response.status, body: await response.json() }; }
test('missing LiveKit configuration fails safely without creating a call', async () => { stored = null; delete process.env.LIVEKIT_URL; assert.equal((await post('/', ids.caller, { conversationId: ids.conversation, mode: 'audio' })).status, 503); assert.equal(stored, null); });
test('only authorized participants can call and no one receives a token before acceptance', async () => {
  process.env.LIVEKIT_URL = 'wss://example.livekit.cloud'; process.env.LIVEKIT_API_KEY = 'test-key'; process.env.LIVEKIT_API_SECRET = 'test-secret'; stored = null; events = [];
  assert.equal((await post('/', ids.other, { conversationId: ids.conversation, mode: 'video' })).status, 403);
  const before = Date.now();
  assert.equal((await post('/', ids.caller, { conversationId: ids.conversation, mode: 'video' })).status, 201);
  assert.ok(stored.expiresAt.getTime() - before >= 60000 && stored.expiresAt.getTime() - before < 62000);
  const ownBusy = await post('/', ids.caller, { conversationId: ids.conversation, mode: 'audio' });
  assert.equal(ownBusy.status, 409); assert.equal(ownBusy.body.code, 'CALLER_BUSY');
  assert.equal((await post(`/${ids.call}/token`, ids.caller)).status, 409);
  assert.equal((await post(`/${ids.call}/accept`, ids.caller)).status, 403);
  assert.equal((await post(`/${ids.call}/accept`, ids.other)).status, 403);
  assert.deepEqual(events[0].targets.sort(), [String(ids.caller), String(ids.callee)].sort());
  assert.equal(events[0].payload.token, undefined);
});
test('a caller receives a specific busy response when only the recipient is busy', async () => {
  busyOverride = { [String(ids.callee)]: { _id: ids.call } };
  try {
    const result = await post('/', ids.caller, { conversationId: ids.conversation, mode: 'audio' });
    assert.equal(result.status, 409);
    assert.equal(result.body.code, 'CALLEE_BUSY');
    assert.equal(result.body.peer._id, String(ids.callee));
    assert.equal(busyHistory.status, 'busy');
    assert.equal(busyHistory.active, false);
    assert.equal(busyHistory.wasAnswered, false);
    assert.ok(events.some(event => event.event === 'chat:call-history'));
  } finally { busyOverride = null; }
});
test('server timer ends an unanswered call and both participants can retrieve the missed status', async () => {
  const previousCall = stored;
  stored = null; staleResults = [];
  const originalTimer = global.setTimeout;
  let expire;
  global.setTimeout = (fn, delay, ...args) => {
    if (delay === 60050) { expire = fn; return { unref() {} }; }
    return originalTimer(fn, delay, ...args);
  };
  try {
    const started = await post('/', ids.caller, { conversationId: ids.conversation, mode: 'audio' });
    assert.equal(started.status, 201);
    assert.equal(typeof expire, 'function');
    stored.expiresAt = new Date(Date.now() - 1);
    staleResults = [stored];
    expire();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stored.status, 'missed');
    assert.equal(stored.active, false);
    staleResults = [];
    assert.equal((await get(`/current?callId=${ids.call}`, ids.caller)).body.call.status, 'missed');
    assert.equal((await get(`/current?callId=${ids.call}`, ids.callee)).body.call.status, 'missed');
    assert.equal((await get(`/current?callId=${ids.call}`, ids.other)).body.call, null);
  } finally { global.setTimeout = originalTimer; staleResults = []; stored = previousCall; }
});
test('accepted call issues short room-scoped tokens to each participant only', async () => {
  assert.equal((await post(`/${ids.call}/accept`, ids.callee)).status, 200);
  assert.ok(stored.acceptedAt instanceof Date);
  assert.equal(stored.wasAnswered, true);
  assert.equal((await post(`/${ids.call}/token`, ids.other)).status, 403);
  const response = await post(`/${ids.call}/token`, ids.caller);
  assert.equal(response.status, 200);
  const decoded = jwt.verify(response.body.token, 'test-secret');
  assert.equal(decoded.sub, String(ids.caller)); assert.equal(decoded.video.room, `call-${ids.call}`); assert.equal(decoded.video.roomJoin, true);
  assert.ok(decoded.exp - decoded.nbf <= 301);
});
test('participant-only hangup ends the session and blocks new tokens', async () => {
  roomActions = [];
  assert.equal((await post(`/${ids.call}/end`, ids.other)).status, 403);
  assert.equal((await post(`/${ids.call}/end`, ids.caller)).status, 200);
  assert.equal((await post(`/${ids.call}/token`, ids.callee)).status, 409);
  assert.equal(stored.active, false);
  assert.ok(stored.endedAt instanceof Date);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(roomActions.filter(action => action.action === 'remove').length, 2);
  assert.ok(roomActions.some(action => action.action === 'delete'));
});
test('schema enforces a unique active call per participant', () => {
  assert.ok(Call.schema.indexes().some(([fields, options]) => fields.participants === 1 && options.unique && options.partialFilterExpression?.active === true));
});
test('a timed-out invitation cannot be accepted or used to obtain a token', async () => {
  stored = null;
  assert.equal((await post('/', ids.caller, { conversationId: ids.conversation, mode: 'audio' })).status, 201);
  stored.expiresAt = new Date(Date.now() - 1000);
  assert.equal((await post(`/${ids.call}/accept`, ids.callee)).status, 409);
  assert.equal((await post(`/${ids.call}/token`, ids.callee)).status, 409);
});
test('the recipient can decline a ringing call and tokens stay unavailable', async () => {
  stored = null;
  assert.equal((await post('/', ids.caller, { conversationId: ids.conversation, mode: 'audio' })).status, 201);
  const result = await post(`/${ids.call}/end`, ids.callee);
  assert.equal(result.status, 200);
  assert.equal(result.body.call.status, 'declined');
  assert.equal((await post(`/${ids.call}/token`, ids.caller)).status, 409);
});
test('losing shared-class access stops an accepted call on heartbeat', async () => {
  stored = null; accessRevoked = false;
  assert.equal((await post('/', ids.caller, { conversationId: ids.conversation, mode: 'video' })).status, 201);
  assert.equal((await post(`/${ids.call}/accept`, ids.callee)).status, 200);
  accessRevoked = true;
  try {
    assert.equal((await post(`/${ids.call}/heartbeat`, ids.caller)).status, 403);
    assert.equal(stored.active, false);
    assert.equal(stored.status, 'ended');
  } finally { accessRevoked = false; }
});
