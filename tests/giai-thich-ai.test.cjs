const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const KetQuaBaiThi = require("../src/models/KetQuaBaiThi");
const handler = require("../src/controllers/baigiang/giaiThichAI");

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test("AI chỉ xử lý bài đã nộp của người đang đăng nhập và gửi nội dung câu hỏi", async () => {
  const findOne = KetQuaBaiThi.findOne;
  const post = axios.post;
  const oldKey = process.env.GEMINI_API_KEY;
  const id = "507f1f77bcf86cd799439011";
  let query;
  let sent;
  try {
    process.env.GEMINI_API_KEY = "test-key";
    KetQuaBaiThi.findOne = (value) => {
      query = value;
      return { populate: async () => ({ chi_tiet_dap_an: [{}], id_bai_giang: { danhSachCauHoi: [{ noiDungCauHoi: "<p>Câu hỏi</p><script>secret</script>", cacDapAn: [{ noiDungDapAn: "Đúng", laDapAnDung: true }] }] } }) };
    };
    axios.post = async (url, body) => { sent = body; return { data: { candidates: [{ content: { parts: [{ text: "Giải thích" }] } }] } }; };
    const res = response();
    await handler({ params: { idKetQua: id, index: "0" }, user: { id: "student-1" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(query.id_hoc_sinh, "student-1");
    assert.deepEqual(query.trang_thai.$in, ["da_nop_bai", "da_xem_dap_an"]);
    assert.equal(res.body.data.explanation, "Giải thích");
    assert.match(JSON.stringify(sent), /Câu hỏi/);
    assert.doesNotMatch(JSON.stringify(sent), /secret|student-1|test-key/);
    KetQuaBaiThi.findOne = () => ({ populate: async () => null });
    const denied = response();
    await handler({ params: { idKetQua: id, index: "0" }, user: { id: "other" } }, denied);
    assert.equal(denied.statusCode, 404);
  } finally {
    KetQuaBaiThi.findOne = findOne;
    axios.post = post;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
  }
});
