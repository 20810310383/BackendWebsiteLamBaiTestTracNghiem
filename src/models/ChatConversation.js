const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  // null identifies the shared thread; older per-class threads remain readable.
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'LopHoc', default: null, index: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true }],
  pairKey: { type: String, required: true },
  lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: true });
schema.index({ classId: 1, pairKey: 1 }, { unique: true });
schema.index({ participants: 1, lastMessageAt: -1 });
module.exports = mongoose.model('ChatConversation', schema);
