const { Telegraf, Markup } = require('telegraf');
const DeThi = require('../models/DeThi');
const bot = require('./botConfig');

// 1. Cấu hình bảo mật (Deploy dùng HTTPS)
const BOT_TOKEN = process.env.BOT_TOKEN?.replace(/['";]/g, '').trim();
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID?.toString().replace(/['";]/g, '').trim();
const BACKEND_URL = process.env.BACKEND_URL;



/**
 * HÀM GỬI THÔNG BÁO DUYỆT ĐỀ (Giao diện Card rút gọn)
 */


const sendDeThiNotification = async (deThi, authorName, theLoaiName) => {

    const cheDoMapping = {
        'on_thi': '📖 Ôn thi',
        'thi_that': '⏱️ Thi thật',
        'ca_hai': '🔄 Ôn thi & Thi thật'
    };

    const displayCheDo = cheDoMapping[deThi.cheDo] || deThi.cheDo;
    // Thiết kế caption chuyên nghiệp, icon rõ ràng
    const caption = `
🎓 <b>YÊU CẦU DUYỆT BỘ ĐỀ MỚI</b>
━━━━━━━━━━━━━━━━━━
📌 <b>Tiêu đề:</b> <code>${deThi.tieuDe}</code>
👤 <b>Tác giả:</b> <code>${authorName}</code>
📁 <b>Thể loại:</b> <b>${theLoaiName}</b>

📊 <b>THÔNG SỐ BỘ ĐỀ:</b>
• ⏱ <b>Thời gian:</b> ${deThi.thoiGianLamBai} phút
• ❓ <b>Số lượng:</b> ${deThi.danhSachCauHoi?.length || 0} câu hỏi
• 🛠 <b>Chế độ:</b> ${displayCheDo}
• 🛡️ <b>Trạng thái:</b> ${deThi.trangThai === 'cong_khai' ? '🌐 Công khai' : '🔐 Riêng tư'}

⏰ <b>Gửi lúc:</b> ${new Date(deThi.createdAt).toLocaleString('vi-VN')}
━━━━━━━━━━━━━━━━━━
👇 <b>Tú hãy phê duyệt tại đây:</b>
    `;

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('✅ CHẤP NHẬN', `approve_exam_${deThi._id}`),
            Markup.button.callback('🗑️ XÓA BỎ', `delete_exam_${deThi._id}`)
        ],
    ]);

    try {
        // Nếu có ảnh đại diện bộ đề, gửi Card kèm ảnh cực xịn 
        if (deThi.anhDaiDien) {
            await bot.telegram.sendPhoto(ADMIN_CHAT_ID, `${BACKEND_URL}${deThi.anhDaiDien}`, {
                caption,
                parse_mode: 'HTML',
                ...keyboard
            });
        } else {
            await bot.telegram.sendMessage(ADMIN_CHAT_ID, caption, {
                parse_mode: 'HTML',
                ...keyboard
            });
        }
    } catch (error) {
        console.error("Lỗi gửi Telegram:", error.message);
        await bot.telegram.sendMessage(ADMIN_CHAT_ID, caption, { parse_mode: 'HTML', ...keyboard });
    }
};

/**
 * LOGIC XỬ LÝ DUYỆT/XÓA
 */
const handleExamAction = async (ctx, actionType) => {
    const examId = ctx.match[1];
    
    // 1. Phản hồi Telegram NGAY LẬP TỨC để tránh timeout
    // Chúng ta không dùng await ở đây để nó chạy ngầm
    ctx.answerCbQuery(actionType === 'approve' ? "Đang phê duyệt..." : "Đang xóa...").catch(e => console.log("Lỗi phản hồi chậm:", e.description));

    try {
        let updateText = "";
        if (actionType === 'approve') {
            const deThi = await DeThi.findByIdAndUpdate(examId, { trangThaiDuyet: true }, { new: true });
            if (!deThi) return; // Nếu không tìm thấy thì dừng

            updateText = `✅ <b>HỆ THỐNG: ĐÃ DUYỆT BỘ ĐỀ</b>\n━━━━━━━━━━━━━━━\nID: <code>${examId}</code>\n<i>Bài thi đã sẵn sàng phục vụ thí sinh.</i>`;
        } else {
            await DeThi.findByIdAndDelete(examId);
            updateText = `🗑️ <b>HỆ THỐNG: ĐÃ XÓA BỘ ĐỀ</b>\n━━━━━━━━━━━━━━━\nID: <code>${examId}</code>\n<i>Dữ liệu đã được gỡ bỏ khỏi máy chủ.</i>`;
        }

        // 2. Cập nhật giao diện tin nhắn cũ
        if (ctx.callbackQuery.message.photo) {
            await ctx.editMessageCaption(updateText, { parse_mode: 'HTML' }).catch(() => {});
        } else {
            await ctx.editMessageText(updateText, { parse_mode: 'HTML' }).catch(() => {});
        }
    } catch (err) {
        console.error("Lỗi xử lý hệ thống:", err);
        // Không gọi answerCbQuery ở catch này nữa vì đã gọi ở trên rồi
    }
};

bot.action(/approve_exam_(.+)/, (ctx) => handleExamAction(ctx, 'approve'));
bot.action(/delete_exam_(.+)/, (ctx) => handleExamAction(ctx, 'delete'));

// Khởi chạy bot
// bot.launch().then(() => console.log("🤖 Admin De Thi Bot is ready!"));

module.exports = { sendDeThiNotification };