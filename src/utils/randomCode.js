const LopHoc = require("../models/LopHoc");

const generateClassCode = async () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let isUnique = false;
  let code = '';

  while (!isUnique) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    // Kiểm tra xem mã này đã tồn tại trong DB chưa
    const existingClass = await LopHoc.findOne({ ma_lop_random: code });
    if (!existingClass) isUnique = true;
  }
  return code;
};

module.exports = { generateClassCode };