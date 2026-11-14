const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const NguoiDung = require('../models/NguoiDung');
const LopHoc = require('../models/LopHoc');

function canView(classroom, user) {
  if (!classroom || !user?.isActive) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'giaovien') return String(classroom.id_giaovien?._id || classroom.id_giaovien) === String(user._id);
  return user.role === 'hocsinh' && classroom.danh_sach_hoc_vien.some(member =>
    String(member.id_hoc_vien?._id || member.id_hoc_vien) === String(user._id) && member.trang_thai_phe_duyet === 'da_tham_gia');
}

function createPresence(io, dependencies = {}) {
  const Users = dependencies.Users || NguoiDung;
  const Classes = dependencies.Classes || LopHoc;
  const verify = dependencies.verify || (token => jwt.verify(token, process.env.JWT_ACCESS_SECRET));
  const states = new Map();
  const queues = new Map();
  let sequence = 0;
  const stamp = () => { sequence = Math.max(Date.now(), sequence + 1); return sequence; };
  const validSession = (socket, user) => {
    try {
      const token = socket.handshake.auth?.token;
      const decoded = verify(token);
      return Boolean(user?.isActive && token === user.currentToken && String(decoded.id) === String(user._id));
    } catch { return false; }
  };
  const roomName = id => `presence:class:${id}`;
  const online = async (id, account) => {
    const sockets = await io.in(`user:${id}`).fetchSockets();
    if (!sockets.length) return false;
    const current = account || await Users.findById(id).select('isActive currentToken').lean();
    return sockets.some(socket => validSession(socket, current));
  };

  async function broadcast(userId, isOnline, lastSeenAt) {
    const classrooms = await Classes.find({ $or: [{ id_giaovien: userId }, { danh_sach_hoc_vien: { $elemMatch: { id_hoc_vien: userId, trang_thai_phe_duyet: 'da_tham_gia' } } }] })
      .select('_id id_giaovien danh_sach_hoc_vien').lean();
    const observedAt = stamp();
    await Promise.all(classrooms.map(async classroom => {
      const sockets = await io.in(roomName(classroom._id)).fetchSockets();
      if (!sockets.length) return;
      const ids = [...new Set(sockets.map(socket => String(socket.data.user?._id || socket.data.user?.id)).filter(Boolean))];
      const users = await Users.find({ _id: { $in: ids } }).select('role isActive currentToken').lean();
      const viewers = new Map(users.map(user => [String(user._id), user]));
      for (const socket of sockets) {
        const viewer = viewers.get(String(socket.data.user?._id || socket.data.user?.id));
        if (validSession(socket, viewer) && canView(classroom, viewer)) {
          socket.emit('presence:update', { classId: String(classroom._id), userId: String(userId), online: isOnline, lastSeenAt: lastSeenAt || null, observedAt });
        } else {
          await socket.leave(roomName(classroom._id));
        }
      }
    }));
  }

  function updateUser(userId) {
    const id = String(userId);
    const previous = queues.get(id) || Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      const connected = await online(id);
      if (states.get(id) === connected) return;
      let lastSeenAt = null;
      if (!connected) {
        const now = new Date();
        await Users.updateOne({ _id: id }, { $max: { last_seen_at: now } }, { timestamps: false });
        lastSeenAt = now;
      }
      states.set(id, connected);
      await broadcast(id, connected, lastSeenAt);
      if (!connected) {
        const timer = setTimeout(() => { if (states.get(id) === false && !queues.has(id)) states.delete(id); }, 30000);
        timer.unref?.();
      }
    }).catch(error => console.error('Presence update error:', error));
    queues.set(id, next);
    next.finally(() => { if (queues.get(id) === next) queues.delete(id); });
    return next;
  }

  function register(socket) {
    let subscribed = null;
    let generation = 0;
    let subscriptionWork = Promise.resolve();
    const userId = String(socket.data.user._id || socket.data.user.id);
    updateUser(userId);
    socket.on('presence:subscribe', (payload, reply) => {
      const respond = typeof reply === 'function' ? reply : () => {};
      const version = ++generation;
      subscriptionWork = subscriptionWork.catch(() => {}).then(async () => {
      try {
        const classId = payload?.classId;
        if (!mongoose.isValidObjectId(classId)) return respond({ success: false, message: 'Lớp học không hợp lệ' });
        const [classroom, viewer] = await Promise.all([
          Classes.findById(classId).populate('danh_sach_hoc_vien.id_hoc_vien', 'last_seen_at isActive currentToken').populate('id_giaovien', 'last_seen_at isActive currentToken').lean(),
          Users.findById(userId).select('role isActive currentToken').lean(),
        ]);
        if (version !== generation || !socket.connected) return;
        if (!validSession(socket, viewer) || !canView(classroom, viewer)) return respond({ success: false, message: 'Không có quyền xem lớp học' });
        if (subscribed) await socket.leave(roomName(subscribed));
        if (version !== generation || !socket.connected) return;
        const joined = String(classroom._id);
        subscribed = joined;
        await socket.join(roomName(joined));
        if (version !== generation || !socket.connected) { await socket.leave(roomName(joined)); if (subscribed === joined) subscribed = null; return; }
        const observedAt = stamp();
        const members = classroom.danh_sach_hoc_vien.filter(member => member.trang_thai_phe_duyet === 'da_tham_gia' && member.id_hoc_vien?._id).map(member => member.id_hoc_vien);
        if (classroom.id_giaovien?._id && !members.some(member => String(member._id) === String(classroom.id_giaovien._id))) members.unshift(classroom.id_giaovien);
        const items = await Promise.all(members.map(async member => ({ userId: String(member._id), online: await online(member._id, member), lastSeenAt: member.last_seen_at || null, observedAt })));
        const [latestClass, latestViewer] = await Promise.all([
          Classes.findById(joined).select('id_giaovien danh_sach_hoc_vien').lean(),
          Users.findById(userId).select('role isActive currentToken').lean(),
        ]);
        if (version !== generation || !socket.connected) return;
        if (!validSession(socket, latestViewer) || !canView(latestClass, latestViewer)) {
          await socket.leave(roomName(joined));
          if (subscribed === joined) subscribed = null;
          return respond({ success: false, message: 'Không có quyền xem lớp học' });
        }
        const allowedIds = new Set(latestClass.danh_sach_hoc_vien.filter(member => member.trang_thai_phe_duyet === 'da_tham_gia').map(member => String(member.id_hoc_vien)));
        if (latestClass.id_giaovien) allowedIds.add(String(latestClass.id_giaovien));
        respond({ success: true, classId: joined, items: items.filter(item => allowedIds.has(item.userId)) });
      } catch (error) {
        console.error('Presence subscribe error:', error);
        if (version === generation) respond({ success: false, message: 'Không thể tải trạng thái hoạt động' });
      }
      });
    });
    socket.on('presence:unsubscribe', payload => {
      generation++;
      subscriptionWork = subscriptionWork.catch(() => {}).then(async () => {
        if (!subscribed || String(payload?.classId) !== subscribed) return;
        const previous = subscribed; subscribed = null;
        await socket.leave(roomName(previous));
      });
    });
    socket.on('disconnect', () => { generation++; updateUser(userId); });
  }
  return { register, canView };
}
module.exports = createPresence;
