const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const assert = require('node:assert/strict');
const LopHoc = require('../src/models/LopHoc');
const BaiGiang = require('../src/models/BaiGiang');

const lessons = [
  {
    ten_bai_giang: 'Toán học: Lũy thừa, căn thức và phương trình',
    gioiThieu: 'Ôn tập lũy thừa, căn bậc hai, phân số và các ký hiệu toán học cơ bản.',
    noi_dung_bai_hoc: '<h3>Lũy thừa và căn thức</h3><p>x<sup>2</sup> = x × x. Căn bậc hai số học √a là số không âm có bình phương bằng a (a ≥ 0).</p><p>Với phân số, nhân tử và mẫu với cùng một số khác 0 không làm thay đổi giá trị.</p>',
    questions: [
      ['<p>Giá trị của 3<sup>2</sup> + 2<sup>3</sup> là bao nhiêu?</p>', '17', ['15', '25', '36'], '3² = 9 và 2³ = 8, nên tổng bằng 17.'],
      ['<p>Nghiệm của phương trình x<sup>2</sup> = 25 là gì?</p>', 'x = ±5', ['x = 5', 'x = ±25', 'x = 0'], 'Cả 5 và −5 đều có bình phương bằng 25.'],
      ['<p>Giá trị của √49 là bao nhiêu?</p>', '7', ['±7', '−7', '49'], '√49 là căn bậc hai số học, nên có giá trị không âm là 7.'],
      ['<p>Phân số 3⁄4 tương đương với phân số nào?</p>', '6⁄8', ['3⁄8', '4⁄3', '9⁄16'], 'Nhân cả tử và mẫu của 3⁄4 với 2 được 6⁄8.'],
      ['<p>Điều kiện xác định của √(x − 2) trong tập số thực là gì?</p>', 'x ≥ 2', ['x > 2', 'x ≤ 2', 'x ≠ 2'], 'Biểu thức dưới căn phải không âm: x − 2 ≥ 0, do đó x ≥ 2.'],
    ],
  },
  {
    ten_bai_giang: 'Vật lí: Chuyển động, lực và điện học',
    gioiThieu: 'Luyện tập các đại lượng và công thức cơ bản trong cơ học và điện học.',
    noi_dung_bai_hoc: '<h3>Công thức cần nhớ</h3><p>Chuyển động đều: v = s/t. Định luật II Newton: F = ma. Định luật Ohm: U = IR.</p><p>Hãy dùng đơn vị SI: m, s, kg, N, V, A và Ω.</p>',
    questions: [
      ['<p>Vật đi được 120 m trong 20 s. Vận tốc trung bình v bằng bao nhiêu?</p>', '6 m/s', ['100 m/s', '140 m/s', '0,167 m/s'], 'v = s/t = 120/20 = 6 m/s.'],
      ['<p>Vật có khối lượng m = 2 kg và gia tốc a = 3 m/s<sup>2</sup>. Theo F = ma, lực tổng hợp bằng bao nhiêu?</p>', '6 N', ['5 N', '1,5 N', '6 J'], 'Theo định luật II Newton, F = ma = 2 × 3 = 6 N.'],
      ['<p>Một điện trở R = 4 Ω có dòng điện I = 2 A chạy qua. Hiệu điện thế U bằng bao nhiêu?</p>', '8 V', ['2 V', '6 V', '0,5 V'], 'Theo định luật Ohm, U = IR = 2 × 4 = 8 V.'],
      ['<p>Một vật chuyển động thẳng đều. Gia tốc a của vật có giá trị nào?</p>', '0 m/s²', ['1 m/s²', '9,8 m/s²', 'Phụ thuộc quãng đường'], 'Chuyển động thẳng đều có vectơ vận tốc không đổi, nên gia tốc bằng 0.'],
      ['<p>Đơn vị SI của điện trở R là ký hiệu nào?</p>', 'Ω', ['V', 'A', 'W'], 'Điện trở có đơn vị ohm, ký hiệu Ω.'],
    ],
  },
  {
    ten_bai_giang: 'Hóa học: Công thức và phương trình phản ứng',
    gioiThieu: 'Nhận biết chỉ số hóa học, tính toán số mol và cân bằng phương trình đơn giản.',
    noi_dung_bai_hoc: '<h3>Nguyên tử và số mol</h3><p>Trong H<sub>2</sub>O, chỉ số 2 cho biết có hai nguyên tử H. Số mol n = m/M.</p><p>Khi cân bằng phản ứng, số nguyên tử của mỗi nguyên tố ở hai vế phải bằng nhau.</p>',
    questions: [
      ['<p>Trong một phân tử H<sub>2</sub>O có bao nhiêu nguyên tử hiđro?</p>', '2', ['1', '3', '4'], 'Chỉ số dưới 2 trong H₂O cho biết mỗi phân tử có 2 nguyên tử H.'],
      ['<p>Hệ số còn thiếu trong phương trình 2H<sub>2</sub> + O<sub>2</sub> → ?H<sub>2</sub>O là bao nhiêu?</p>', '2', ['1', '3', '4'], '2H₂ + O₂ → 2H₂O bảo toàn 4 nguyên tử H và 2 nguyên tử O.'],
      ['<p>Khối lượng mol của CO<sub>2</sub> bằng bao nhiêu? Cho M(C) = 12 và M(O) = 16 g/mol.</p>', '44 g/mol', ['28 g/mol', '32 g/mol', '48 g/mol'], 'M(CO₂) = 12 + 2 × 16 = 44 g/mol.'],
      ['<p>Có bao nhiêu mol NaCl trong 117 g NaCl? Cho M(NaCl) = 58,5 g/mol.</p>', '2 mol', ['0,5 mol', '1 mol', '58,5 mol'], 'n = m/M = 117/58,5 = 2 mol.'],
      ['<p>Ion Ca<sup>2+</sup> mang điện tích nào?</p>', '+2', ['−2', '+1', '0'], 'Ký hiệu 2+ cho biết ion canxi mang điện tích dương hai đơn vị.'],
    ],
  },
];

