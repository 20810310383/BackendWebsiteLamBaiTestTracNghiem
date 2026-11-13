// Computed exercises: five problem types with two datasets for each lesson.
const number = (value) => String(Number(value.toFixed(4)));
const numeric = (prompt, answer, explanation) => ({ prompt, answer: number(answer), wrong: [answer + 1, answer - 1, answer + 2].map(number), explanation });
const text = (prompt, answer, wrong, explanation) => ({ prompt, answer: String(answer), wrong: wrong.map(String), explanation });

const banks = {
  python: [
    n => [
      numeric(`Python: x = ${n}; y = ${n + 3}. print(x + y) in ra số nào?`, 2 * n + 3, 'Phép + cộng hai giá trị số nguyên.'),
      text(`Python: type(${n}).__name__ trả về gì?`, 'int', ['str', 'float', 'bool'], 'Số nguyên không có phần thập phân mang kiểu int.'),
      text(`Python: type("${n}").__name__ trả về gì?`, 'str', ['int', 'float', 'bool'], 'Dãy ký tự nằm trong dấu nháy là chuỗi str.'),
      numeric(`Python: x = ${n}; x = x * 2. Giá trị cuối của x là bao nhiêu?`, n * 2, 'Lệnh gán cập nhật x bằng giá trị biểu thức bên phải.'),
      text(`Python: print("${n}" + "${n}") in ra gì?`, `${n}${n}`, [String(n * 2), String(n), 'TypeError'], 'Dấu + nối hai chuỗi, không cộng số khi cả hai toán hạng là str.')
    ],
    n => [
      numeric(`Python: người dùng nhập ${n} cho input(). Biểu thức int(input()) + 3 có giá trị bao nhiêu?`, n + 3, 'int chuyển chuỗi số nguyên thành int trước khi cộng.'),
      numeric(`Python: float("${n}.5") + 1 có giá trị bằng bao nhiêu?`, n + 1.5, 'float chuyển chuỗi thập phân sang số thực.'),
      text(`Python: input() nhận chuỗi "${n}". Nối chuỗi đó với "2" cho kết quả nào?`, `${n}2`, [String(n + 2), String(n), 'Lỗi vì không thể nối chuỗi'], 'Hai chuỗi được nối thành một chuỗi mới.'),
      numeric(`Python: int(float("${n}.9")) bằng bao nhiêu?`, n, 'int loại phần thập phân của số dương, không làm tròn đến số gần nhất.'),
      numeric(`Python: input() nhận văn bản "${n}00". len() của chuỗi nhận được bằng bao nhiêu?`, 3, 'len đếm số ký tự; input không tự chuyển chuỗi sang số.')
    ],
    n => [
      text(`Điểm = ${n + 3}. Nếu điểm >= 5 thì in "Đạt", ngược lại in "Chưa đạt". Kết quả là gì?`, 'Đạt', ['Chưa đạt', 'Không có nhánh nào chạy', 'Lỗi cú pháp do so sánh số'], 'Điểm từ 5 trở lên thỏa điều kiện >= 5.'),
      text(`Python: x = ${n}. Điều kiện x == ${n} trả về gì?`, 'True', ['False', 'None', 'SyntaxError'], '== so sánh giá trị; hai giá trị đang bằng nhau.'),
      text(`Python: x = ${n}. Nếu x > ${n} thì in A, else in B. Kết quả nào đúng?`, 'B', ['A', 'A rồi B', 'Không in gì'], 'Dấu > không bao gồm trường hợp bằng nhau.'),
      text(`Điểm = ${n + 9}. Kiểm tra 0 <= điểm <= 10 trước khi xếp loại. Kết luận nào đúng?`, 'Không hợp lệ', ['Hợp lệ', 'Tự động chuyển thành 10', 'Tự động chuyển thành 0'], 'Giá trị vượt 10 không thuộc miền điểm hợp lệ.'),
      text(`Python: x = ${n}; if x < 0: in A; elif x == ${n}: in B; else: in C. Nhánh nào chạy?`, 'B', ['A', 'C', 'A và C'], 'if sai, elif đúng nên chỉ nhánh elif được thực hiện.')
    ],
    n => [
      numeric(`Python: sum(range(${n})) bằng bao nhiêu?`, n * (n - 1) / 2, 'range(n) gồm các số nguyên từ 0 đến n-1.'),
      numeric(`Python: sum(range(1, ${n + 1})) bằng bao nhiêu?`, n * (n + 1) / 2, 'Cận phải của range không được đưa vào dãy.'),
      numeric(`Python: sum([${n}, ${n + 1}, ${n + 2}]) bằng bao nhiêu?`, 3 * n + 3, 'sum cộng từng phần tử của danh sách.'),
      numeric(`Python: x = 0. Mỗi lượt while x < ${n} thì tăng x thêm 2. Vòng lặp chạy bao nhiêu lượt?`, n / 2, 'x tăng lần lượt 0, 2, 4… và dừng khi không còn nhỏ hơn cận.'),
      numeric(`Python: len(list(range(${n}, ${n + 5}))) bằng bao nhiêu?`, 5, 'Dãy có năm phần tử từ n đến n+4.')
    ],
    n => [
      numeric(`Python: def add(a, b): return a + b. add(${n}, ${n + 2}) trả về gì?`, 2 * n + 2, 'Tham số nhận các đối số tương ứng; return trả tổng.'),
      numeric(`Hàm trung bình trả sum(values)/len(values). Với [${n}, ${n + 2}, ${n + 4}], kết quả là gì?`, n + 2, 'Tổng ba số chia cho số phần tử bằng 3.'),
      numeric(`Python: def increase(x, step=2): return x + step. increase(${n}) trả về gì?`, n + 2, 'Không truyền step thì hàm dùng giá trị mặc định 2.'),
      text(`Python: def show(x): print(x). Khi gọi show(${n}), giá trị trả về của hàm là gì?`, 'None', [String(n), 'True', 'Một chuỗi rỗng'], 'Hàm không có return rõ ràng trả về None; print chỉ ghi ra màn hình.'),
      numeric(`Python: x = ${n}. Hàm f(x) trả x + 1 và không có global. Sau f(10), biến x bên ngoài vẫn bằng bao nhiêu?`, n, 'Tham số trong hàm không gán lại biến cùng tên ở phạm vi bên ngoài.')
    ],
    n => [
      numeric(`Danh sách điểm [${n}, ${n + 3}, 9]. Điểm trung bình bằng bao nhiêu (làm tròn 4 chữ số thập phân nếu cần)?`, (2 * n + 12) / 3, 'Cộng cả ba điểm rồi chia cho 3.'),
      numeric(`Python: max([${n}, ${n + 3}, 9]) bằng bao nhiêu?`, 9, 'max lấy giá trị lớn nhất trong danh sách.'),
      numeric(`Một list có ${n} hồ sơ học viên. Thêm một hồ sơ bằng append(). len(list) mới là bao nhiêu?`, n + 1, 'append thêm đúng một phần tử vào cuối list.'),
      numeric(`Python: student = {"score": ${n + 5}}. student["score"] trả về gì?`, n + 5, 'Truy cập dict bằng khóa lấy đúng giá trị gắn với khóa đó.'),
      numeric(`Các điểm [${n}, ${n + 3}, 9]. Với điều kiện đạt là điểm >= 5, có bao nhiêu người đạt?`, 2, 'Hai giá trị n+3 và 9 đạt; n bằng 2 hoặc 4 đều chưa đạt.')
    ]
  ],
  math: [
    n => [
      numeric(`Cho f(x) = x² - ${2 * n}x. f′(${n + 1}) bằng bao nhiêu?`, 2, `f′(x) = 2x - ${2 * n}; thay x = ${n + 1}.`),
      numeric(`Cho f(x) = x² - ${2 * n}x. Đạo hàm bằng 0 tại x nào?`, n, `Giải 2x - ${2 * n} = 0.`),
      numeric(`Với f(x) = x² - ${2 * n}x, f′(0) bằng bao nhiêu?`, -2 * n, 'Thay x = 0 vào biểu thức đạo hàm 2x - 2n.'),
      text(`Hàm f(x) = x² - ${2 * n}x nghịch biến trên khoảng nào?`, `(-∞, ${n})`, [`(${n}, +∞)`, '(-∞, +∞)', '(0, +∞)'], `Đạo hàm 2x - ${2 * n} âm khi x < ${n}.`),
      numeric(`Cho f(x) = ${n}x². f′(3) bằng bao nhiêu?`, 6 * n, `f′(x) = ${2 * n}x; thay x = 3.`)
    ],
    n => [
      numeric(`Cho f(x) = x³ - ${3 * n * n}x. Hoành độ điểm cực đại là bao nhiêu?`, -n, 'Đạo hàm đổi dấu từ dương sang âm tại x = -n.'),
      numeric(`Cho f(x) = x³ - ${3 * n * n}x. Hoành độ điểm cực tiểu là bao nhiêu?`, n, 'Đạo hàm đổi dấu từ âm sang dương tại x = n.'),
      numeric(`Hàm f(x) = x³ - ${3 * n * n}x có giá trị cực đại bằng bao nhiêu?`, 2 * n ** 3, `Thay x = ${-n} vào hàm số.`),
      numeric(`Hàm f(x) = x³ - ${3 * n * n}x có giá trị cực tiểu bằng bao nhiêu?`, -2 * n ** 3, `Thay x = ${n} vào hàm số.`),
      numeric(`Phương trình f′(x) = 0 của f(x) = x³ - ${3 * n * n}x có bao nhiêu nghiệm thực phân biệt?`, 2, 'Đạo hàm bằng 3(x²-n²), có hai nghiệm -n và n.')
    ],
    n => [
      numeric(`F(x) = ax³ là một nguyên hàm của f(x) = ${3 * n}x². a bằng bao nhiêu?`, n, 'Đạo hàm ax³ bằng 3ax²; so hệ số của x².'),
      numeric(`Một nguyên hàm của hằng số ${n} có dạng F(x) = ax + C. a bằng bao nhiêu?`, n, 'Đạo hàm ax+C bằng a.'),
      numeric(`F(x) = ${n}x² + C. F(1) - F(0) bằng bao nhiêu?`, n, 'Hai hằng số C triệt tiêu khi lấy hiệu.'),
      numeric(`Cho F(x) = ${n}x³ + 7. F′(2) bằng bao nhiêu?`, 12 * n, 'Đạo hàm là 3nx²; đạo hàm của hằng số bằng 0.'),
      numeric(`Nguyên hàm của ${2 * n}x có dạng ax²+C. Hệ số a bằng bao nhiêu?`, n, 'Đạo hàm ax² bằng 2ax.')
    ],
    n => [
      numeric(`Tích phân của 2x từ 0 đến ${n} bằng bao nhiêu?`, n * n, 'Một nguyên hàm là x², lấy giá trị tại cận trên trừ cận dưới.'),
      numeric(`Tích phân của hằng số ${n} từ 0 đến 2 bằng bao nhiêu?`, 2 * n, 'Tích phân hằng số bằng giá trị hằng số nhân độ dài khoảng.'),
      numeric(`Tích phân của x từ 0 đến ${2 * n} bằng bao nhiêu?`, 2 * n * n, 'Nguyên hàm x²/2 được tính tại hai cận.'),
      numeric(`Tích phân của ${n}x² từ 0 đến 3 bằng bao nhiêu?`, 9 * n, 'Nguyên hàm nx³/3; tại x=3 có giá trị 9n.'),
      numeric(`Tích phân của 2x từ ${n} về 0 bằng bao nhiêu?`, -n * n, 'Đổi thứ tự hai cận làm tích phân đổi dấu.')
    ],
    n => [
      numeric(`A(${n},0,0), B(${n + 3},4,0). Độ dài AB bằng bao nhiêu?`, 5, 'AB có tọa độ (3,4,0), độ dài bằng √(9+16)=5.'),
      numeric(`A(${n},0,0), B(${n + 3},4,0). Hoành độ vectơ AB bằng bao nhiêu?`, 3, 'Lấy hoành độ B trừ hoành độ A.'),
      numeric(`Trung điểm của A(${n},0,0) và B(${n + 3},4,0) có hoành độ bằng bao nhiêu?`, n + 1.5, 'Hoành độ trung điểm bằng trung bình hai hoành độ đầu mút.'),
      numeric(`Vectơ u = (${n},0,0) có độ dài bằng bao nhiêu?`, n, 'Độ dài bằng căn tổng bình phương các tọa độ.'),
      numeric(`u = (${n},0,0), v = (2,0,0). Tích vô hướng u·v bằng bao nhiêu?`, 2 * n, 'Nhân các tọa độ tương ứng rồi cộng lại.')
    ],
    n => [
      text(`Nhóm có 1 nam đeo kính và ${n} nữ đeo kính. Chọn đều một người trong nhóm đeo kính. Xác suất chọn nữ là bao nhiêu?`, `${n}/${n + 1}`, [`1/${n + 1}`, `${n + 1}/${n}`, `1/${n}`], 'Sau khi giới hạn ở nhóm đeo kính, có n nữ trong n+1 người.'),
      text(`P(B)=1/2 và P(A giao B)=1/${2 * n}. P(A|B) bằng bao nhiêu?`, `1/${n}`, [`1/${2 * n}`, `1/${4 * n}`, '1'], 'P(A|B) = P(A giao B)/P(B); chia cho 1/2 tương đương nhân 2.'),
      text(`A và B độc lập, P(A)=1/${n}, P(B)>0. P(A|B) bằng bao nhiêu?`, `1/${n}`, ['0', '1', `1/${n + 1}`], 'Với hai biến cố độc lập, điều kiện B không làm thay đổi xác suất A.'),
      numeric(`P(B)=1/${n} và P(A giao B)=0. Xác suất P(A|B) bằng bao nhiêu?`, 0, 'P(B) dương nên áp dụng tỷ số; tử số bằng 0 làm xác suất có điều kiện bằng 0.'),
      text(`B có ${n * 2} kết quả đồng khả năng, trong đó ${n} kết quả thuộc A. P(A|B) là bao nhiêu?`, '1/2', ['1/3', '2/3', '1'], 'Trong không gian điều kiện B, tỷ lệ thuận lợi là n/(2n)=1/2.')
    ]
  ],
  physics: [
    n => [
      numeric(`Hệ nhận nhiệt Q=${10 * n} J và nhận công W=${5 * n} J. Với ΔU=Q+W, ΔU bằng bao nhiêu J?`, 15 * n, 'Theo quy ước nhận nhiệt và nhận công là dương, cộng hai năng lượng.'),
      numeric(`Hệ tỏa nhiệt Q=${-n} J và nhận công W=${3 * n} J. Với ΔU=Q+W, ΔU bằng bao nhiêu J?`, 2 * n, 'Cộng đại số nhiệt lượng âm và công dương.'),
      numeric(`ΔU=${6 * n} J, Q=${4 * n} J. Với ΔU=Q+W, công W hệ nhận bằng bao nhiêu J?`, 2 * n, 'W = ΔU - Q.'),
      numeric(`Hệ cách nhiệt Q=0, nhận công ${7 * n} J. Theo ΔU=Q+W, nội năng tăng bao nhiêu J?`, 7 * n, 'Không truyền nhiệt, độ tăng nội năng bằng công hệ nhận.'),
      numeric(`Hệ nhận nhiệt ${9 * n} J và thực hiện công ${4 * n} J ra ngoài. Nội năng tăng bao nhiêu J?`, 5 * n, 'Công hệ nhận là âm khi hệ thực hiện công ra ngoài: ΔU=9n-4n.')
    ],
    n => [
      numeric(`Đun 0,5 kg nước tăng thêm ${n} K, c=4200 J/(kg.K). Bỏ qua mất nhiệt và chuyển thể. Q bằng bao nhiêu J?`, 2100 * n, 'Dùng Q=mcΔT.'),
      numeric(`Vật có m=1 kg, c=1000 J/(kg.K), nhận ${1000 * n} J không chuyển thể. Nhiệt độ tăng bao nhiêu K?`, n, 'ΔT=Q/(mc).'),
      numeric(`Vật nhận ${2000 * n} J, c=1000 J/(kg.K), tăng 2 K không chuyển thể. Khối lượng bằng bao nhiêu kg?`, n, 'm=Q/(cΔT).'),
      numeric(`Vật ${n} kg, c=500 J/(kg.K), tăng 10 K không chuyển thể. Cần bao nhiêu J?`, 5000 * n, 'Nhân khối lượng, nhiệt dung riêng và độ tăng nhiệt độ.'),
      numeric(`Hai vật cùng chất tăng cùng nhiệt độ, khối lượng lần lượt ${n} kg và 1 kg. Tỷ số nhiệt lượng Q1/Q2 bằng bao nhiêu?`, n, 'Với cùng c và ΔT, nhiệt lượng tỷ lệ thuận với khối lượng.')
    ],
    n => [
      numeric(`Lượng khí lí tưởng giữ nguyên thể tích, T tăng từ 300 K lên ${300 * n} K. Tỷ số p2/p1 bằng bao nhiêu?`, n, 'Ở thể tích không đổi, p/T không đổi.'),
      numeric(`Nhiệt độ ${10 * n} °C tương ứng bao nhiêu K? Dùng T(K)=t(°C)+273,15.`, 10 * n + 273.15, 'Cộng 273,15 vào nhiệt độ theo độ C.'),
      numeric(`Khí lí tưởng giữ nguyên áp suất, T tăng từ 200 K lên ${200 * n} K. V2/V1 bằng bao nhiêu?`, n, 'Ở áp suất không đổi, V/T không đổi.'),
      numeric(`Khí lí tưởng giữ nguyên nhiệt độ, thể tích tăng ${n} lần. Tỷ số p1/p2 bằng bao nhiêu?`, n, 'pV không đổi nên áp suất sau bằng áp suất trước chia n.'),
      numeric(`Lượng khí xác định: p1=100 kPa, V1=2 L, T1=300 K. V2=2 L, T2=${300 * n} K. p2 bằng bao nhiêu kPa?`, 100 * n, 'Thể tích giữ nguyên; áp suất tỷ lệ với nhiệt độ tuyệt đối.')
    ],
    n => [
      numeric(`Dây dài 0,5 m, I=${n} A, B=0,2 T, vuông góc từ trường. Độ lớn lực từ bằng bao nhiêu N?`, 0.1 * n, 'F=BIl sin90°=BIl.'),
      numeric(`Dây mang dòng ${n} A đặt song song từ trường đều. Lực từ có độ lớn bao nhiêu N?`, 0, 'Góc bằng 0° hoặc 180° nên sinθ=0.'),
      numeric(`Dây dài 1 m, I=2 A đặt vuông góc từ trường chịu lực ${2 * n} N. B bằng bao nhiêu T?`, n, 'B=F/(Il).'),
      numeric(`B=0,5 T, dây dài 2 m vuông góc từ trường, F=${n} N. I bằng bao nhiêu A?`, n, 'I=F/(Bl).'),
      numeric(`B=0,5 T, I=2 A, dây vuông góc từ trường chịu lực ${n} N. Chiều dài dây bằng bao nhiêu m?`, n, 'l=F/(BI).')
    ],
    n => [
      numeric(`Một vòng dây S=2 m², B=${number(0.1 * n)} T, B cùng hướng pháp tuyến. Từ thông bằng bao nhiêu Wb?`, 0.2 * n, 'Φ=BS cos0°=BS.'),
      numeric(`B=${n} T, góc giữa B và pháp tuyến mặt phẳng bằng 90°. Từ thông bằng bao nhiêu Wb?`, 0, 'cos90°=0 nên từ thông bằng 0.'),
      numeric(`Một vòng S=2 m², B=${number(0.1 * n)} T, góc với pháp tuyến 60°. Từ thông bằng bao nhiêu Wb?`, 0.1 * n, 'Φ=BS cos60°, trong đó cos60°=1/2.'),
      numeric(`Từ thông qua một vòng dây biến thiên đều ${n} Wb trong 2 s. Suất điện động cảm ứng có độ lớn bao nhiêu V?`, n / 2, 'Độ lớn suất điện động bằng |ΔΦ/Δt|.'),
      numeric(`Cuộn 10 vòng có từ thông mỗi vòng biến thiên đều ${n} Wb trong 2 s. Độ lớn suất điện động bằng bao nhiêu V?`, 5 * n, 'Nhân tốc độ biến thiên từ thông qua mỗi vòng với số vòng.')
    ],
    n => [
      numeric(`Mẫu ban đầu có 800 hạt nhân chưa phân rã. Sau ${n} chu kỳ bán rã, còn bao nhiêu hạt theo mô hình?`, 800 / 2 ** n, 'Sau mỗi chu kỳ, lượng chưa phân rã giảm một nửa.'),
      numeric(`Sau ${n} chu kỳ bán rã, tỷ lệ hạt chưa phân rã còn bao nhiêu phần trăm?`, 100 / 2 ** n, 'Tỷ lệ còn lại bằng 100% nhân 2^(-n).'),
      numeric(`Chu kỳ bán rã là 5 ngày. ${n} chu kỳ tương ứng bao nhiêu ngày?`, 5 * n, 'Tổng thời gian bằng số chu kỳ nhân thời lượng mỗi chu kỳ.'),
      numeric(`Sau ${n} chu kỳ, còn 20 hạt nhân theo mô hình. Ban đầu có bao nhiêu hạt?`, 20 * 2 ** n, 'N0=N·2^n.'),
      numeric(`Ban đầu 800 hạt nhân. Sau ${n} chu kỳ, có bao nhiêu hạt đã phân rã theo mô hình?`, 800 - 800 / 2 ** n, 'Số đã phân rã bằng ban đầu trừ số chưa phân rã.')
    ]
  ],
  excel: [
    n => [
      numeric(`Bảng chi tiêu có một hàng tiêu đề và ${n} hàng giao dịch. Có bao nhiêu bản ghi giao dịch?`, n, 'Hàng tiêu đề mô tả cột và không tính là bản ghi dữ liệu.'),
      numeric(`Mỗi giao dịch có 4 thuộc tính. ${n} giao dịch đầy đủ chiếm bao nhiêu ô dữ liệu, không kể tiêu đề?`, n * 4, 'Số ô dữ liệu bằng số hàng bản ghi nhân số cột thuộc tính.'),
      numeric(`Tiêu đề nằm ở hàng 1. Giao dịch thứ ${n} nằm ở hàng số mấy nếu không có hàng trống?`, n + 1, 'Bản ghi đầu tiên ở hàng 2, do đó cộng thêm một hàng tiêu đề.'),
      text(`Bảng có ${n} giao dịch cần lọc theo danh mục. Thiết kế nào phù hợp?`, 'Mỗi giao dịch một hàng, mỗi thuộc tính một cột', ['Mỗi giao dịch nằm ở một ô gộp lớn', 'Mỗi dòng đặt tiêu đề ở cột khác nhau', 'Chèn hàng trống giữa mọi giao dịch để lọc'], 'Cấu trúc bảng nhất quán giúp bộ lọc hoạt động đúng.'),
      numeric(`Bảng có ${n} bản ghi. Thêm hai giao dịch mới và giữ nguyên giao dịch cũ. Tổng số bản ghi bằng bao nhiêu?`, n + 2, 'Thêm hai bản ghi vào số bản ghi đang có.')
    ],
    n => [
      numeric(`Excel: B2=${n}, C2=${n + 3}. Công thức =B2*C2 trả về bao nhiêu?`, n * (n + 3), 'Phép * nhân giá trị hai ô.'),
      numeric(`B2=${n + 3}, F1=2. Công thức =B2*$F$1 trả về bao nhiêu?`, (n + 3) * 2, 'Dấu $ giữ cố định F1 khi sao chép, không thay đổi phép nhân tại ô hiện tại.'),
      text(`Sao chép công thức =B${n}*$F$1 xuống một hàng. Công thức mới là gì?`, `=B${n + 1}*$F$1`, [`=B${n}*$F$2`, `=B${n + 1}*$F$2`, `=C${n}*$G$1`], 'B thay đổi số hàng tương đối; $F$1 giữ nguyên cả hàng và cột.'),
      text(`Sao chép =$B$${n} sang phải một cột. Công thức mới là gì?`, `=$B$${n}`, [`=$C$${n}`, `=$B$${n + 1}`, `=C${n}`], 'Tham chiếu tuyệt đối giữ nguyên địa chỉ khi sao chép.'),
      numeric(`A1=${n}, A2=2. Công thức =A1+A2*3 trả về bao nhiêu?`, n + 6, 'Nhân được thực hiện trước cộng nếu không có ngoặc thay đổi thứ tự.')
    ],
    n => [
      numeric(`A1:A3 chứa ${n}, ${n + 2}, ${n + 4}. =SUM(A1:A3) bằng bao nhiêu?`, 3 * n + 6, 'SUM cộng ba giá trị.'),
      numeric(`A1:A3 chứa ${n}, ${n + 2}, ${n + 4}. =AVERAGE(A1:A3) bằng bao nhiêu?`, n + 2, 'Tổng chia cho ba ô số.'),
      numeric(`A1=${n}, A2 là văn bản "x", A3 trống. =COUNT(A1:A3) bằng bao nhiêu?`, 1, 'COUNT chỉ đếm các ô có giá trị số.'),
      numeric(`A1=${n}, A2=0. =AVERAGE(A1:A2) bằng bao nhiêu?`, n / 2, 'Số 0 được tính vào mẫu số của trung bình.'),
      numeric(`A1=${n}, A2 trống. =AVERAGE(A1:A2) bằng bao nhiêu?`, n, 'Ô trống trong vùng tham chiếu không được tính như số 0.')
    ],
    n => [
      text(`C2=${n + 3}. =IF(C2>=5,"Đạt","Chưa đạt") trả về gì?`, 'Đạt', ['Chưa đạt', 'TRUE', '#VALUE!'], 'Giá trị từ 5 trở lên làm điều kiện đúng.'),
      text(`C2=${n}. =IF(C2>=5,"Đạt","Chưa đạt") trả về gì?`, 'Chưa đạt', ['Đạt', 'FALSE', '#REF!'], 'Giá trị 2 hoặc 4 nhỏ hơn 5 nên lấy nhánh sai.'),
      numeric(`A1=${n}. =IF(A1>0,A1*2,0) trả về bao nhiêu?`, 2 * n, 'A1 dương nên hàm trả kết quả A1*2.'),
      text(`A1=${n}. =IF(A1>${n},"Lớn hơn","Không lớn hơn") trả về gì?`, 'Không lớn hơn', ['Lớn hơn', 'Một ô trống', '#DIV/0!'], 'Giá trị đúng bằng ngưỡng không thỏa điều kiện >.'),
      text(`Dòng ${n} chưa có điểm ở ô C${n}. Muốn hiện “Chưa nhập” trước khi xét điểm, nên làm gì?`, 'Kiểm tra ô trống trước điều kiện đạt', ['Coi ô trống luôn là điểm 10', 'Xóa hẳn hàng dữ liệu', 'Bỏ qua mọi điều kiện'], 'Phân biệt chưa có dữ liệu với một điểm số cụ thể để tránh báo kết quả sai.')
    ],
    n => [
      numeric(`Bảng ${n + 6} giao dịch, bộ lọc giữ ${n} giao dịch. Có bao nhiêu hàng giao dịch tạm bị ẩn?`, 6, 'Lọc ẩn tạm các hàng không khớp chứ không xóa chúng.'),
      numeric(`Danh sách số tiền ${n}, ${n + 2}, ${n + 4}. Sau sắp xếp giảm dần, giá trị đầu là bao nhiêu?`, n + 4, 'Giảm dần đặt số lớn nhất ở đầu.'),
      numeric(`Danh sách số tiền ${n}, ${n + 2}, ${n + 4}. Sau sắp xếp tăng dần, giá trị đầu là bao nhiêu?`, n, 'Tăng dần đặt số nhỏ nhất ở đầu.'),
      text(`Bảng ${n + 6} đơn hàng có tên và số tiền. Muốn sắp xếp theo số tiền mà không lệch tên, nên chọn gì?`, 'Toàn bộ bảng dữ liệu liên quan', ['Chỉ cột số tiền và bỏ qua cột tên', 'Chỉ hàng tiêu đề', 'Chỉ một ô bất kỳ ngoài bảng'], 'Cần giữ các thuộc tính của cùng bản ghi di chuyển cùng nhau.'),
      numeric(`Bảng có ${n + 6} bản ghi, đang lọc còn ${n}. Xóa bộ lọc, nếu không sửa dữ liệu, sẽ hiện bao nhiêu bản ghi?`, n + 6, 'Xóa bộ lọc khôi phục hiển thị toàn bộ các hàng dữ liệu gốc.')
    ],
    n => [
      numeric(`Danh mục A có hai khoản chi ${n * 100} và ${n * 200}. PivotTable tổng theo danh mục cho A bằng bao nhiêu?`, n * 300, 'Phép tổng cộng cả hai khoản thuộc cùng danh mục.'),
      numeric(`PivotTable đang tổng A=${n * 100}. Thêm khoản A=100 rồi làm mới. Tổng A mới bằng bao nhiêu?`, n * 100 + 100, 'Sau refresh, khoản mới được cộng vào dữ liệu cùng nhóm.'),
      numeric(`Có ${n} danh mục khác nhau. Mỗi danh mục có giao dịch. PivotTable nhóm theo danh mục có bao nhiêu nhóm, không kể Grand Total?`, n, 'Mỗi giá trị danh mục khác nhau tạo một nhóm.'),
      text(`PivotTable của ${n + 5} giao dịch hiển thị Count thay vì Sum vì cột tiền chứa chuỗi. Cần kiểm tra điều gì?`, 'Kiểu dữ liệu số của cột tiền', ['Màu nền của bảng', 'Chiều rộng cột tên', 'Tên file ảnh của báo cáo'], 'Dữ liệu văn bản có thể khiến phép tổng hợp mặc định chuyển sang đếm.'),
      text(`Bạn thêm ${n} hàng vào bảng nguồn nhưng PivotTable chưa đổi. Thao tác nào cần thực hiện?`, 'Refresh PivotTable', ['Xóa mọi danh mục cũ', 'Chỉ đổi màu biểu đồ', 'Đóng báo cáo mà không cập nhật'], 'Refresh yêu cầu PivotTable tính lại từ nguồn hiện tại.')
    ]
  ]
};
module.exports = { banks, numeric, text };
