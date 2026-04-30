const path = require('path');
require("dotenv").config();
const { Telegraf, Markup } = require('telegraf');
const BaiViet = require('../models/BaiViet');
const bot = require('./botConfig');

const BOT_TOKEN = process.env.BOT_TOKEN?.replace(/['";]/g, '').trim();
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID?.toString().replace(/['";]/g, '').trim();
// 🟢 Link tên miền thật của bạn (VD: https://api.ktquizz.vn)
const BACKEND_URL = process.env.BACKEND_URL; 

// const bot = new Telegraf(BOT_TOKEN);

/**
 * 1. Hàm gửi thông báo: Nội dung ở trên, Media ở dưới
 */
const sendPostNotification = async (post, authorName) => {
    // Thiết kế Caption theo phong cách hiện đại
    const caption = `
🚀 <b>YÊU CẦU PHÊ DUYỆT BÀI VIẾT</b>
━━━━━━━━━━━━━━━━━━
👤 <b>Tác giả:</b> <code>${authorName}</code>
📝 <b>Nội dung:</b>
<blockquote>${post.content || "<i>(Không có nội dung chữ)</i>"}</blockquote>

⏰ <b>Gửi lúc:</b> ${new Date(post.createdAt).toLocaleString('vi-VN')}
━━━━━━━━━━━━━━━━━━
👇 <b>Lựa chọn hành động:</b>
    `;

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('✅ DUYỆT BÀI', `approve_${post._id}`),
            Markup.button.callback('🗑️ XÓA VĨNH VIỄN', `delete_${post._id}`)
        ],
    ]);

    try {
        const options = { caption, parse_mode: 'HTML', ...keyboard };

        // 🟢 TỰ ĐỘNG NHẬN DIỆN LOẠI MEDIA ĐỂ GỬI
        if (post.image) {
            await bot.telegram.sendPhoto(ADMIN_CHAT_ID, `${BACKEND_URL}${post.image}`, options);
        } else if (post.video) {
            await bot.telegram.sendVideo(ADMIN_CHAT_ID, `${BACKEND_URL}${post.video}`, options);
        } else if (post.audio) {
            await bot.telegram.sendAudio(ADMIN_CHAT_ID, `${BACKEND_URL}${post.audio}`, options);
        } else {
            await bot.telegram.sendMessage(ADMIN_CHAT_ID, caption, { parse_mode: 'HTML', ...keyboard });
        }
    } catch (error) {
        console.error("❌ Lỗi gửi Telegram:", error.message);
        // Backup gửi text nếu media lỗi
        await bot.telegram.sendMessage(ADMIN_CHAT_ID, caption, { parse_mode: 'HTML', ...keyboard });
    }
};

/**
 * 2. Logic xử lý tương tác trực tiếp
 */
const handleAction = async (ctx, type) => {
    const postId = ctx.match[1];
    try {
        let updateText = "";
        if (type === 'approve') {
            await BaiViet.findByIdAndUpdate(postId, { isActive: true });
            updateText = `✅ <b>TRẠNG THÁI: ĐÃ DUYỆT</b>\n━━━━━━━━━━━━━━━\nID: <code>${postId}</code>\n<i>Bài viết đã hiển thị công khai.</i>`;
            await ctx.answerCbQuery("Đã duyệt bài! 🚀");
        } else {
            await BaiViet.findByIdAndDelete(postId);
            updateText = `🗑️ <b>TRẠNG THÁI: ĐÃ XÓA</b>\n━━━━━━━━━━━━━━━\nID: <code>${postId}</code>\n<i>Dữ liệu đã được gỡ bỏ.</i>`;
            await ctx.answerCbQuery("Đã xóa bài! 🗑️");
        }

        // Cập nhật lại giao diện tin nhắn cũ
        if (ctx.callbackQuery.message.photo || ctx.callbackQuery.message.video || ctx.callbackQuery.message.audio) {
            await ctx.editMessageCaption(updateText, { parse_mode: 'HTML' });
        } else {
            await ctx.editMessageText(updateText, { parse_mode: 'HTML' });
        }
    } catch (err) {
        await ctx.answerCbQuery("Lỗi hệ thống!");
    }
};

bot.action(/approve_(.+)/, (ctx) => handleAction(ctx, 'approve'));
bot.action(/delete_(.+)/, (ctx) => handleAction(ctx, 'delete'));

// bot.launch().then(() => console.log("🤖 Admin Bot PRO is running..."));

module.exports = { sendPostNotification };