function makeQuestions(rows) {
  return rows.map(([noiDungCauHoi, correct, wrong, explanation], index) => {
    const options = wrong.map(noiDungDapAn => ({ noiDungDapAn, laDapAnDung: false }));
    options.splice(index % 4, 0, { noiDungDapAn: correct, laDapAnDung: true });
    return { noiDungCauHoi, cacDapAn: options, giaiThich: `<p>${explanation}</p>` };
  });
}

async function main() {
  dotenv.config({ path: path.join(__dirname, '../.env'), quiet: true });
  assert.ok(process.env.MONGO_URI, 'Thiếu cấu hình kết nối MongoDB');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const classes = await LopHoc.find().select('ten_lop').lean();
  const plan = [];
  let existing = 0;
  let invalid = 0;
  for (const lop of classes) {
    for (const lesson of lessons) {
      const found = await BaiGiang.findOne({ id_lop_hoc: lop._id, ten_bai_giang: lesson.ten_bai_giang }).lean();
      if (found) {
        existing++;
        if (found.danhSachCauHoi.length !== 5 || found.danhSachCauHoi.some(q => q.cacDapAn.length !== 4 || q.cacDapAn.filter(a => a.laDapAnDung).length !== 1)) invalid++;
        continue;
      }
      const doc = new BaiGiang({ ...lesson, id_lop_hoc: lop._id, danhSachCauHoi: makeQuestions(lesson.questions), giaBaiGiang: 0, thoi_gian_lam_bai: 15 });
      await doc.validate();
      plan.push(doc);
    }
  }
  let created = 0;
  if (process.argv.includes('--apply')) {
    for (const doc of plan) {
      // Recheck before inserting so rerunning after an interruption does not duplicate lessons.
      if (!(await BaiGiang.exists({ id_lop_hoc: doc.id_lop_hoc, ten_bai_giang: doc.ten_bai_giang }))) {
        await doc.save();
        created++;
      }
    }
  }
  console.log(JSON.stringify({ classes: classes.length, existing, invalid, pending: plan.length, created, questionsPerLesson: 5, mode: process.argv.includes('--apply') ? 'apply' : 'preview' }));
}

main().catch((err) => { console.error(`Không thể thêm bài giảng: ${err.name}`); process.exitCode = 1; }).finally(() => mongoose.disconnect());
