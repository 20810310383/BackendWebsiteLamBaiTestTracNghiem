const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatConversation', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true }],
  callerId: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
  calleeId: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
  mode: { type: String, enum: ['audio', 'video'], required: true },
  status: { type: String, enum: ['ringing', 'accepted', 'declined', 'ended', 'missed', 'busy'], default: 'ringing' },
  active: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
  callerHeartbeat: { type: Date },
  calleeHeartbeat: { type: Date },
  endedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung' },
  acceptedAt: { type: Date },
  wasAnswered: { type: Boolean, default: null },
  endedAt: { type: Date },
  durationApproximate: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ participants: 1 }, { unique: true, partialFilterExpression: { active: true } });
schema.index({ participants: 1, active: 1 });
schema.index({ conversationId: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.model('CallSession', schema);
