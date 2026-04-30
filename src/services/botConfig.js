// botConfig.js
const { Telegraf } = require('telegraf');
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN?.replace(/['";]/g, '').trim();
const bot = new Telegraf(BOT_TOKEN);

// Khởi chạy bot duy nhất tại đây
bot.launch().then(() => console.log("🤖 Telegram Bot Unified System is running..."));

module.exports = bot;