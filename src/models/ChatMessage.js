const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatConversation', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
  clientId: { type: String, required: true, maxlength: 80 },
  text: { type: String, required: true, maxlength: 2000 },
  deliveredAt: { type: Date, default: null },
  seenAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ conversationId: 1, createdAt: -1, _id: -1 });
schema.index({ conversationId: 1, senderId: 1, clientId: 1 }, { unique: true });
schema.index({ recipientId: 1, deliveredAt: 1 });
schema.index({ conversationId: 1, recipientId: 1, seenAt: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.model('ChatMessage', schema);
