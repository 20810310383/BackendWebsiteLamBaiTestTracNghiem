const express = require('express');
const mongoose = require('mongoose');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const { protect } = require('../middlewares/authMiddleware');
const NguoiDung = require('../models/NguoiDung');
const Call = require('../models/CallSession');
const { accessConversation, emitToUsers } = require('./chatRoutes');
const router = express.Router();
router.use(protect);
const RING_MS = 60000;
const STALE_MS = 90000;
const SESSION_GRACE_MS = 2 * 60 * 60 * 1000;
const peerData = user => user ? ({ _id: user._id, ho_ten: user.ho_ten, anh_dai_dien: user.anh_dai_dien }) : null;
const config = () => {
  const { LIVEKIT_URL: url, LIVEKIT_API_KEY: key, LIVEKIT_API_SECRET: secret } = process.env;
  if (!url || !key || !secret || !/^wss:\/\//i.test(url)) return null;
  return { url, key, secret };
};
const publicCall = (call, users) => ({ _id: call._id, conversationId: call.conversationId, callerId: call.callerId, calleeId: call.calleeId, mode: call.mode, status: call.status, expiresAt: call.expiresAt, caller: peerData(users.find(user => String(user._id) === String(call.callerId))), callee: peerData(users.find(user => String(user._id) === String(call.calleeId))) });
const notify = (req, call, users) => emitToUsers(req, call.participants, 'call:update', publicCall(call, users)).catch(error => console.error('Call notification error:', error));
const closeRoom = async call => {
  const settings = config();
  if (!settings || call.status !== 'ended') return;
  try {
    const service = new RoomServiceClient(settings.url.replace(/^wss:/i, 'https:'), settings.key, settings.secret);
    const room = `call-${call._id}`;
    await Promise.allSettled(call.participants.map(id => service.removeParticipant(room, String(id), { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1) })));
    await service.deleteRoom(room);
  }
  catch (error) { console.warn('Không thể đóng phòng LiveKit:', error.message); }
};
const findUsers = call => NguoiDung.find({ _id: { $in: call.participants } }).select('ho_ten anh_dai_dien role isActive').lean();
async function expireStale(req, participants) {
  const now = new Date();
  const stale = new Date(Date.now() - STALE_MS);
  const filter = { active: true, participants: { $in: participants }, $or: [
    { expiresAt: { $lte: now } },
    { status: 'accepted', callerHeartbeat: { $lt: stale } },
    { status: 'accepted', calleeHeartbeat: { $lt: stale } },
  ] };
  const calls = await Call.find(filter).lean();
  for (const call of calls) {
    const ended = await Call.findOneAndUpdate({ _id: call._id, ...filter }, { $set: { active: false, status: call.status === 'ringing' ? 'missed' : 'ended', endedAt: now, wasAnswered: call.status === 'accepted', durationApproximate: call.status === 'accepted' } }, { new: true }).lean();
    if (ended) { const users = await findUsers(ended); notify(req, ended, users); void closeRoom(ended); }
  }
}
async function authorizedCall(id, user) {
  if (!mongoose.isValidObjectId(id)) return null;
  const call = await Call.findOne({ _id: id, participants: user._id }).lean();
  if (!call) return null;
  const access = await accessConversation(call.conversationId, user);
  if (!access || !access.users.every(person => call.participants.some(participant => String(participant) === String(person._id)))) return null;
  return { call, users: access.users };
}
async function endIfAccessRevoked(req, id) {
  if (!mongoose.isValidObjectId(id)) return;
  const call = await Call.findOneAndUpdate({ _id: id, participants: req.user._id, active: true }, { $set: { active: false, status: 'ended', endedAt: new Date() } }, { new: true }).lean();
  if (call) { const users = await findUsers(call); notify(req, call, users); void closeRoom(call); }
}
function error(res, err) { console.error('Call error:', err); res.status(500).json({ message: 'Không thể xử lý cuộc gọi. Vui lòng thử lại.' }); }
router.post('/', async (req, res) => {
  try {
    if (!config()) return res.status(503).json({ message: 'Chưa cấu hình LiveKit trên máy chủ' });
    const { conversationId, mode } = req.body;
    if (!['audio', 'video'].includes(mode)) return res.status(400).json({ message: 'Loại cuộc gọi không hợp lệ' });
    const access = await accessConversation(conversationId, req.user);
    if (!access) return res.status(403).json({ message: 'Không có quyền gọi người này' });
    const participants = access.conversation.participants;
    const calleeId = participants.find(id => String(id) !== String(req.user._id));
    await Call.init();
    await expireStale(req, participants);
    let call;
    try { call = await Call.create({ conversationId: access.conversation._id, participants, callerId: req.user._id, calleeId, mode, expiresAt: new Date(Date.now() + RING_MS) }); }
    catch (err) {
      if (err.code !== 11000) throw err;
      const [callerBusy, calleeBusy] = await Promise.all([
        Call.exists({ participants: req.user._id, active: true }),
        Call.exists({ participants: calleeId, active: true }),
      ]);
      if (!callerBusy && calleeBusy) {
        const now = new Date();
        try {
          const attempted = await Call.create({ conversationId: access.conversation._id, participants, callerId: req.user._id, calleeId, mode, active: false, status: 'busy', expiresAt: now, endedAt: now, wasAnswered: false });
          emitToUsers(req, participants, 'chat:call-history', { conversationId: access.conversation._id, callId: attempted._id }).catch(error => console.error('Call history notification error:', error));
        } catch (historyError) { console.error('Call history error:', historyError); }
        return res.status(409).json({ code: 'CALLEE_BUSY', message: 'Người nhận đang bận trong cuộc gọi khác', peer: peerData(access.users.find(user => String(user._id) === String(calleeId))) });
      }
      if (callerBusy) return res.status(409).json({ code: 'CALLER_BUSY', message: 'Bạn đang trong một cuộc gọi khác' });
      return res.status(409).json({ code: 'CALL_CONFLICT', message: 'Không thể bắt đầu cuộc gọi. Vui lòng thử lại.' });
    }
    notify(req, call, access.users);
    const app = req.app;
    const timer = setTimeout(() => {
      expireStale({ app }, participants).catch(err => console.error('Call timeout error:', err));
    }, RING_MS + 50);
    timer.unref();
    res.status(201).json({ call: publicCall(call, access.users) });
  } catch (err) { error(res, err); }
});
router.get('/current', async (req, res) => {
  try {
    const { callId } = req.query;
    if (callId && !mongoose.isValidObjectId(callId)) return res.status(400).json({ message: 'Cuộc gọi không hợp lệ' });
    await expireStale(req, [req.user._id]);
    const call = await Call.findOne(callId ? { _id: callId, participants: req.user._id } : { participants: req.user._id, active: true }).lean();
    if (!call) return res.json({ call: null });
    const access = await authorizedCall(call._id, req.user);
    if (!access) {
      const ended = await Call.findOneAndUpdate({ _id: call._id, active: true }, { $set: { active: false, status: 'ended', endedAt: new Date() } }, { new: true }).lean();
      if (ended) { const users = await findUsers(ended); notify(req, ended, users); void closeRoom(ended); }
      return res.json({ call: null });
    }
    res.json({ call: publicCall(access.call, access.users) });
  } catch (err) { error(res, err); }
});
router.post('/:id/accept', async (req, res) => {
  try {
    const access = await authorizedCall(req.params.id, req.user);
    if (!access || String(access.call.calleeId) !== String(req.user._id)) return res.status(403).json({ message: 'Không có quyền nhận cuộc gọi này' });
    const now = new Date();
    const call = await Call.findOneAndUpdate({ _id: access.call._id, calleeId: req.user._id, active: true, status: 'ringing', expiresAt: { $gt: now } }, { $set: { status: 'accepted', acceptedAt: now, wasAnswered: true, expiresAt: new Date(Date.now() + SESSION_GRACE_MS), callerHeartbeat: now, calleeHeartbeat: now } }, { new: true }).lean();
    if (!call) return res.status(409).json({ message: 'Cuộc gọi đã kết thúc hoặc hết thời gian' });
    notify(req, call, access.users);
    res.json({ call: publicCall(call, access.users) });
  } catch (err) { error(res, err); }
});
router.post('/:id/token', async (req, res) => {
  try {
    const settings = config();
    if (!settings) return res.status(503).json({ message: 'Chưa cấu hình LiveKit trên máy chủ' });
    const access = await authorizedCall(req.params.id, req.user);
    if (!access) { await endIfAccessRevoked(req, req.params.id); return res.status(403).json({ message: 'Không có quyền vào cuộc gọi' }); }
    const call = await Call.findOne({ _id: access.call._id, active: true, status: 'accepted', expiresAt: { $gt: new Date() } }).lean();
    if (!call) return res.status(409).json({ message: 'Cuộc gọi chưa được chấp nhận hoặc đã kết thúc' });
    const token = new AccessToken(settings.key, settings.secret, { identity: String(req.user._id), ttl: '5m' });
    token.addGrant({ roomJoin: true, room: `call-${call._id}`, canPublish: true, canSubscribe: true, canPublishData: false });
    res.set('Cache-Control', 'no-store').json({ url: settings.url, token: await token.toJwt() });
  } catch (err) { error(res, err); }
});
router.post('/:id/heartbeat', async (req, res) => {
  try {
    const access = await authorizedCall(req.params.id, req.user);
    if (!access) { await endIfAccessRevoked(req, req.params.id); return res.status(403).json({ message: 'Không có quyền vào cuộc gọi' }); }
    await expireStale(req, access.call.participants);
    const field = String(access.call.callerId) === String(req.user._id) ? 'callerHeartbeat' : 'calleeHeartbeat';
    const call = await Call.findOneAndUpdate({ _id: access.call._id, active: true, status: 'accepted', expiresAt: { $gt: new Date() } }, { $set: { [field]: new Date(), expiresAt: new Date(Date.now() + SESSION_GRACE_MS) } }, { new: true }).lean();
    if (!call) return res.status(409).json({ message: 'Cuộc gọi đã kết thúc' });
    res.json({ call: publicCall(call, access.users) });
  } catch (err) { error(res, err); }
});
router.post('/:id/end', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Cuộc gọi không hợp lệ' });
    const existing = await Call.findOne({ _id: req.params.id, participants: req.user._id }).lean();
    if (!existing) return res.status(403).json({ message: 'Không có quyền kết thúc cuộc gọi' });
    const isCallee = String(existing.calleeId) === String(req.user._id);
    const status = existing.status === 'ringing' && isCallee ? 'declined' : 'ended';
    const call = await Call.findOneAndUpdate({ _id: existing._id, active: true, status: existing.status }, { $set: { active: false, status, endedBy: req.user._id, endedAt: new Date(), wasAnswered: existing.status === 'accepted' } }, { new: true }).lean();
    if (!call) return res.status(409).json({ message: 'Cuộc gọi đã kết thúc' });
    const users = await findUsers(call);
    notify(req, call, users);
    if (status === 'ended') void closeRoom(call);
    res.json({ call: publicCall(call, users) });
  } catch (err) { error(res, err); }
});
module.exports = router;
