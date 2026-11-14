const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { protect } = require('../middlewares/authMiddleware');
const LopHoc = require('../models/LopHoc');
const NguoiDung = require('../models/NguoiDung');
const Conversation = require('../models/ChatConversation');
const Message = require('../models/ChatMessage');
const Call = require('../models/CallSession');
const router = express.Router();
router.use(protect);
const validId = value => mongoose.isValidObjectId(value);
const canAccess = (classroom, user) => Boolean(classroom && user && user.isActive && (
  user.role === 'admin' || (user.role === 'giaovien' && String(classroom.id_giaovien) === String(user._id)) ||
  (user.role === 'hocsinh' && classroom.danh_sach_hoc_vien.some(member => String(member.id_hoc_vien) === String(user._id) && member.trang_thai_phe_duyet === 'da_tham_gia'))
));
const serializeUser = user => ({ _id: user._id, ho_ten: user.ho_ten, ma_so: user.ma_so, anh_dai_dien: user.anh_dai_dien, role: user.role });
const completedCalls = ['ended', 'missed', 'declined', 'busy'];
const serializeCall = call => ({
  _id: call._id, type: 'call', conversationId: call.conversationId,
  callerId: call.callerId, calleeId: call.calleeId, mode: call.mode,
  status: call.status, createdAt: call.createdAt, acceptedAt: call.acceptedAt,
  endedAt: call.endedAt, endedBy: call.endedBy, wasAnswered: call.wasAnswered, durationApproximate: Boolean(call.durationApproximate),
  durationSeconds: call.acceptedAt && call.endedAt ? Math.max(0, Math.floor((new Date(call.endedAt) - new Date(call.acceptedAt)) / 1000)) : null,
});
const compareRecent = (a, b) => new Date(b.createdAt) - new Date(a.createdAt) || String(b._id).localeCompare(String(a._id)) || Number(b.type === 'call') - Number(a.type === 'call');
async function sharedConversation(pairKey, participants) {
  const filter = { classId: null, pairKey };
  const existing = await Conversation.findOne(filter).lean();
  if (existing) return existing;
  try {
    return await Conversation.findOneAndUpdate(filter, { $setOnInsert: { classId: null, pairKey, participants } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Conversation.findOne(filter).lean();
  }
}
async function shareAClass(users) {
  const conditions = [];
  for (const user of users) {
    if (!user.isActive) return false;
    if (user.role === 'admin') continue;
    if (user.role === 'giaovien') conditions.push({ id_giaovien: user._id });
    else if (user.role === 'hocsinh') conditions.push({ danh_sach_hoc_vien: { $elemMatch: { id_hoc_vien: user._id, trang_thai_phe_duyet: 'da_tham_gia' } } });
    else return false;
  }
  return Boolean(await LopHoc.exists(conditions.length ? { $and: conditions } : {}));
}
async function accessConversation(id, user) {
  if (!validId(id)) return null;
  const conversation = await Conversation.findById(id).lean();
  if (!conversation || !conversation.participants.some(id => String(id) === String(user._id))) return null;
  const users = await NguoiDung.find({ _id: { $in: conversation.participants } }).select('ho_ten ma_so anh_dai_dien role isActive').lean();
  if (users.length !== 2 || !(await shareAClass(users))) return null;
  const participants = users.map(participant => String(participant._id)).sort();
  const pairKey = participants.join(':');
  if (conversation.pairKey !== pairKey) return null;
  const shared = await sharedConversation(pairKey, participants);
  const threads = await Conversation.find({ pairKey, participants: { $all: participants, $size: 2 } }).select('_id').lean();
  return { conversation: shared, conversationIds: threads.map(thread => thread._id), users };
}
async function emit(req, users, event, payload) {
  const io = req.app.get('socketio');
  if (!io) return;
  const accounts = await NguoiDung.find({ _id: { $in: users }, isActive: true }).select('currentToken').lean();
  await Promise.all(accounts.map(async account => {
    const sockets = await io.in(`user:${account._id}`).fetchSockets();
    for (const socket of sockets) {
      const token = socket.handshake.auth?.token;
      try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        if (String(decoded.id) === String(account._id) && token === account.currentToken) socket.emit(event, payload);
        else socket.disconnect(true);
      } catch { socket.disconnect(true); }
    }
  }));
}
function emitLater(req, users, event, payload) {
  emit(req, users, event, payload).catch(error => console.error('Chat realtime error:', error));
}
function handleError(res, error) { console.error('Chat error:', error); res.status(500).json({ message: 'Không thể xử lý tin nhắn. Vui lòng thử lại.' }); }
router.post('/conversations', async (req, res) => {
  try {
    const { classId, recipientId } = req.body;
    if (!validId(classId) || !validId(recipientId) || String(recipientId) === String(req.user._id)) return res.status(400).json({ message: 'Thông tin người nhận không hợp lệ' });
    const [classroom, recipient] = await Promise.all([LopHoc.findById(classId).lean(), NguoiDung.findById(recipientId).select('ho_ten ma_so anh_dai_dien role isActive').lean()]);
    if (!canAccess(classroom, req.user) || !canAccess(classroom, recipient)) return res.status(403).json({ message: 'Bạn không có quyền nhắn tin trong lớp này' });
    const participants = [String(req.user._id), String(recipientId)].sort();
    const pairKey = participants.join(':');
    const conversation = await sharedConversation(pairKey, participants);
    res.json({ conversationId: conversation._id, className: 'Tin nhắn riêng', peer: serializeUser(recipient) });
  } catch (error) { handleError(res, error); }
});
router.post('/deliver-pending', async (req, res) => {
  try {
    const { cursor } = req.body;
    if (cursor && !validId(cursor)) return res.status(400).json({ message: 'Mốc tin nhắn không hợp lệ' });
    const pendingQuery = { recipientId: req.user._id, deliveredAt: null };
    if (cursor) pendingQuery._id = { $gt: cursor };
    const pending = await Message.find(pendingQuery).select('_id conversationId').sort({ _id: 1 }).limit(1000).lean();
    const groups = new Map();
    for (const item of pending) {
      const key = String(item.conversationId);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item._id);
    }
    for (const [id, ids] of groups) {
      const access = await accessConversation(id, req.user);
      if (!access) continue;
      await Message.updateMany({ _id: { $in: ids }, recipientId: req.user._id, deliveredAt: null }, { $set: { deliveredAt: new Date() } });
      const messages = await Message.find({ _id: { $in: ids }, recipientId: req.user._id }).select('_id deliveredAt seenAt').lean();
      await emit(req, access.conversation.participants, 'chat:receipt', { conversationId: access.conversation._id, messages });
    }
    res.json({ success: true, nextCursor: pending.length === 1000 ? pending[pending.length - 1]._id : null });
  } catch (error) { handleError(res, error); }
});
router.get('/conversations', async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id }).sort({ lastMessageAt: -1 }).lean();
    const unique = [...new Map(conversations.map(conversation => [conversation.pairKey, conversation])).values()];
    const items = await Promise.all(unique.map(async conversation => {
      const access = await accessConversation(conversation._id, req.user);
      if (!access) return null;
      const messageQuery = { conversationId: { $in: access.conversationIds } };
      const [lastText, lastCall, unread] = await Promise.all([
        Message.findOne(messageQuery).sort({ createdAt: -1, _id: -1 }).lean(),
        Call.findOne({ ...messageQuery, participants: req.user._id, status: { $in: completedCalls } }).sort({ createdAt: -1, _id: -1 }).lean(),
        Message.countDocuments({ ...messageQuery, recipientId: req.user._id, seenAt: null }),
      ]);
      const lastMessage = [lastText, lastCall && serializeCall(lastCall)].filter(Boolean).sort(compareRecent)[0];
      if (!lastMessage) return null;
      return { conversationId: access.conversation._id, className: 'Tin nhắn riêng', peer: serializeUser(access.users.find(user => String(user._id) !== String(req.user._id))), lastMessage, unread };
    }));
    res.json({ items: items.filter(Boolean).sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)).slice(0, 100) });
  } catch (error) { handleError(res, error); }
});
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const access = await accessConversation(req.params.id, req.user);
    if (!access) return res.status(403).json({ message: 'Không thể truy cập cuộc trò chuyện' });
    const query = { conversationId: { $in: access.conversationIds } };
    const callQuery = { ...query, participants: req.user._id, status: { $in: completedCalls } };
    if (req.query.before) {
      if (!validId(req.query.before)) return res.status(400).json({ message: 'Mốc tin nhắn không hợp lệ' });
      if (req.query.beforeType && !['message', 'call'].includes(req.query.beforeType)) return res.status(400).json({ message: 'Loại mốc không hợp lệ' });
      const cursor = req.query.beforeType === 'call'
        ? await Call.findOne({ _id: req.query.before, ...callQuery }).lean()
        : await Message.findOne({ _id: req.query.before, ...query }).lean();
      if (!cursor) return res.status(400).json({ message: 'Không tìm thấy mốc tin nhắn' });
      query.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }];
      callQuery.$or = [...query.$or];
      if (req.query.beforeType === 'call') query.$or.push({ createdAt: cursor.createdAt, _id: cursor._id });
    }
    const [messages, calls] = await Promise.all([
      Message.find(query).sort({ createdAt: -1, _id: -1 }).limit(51).lean(),
      Call.find(callQuery).sort({ createdAt: -1, _id: -1 }).limit(51).lean(),
    ]);
    const combined = [...messages, ...calls.map(serializeCall)].sort(compareRecent);
    res.json({ items: combined.slice(0, 50).reverse(), hasMore: combined.length > 50 });
  } catch (error) { handleError(res, error); }
});
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const access = await accessConversation(req.params.id, req.user);
    if (!access) return res.status(403).json({ message: 'Không thể truy cập cuộc trò chuyện' });
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    const clientId = req.body.clientId;
    if (!text || text.length > 2000 || typeof clientId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(clientId)) return res.status(400).json({ message: 'Tin nhắn không hợp lệ (tối đa 2000 ký tự)' });
    const recipientId = access.conversation.participants.find(id => String(id) !== String(req.user._id));
    const filter = { conversationId: access.conversation._id, senderId: req.user._id, clientId };
    let message;
    try { message = await Message.findOneAndUpdate(filter, { $setOnInsert: { ...filter, recipientId, text } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean(); }
    catch (error) { if (error.code !== 11000) throw error; message = await Message.findOne(filter).lean(); }
    await Conversation.updateOne({ _id: access.conversation._id }, { $max: { lastMessageAt: message.createdAt } });
    emitLater(req, access.conversation.participants, 'chat:message', { conversationId: access.conversation._id, message });
    res.json({ message });
  } catch (error) { handleError(res, error); }
});
router.post('/conversations/:id/read', async (req, res) => {
  try {
    const access = await accessConversation(req.params.id, req.user);
    if (!access) return res.status(403).json({ message: 'Không thể truy cập cuộc trò chuyện' });
    const { through, throughType = 'message' } = req.body;
    if (!validId(through)) return res.status(400).json({ message: 'Mốc tin nhắn không hợp lệ' });
    if (!['message', 'call'].includes(throughType)) return res.status(400).json({ message: 'Loại mốc không hợp lệ' });
    const cursor = throughType === 'call'
      ? await Call.findOne({ _id: through, conversationId: { $in: access.conversationIds }, participants: req.user._id, status: { $in: completedCalls } }).select('_id createdAt').lean()
      : await Message.findOne({ _id: through, conversationId: { $in: access.conversationIds } }).select('_id createdAt').lean();
    if (!cursor) return res.status(400).json({ message: 'Không tìm thấy mốc tin nhắn' });
    const filter = {
      conversationId: { $in: access.conversationIds }, recipientId: req.user._id, seenAt: null,
      $or: [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lte: cursor._id } }],
    };
    const now = new Date();
    await Message.updateMany({ ...filter, deliveredAt: null }, { $set: { deliveredAt: now } });
    const updated = await Message.updateMany(filter, { $set: { seenAt: now } });
    if (updated.modifiedCount > 0) {
      emitLater(req, access.conversation.participants, 'chat:read', { conversationId: access.conversation._id, readerId: req.user._id, through: { _id: cursor._id, createdAt: cursor.createdAt }, seenAt: now });
    }
    const unread = await Message.countDocuments({ conversationId: { $in: access.conversationIds }, recipientId: req.user._id, seenAt: null });
    res.json({ unread, through: { _id: cursor._id, createdAt: cursor.createdAt }, seenAt: now });
  } catch (error) { handleError(res, error); }
});
router.post('/conversations/:id/receipt', async (req, res) => {
  try {
    const access = await accessConversation(req.params.id, req.user);
    if (!access) return res.status(403).json({ message: 'Không thể truy cập cuộc trò chuyện' });
    const { messageIds, seen } = req.body;
    if (!Array.isArray(messageIds) || !messageIds.length || messageIds.length > 100 || !messageIds.every(validId) || typeof seen !== 'boolean') return res.status(400).json({ message: 'Xác nhận không hợp lệ' });
    const filter = { _id: { $in: messageIds }, conversationId: { $in: access.conversationIds }, recipientId: req.user._id };
    const now = new Date();
    await Message.updateMany({ ...filter, deliveredAt: null }, { $set: { deliveredAt: now } });
    if (seen) await Message.updateMany({ ...filter, seenAt: null }, { $set: { seenAt: now } });
    const messages = await Message.find(filter).select('_id deliveredAt seenAt').lean();
    if (messages.length) emitLater(req, access.conversation.participants, 'chat:receipt', { conversationId: access.conversation._id, messages });
    res.json({ messages });
  } catch (error) { handleError(res, error); }
});
module.exports = router;
module.exports.canAccess = canAccess;
module.exports.accessConversation = accessConversation;
module.exports.emitToUsers = emit;
