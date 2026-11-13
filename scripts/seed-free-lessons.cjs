const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const LopHoc = require('../src/models/LopHoc');
const BaiGiang = require('../src/models/BaiGiang');

// Original introductory material. Re-running only fills classes below six lessons.
// Run from the backend directory: node scripts/seed-free-lessons.cjs --apply
const catalogs = [
  { match: /ielts/i, key: 'speaking', label: 'SPEAKING', color: '#5366b8', lessons: [
    ['Làm quen Speaking Part 1', 'Trả lời trực tiếp câu hỏi, bổ sung một lý do rồi đưa ví dụ. Với câu hỏi quen thuộc, 2–4 câu rõ ý thường hữu ích hơn một câu trả lời dài nhưng lạc đề.', 'Ghi âm câu trả lời cho câu hỏi “What do you like about your hometown?”. Nghe lại và đánh dấu ý chính, lý do, ví dụ.'],
    ['Từ vựng về học tập và công việc', 'Học cụm từ theo ngữ cảnh: meet a deadline, gain experience, work in a team. Một cụm được dùng đúng tự nhiên có ích hơn nhiều từ khó ghép sai.', 'Viết 5 câu mô tả một ngày học tập bằng các cụm từ vừa học, sau đó nói lại mà không nhìn giấy.'],
    ['Kể một trải nghiệm trong Part 2', 'Dùng dàn ý bối cảnh, sự kiện chính, cảm xúc và bài học. Trong thời gian chuẩn bị, ghi từ khóa thay vì viết toàn bộ bài nói.', 'Chuẩn bị chủ đề “Describe a skill you learned”. Lập dàn ý trong một phút và ghi âm phần nói tối đa hai phút.'],
    ['Mở rộng ý trong Part 3', 'Nêu quan điểm, giải thích cơ chế hoặc nguyên nhân, rồi minh họa bằng tình huống cụ thể. Có thể so sánh hai góc nhìn khi câu hỏi yêu cầu thảo luận.', 'Trả lời “How has technology changed the way people learn?”. Đưa ra một lợi ích và một hạn chế có giải thích.'],
    ['Phát âm rõ: trọng âm và ngắt ý', 'Chia câu thành nhóm ý ngắn và nhấn các từ mang thông tin chính. Mục tiêu là dễ hiểu và ổn định, không phải bắt chước một giọng cụ thể.', 'Chọn đoạn nói 30 giây, đánh dấu chỗ ngắt hơi rồi thu âm hai lần để so sánh độ rõ ràng.'],
    ['Tự đánh giá một bài nói hoàn chỉnh', 'Đánh giá riêng độ mạch lạc, vốn từ, ngữ pháp và phát âm. Chọn một lỗi có thể sửa cho lần luyện tiếp theo; không quy đổi tự đánh giá thành điểm thi chính thức.', 'Ghi âm một lượt Part 1, Part 2 và Part 3. Ghi lại ba điểm tốt và hai việc cần luyện trong tuần tới.']
  ] },
  { match: /python/i, key: 'python', label: 'PYTHON', color: '#236c87', lessons: [
    ['Biến và kiểu dữ liệu cơ bản', 'Biến là tên tham chiếu đến một giá trị. Python có các kiểu thường gặp như int, float, str và bool. Ví dụ: age = 18; name = "An"; is_student = True.', 'Tạo ba biến mô tả một học viên. In giá trị và dùng type() để kiểm tra kiểu của từng biến.'],
    ['Nhập, xuất và chuyển đổi dữ liệu', 'input() trả về chuỗi; muốn tính toán cần chuyển kiểu phù hợp bằng int() hoặc float(). Ví dụ: price = float(input("Giá: ")); print(price * 2).', 'Viết chương trình nhập chiều dài và chiều rộng rồi in diện tích. Thử cả số nguyên và số thập phân.'],
    ['Rẽ nhánh với if, elif và else', 'Python dùng thụt lề để xác định khối lệnh. Toán tử == so sánh giá trị, còn = gán giá trị. Ví dụ: if score >= 5: print("Đạt") được viết thành khối có thụt lề.', 'Nhập một điểm từ 0 đến 10. Kiểm tra dữ liệu hợp lệ trước, sau đó thông báo đạt nếu điểm từ 5 trở lên.'],
    ['Vòng lặp và xử lý danh sách', 'for duyệt từng phần tử của một tập hợp; while lặp khi điều kiện còn đúng. range(1, 6) sinh các số từ 1 đến 5. Luôn kiểm tra điều kiện dừng của vòng lặp.', 'Dùng for tính tổng các số từ 1 đến n. So sánh kết quả với n * (n + 1) // 2.'],
    ['Viết hàm có tham số và giá trị trả về', 'Hàm gom một thao tác thành đơn vị có thể tái sử dụng. def khai báo hàm và return trả kết quả. Tách tính toán khỏi việc nhập xuất để dễ kiểm tra.', 'Viết hàm tinh_trung_binh(numbers). Quyết định cách xử lý danh sách rỗng và thử với ít nhất ba bộ dữ liệu.'],
    ['Dự án nhỏ: quản lý danh sách điểm', 'Dùng list lưu nhiều bản ghi và dict biểu diễn một học viên. Chia chương trình thành các hàm thêm học viên, tính trung bình và tìm điểm cao nhất.', 'Tạo danh sách 5 học viên. In báo cáo gồm tên, điểm trung bình và kết quả đạt; kiểm tra trường hợp đồng điểm.']
  ] },
  { match: /excel ứng dụng/i, key: 'excel', label: 'EXCEL', color: '#167967', lessons: [
    ['Tổ chức bảng dữ liệu đúng cách', 'Mỗi hàng biểu diễn một bản ghi, mỗi cột biểu diễn một thuộc tính và hàng đầu chứa tiêu đề rõ ràng. Tránh ô gộp và hàng trống trong vùng dữ liệu cần lọc.', 'Tạo bảng chi tiêu gồm ngày, danh mục, nội dung, số tiền. Nhập 12 bản ghi và chuyển vùng dữ liệu thành Table.'],
    ['Công thức và tham chiếu ô', 'Công thức bắt đầu bằng dấu =. A1 là tham chiếu tương đối; $A$1 cố định cả hàng và cột. Ví dụ =B2*$F$1 giữ nguyên ô chứa tỷ lệ khi sao chép xuống.', 'Tạo bảng đơn hàng và một ô tỷ lệ giảm giá. Tính thành tiền bằng tham chiếu tuyệt đối cho tỷ lệ.'],
    ['SUM, AVERAGE và COUNT', 'SUM cộng số, AVERAGE tính trung bình các ô có số, COUNT đếm ô chứa số. Ô trống và số 0 có ảnh hưởng khác nhau đến trung bình.', 'Tạo bảng điểm có một ô trống và một ô bằng 0. So sánh AVERAGE với tổng chia cho số học viên.'],
    ['IF và kiểm tra điều kiện', 'IF chọn kết quả theo một điều kiện. Ví dụ =IF(C2>=5,"Đạt","Chưa đạt"). Một số thiết lập vùng dùng dấu chấm phẩy để ngăn cách đối số.', 'Thêm cột kết quả cho bảng điểm. Kiểm tra riêng giá trị đúng bằng 5 và một ô chưa nhập điểm.'],
    ['Sắp xếp, lọc và tìm bản ghi', 'Sắp xếp thay đổi thứ tự bản ghi; lọc chỉ ẩn những hàng không khớp điều kiện. Chọn cả bảng để tránh làm lệch mối liên hệ giữa các cột.', 'Lọc các khoản chi lớn hơn 200000 và sắp xếp giảm dần. Xóa bộ lọc rồi xác nhận số hàng ban đầu.'],
    ['Báo cáo tổng hợp với PivotTable', 'PivotTable tổng hợp dữ liệu theo hàng, cột và phép tính. Kiểm tra kiểu dữ liệu số trước khi tổng hợp và làm mới báo cáo sau khi nguồn thay đổi.', 'Tạo PivotTable tổng chi theo danh mục, thêm một giao dịch vào bảng nguồn và làm mới báo cáo.']
  ] },
  { match: /toeic/i, key: 'toeic', label: 'TOEIC', color: '#b46a35', lessons: [
    ['Nhận diện chủ ngữ và động từ', 'Một câu hoàn chỉnh cần cấu trúc phù hợp. Trong câu “The manager reviews the report”, manager là danh từ làm chủ ngữ và reviews là động từ chính.', 'Gạch chân chủ ngữ và khoanh động từ chính trong 10 câu tiếng Anh về công việc.'],
    ['Phân biệt các loại từ trong Part 5', 'Vị trí trống quyết định loại từ cần điền. Tính từ thường bổ nghĩa danh từ, còn trạng từ có thể bổ nghĩa động từ. Hãy xem cấu trúc trước khi dịch cả câu.', 'Tạo bảng word family cho success, succeed, successful, successfully và viết một câu cho mỗi từ.'],
    ['Thì hiện tại trong ngữ cảnh công sở', 'Hiện tại đơn diễn tả thói quen hoặc lịch cố định; hiện tại tiếp diễn thường diễn tả việc đang xảy ra. Ví dụ: “We meet weekly” khác “We are meeting now”.', 'Viết 5 câu về lịch làm việc và 5 câu về những việc đang diễn ra, nêu dấu hiệu chọn thì.'],
    ['Nghe tranh: người, vật và hành động', 'Quan sát số người, vị trí đồ vật và hành động nhìn thấy được. Không suy diễn những thông tin không thể xác nhận từ bức ảnh.', 'Chọn một bức ảnh sinh hoạt. Viết 4 câu mô tả, trong đó chỉ một câu phản ánh chính xác toàn bộ chi tiết.'],
    ['Đọc email và tìm thông tin cụ thể', 'Đọc yêu cầu trước, tìm người gửi, mục đích và mốc thời gian liên quan. Chú ý cách diễn đạt tương đương thay vì chỉ dò từ giống hệt câu hỏi.', 'Viết email ngắn đổi lịch họp rồi tạo câu hỏi về người nhận, lý do đổi lịch và giờ họp mới.'],
    ['Luyện đề có ghi nhận lỗi', 'Phân biệt lỗi từ vựng, cấu trúc, suy luận và quản lý thời gian. Sau mỗi lượt luyện, giải thích vì sao đáp án đúng phù hợp và vì sao phương án còn lại sai.', 'Làm 15 câu tự luyện có bấm giờ. Lập bảng lỗi gồm câu hỏi, nguyên nhân và một ví dụ sửa lỗi.']
  ] },
  { match: /toán 12/i, key: 'math', label: 'TOAN HOC', color: '#7259a5', lessons: [
    ['Đạo hàm và chiều biến thiên', 'Trên một khoảng, dấu của đạo hàm giúp xét chiều biến thiên. Với f(x) = x² - 2x, ta có f′(x) = 2x - 2; hàm giảm trước x = 1 và tăng sau x = 1.', 'Xét chiều biến thiên của f(x) = x² - 4x + 1. Ghi rõ khoảng và điểm đạo hàm bằng 0.'],
    ['Cực trị và bảng biến thiên', 'Điểm có đạo hàm bằng 0 là ứng viên, không tự động là cực trị. Cần xét sự đổi dấu của đạo hàm; ví dụ x³ có đạo hàm bằng 0 tại 0 nhưng không có cực trị tại đó.', 'Lập bảng biến thiên của f(x) = x³ - 3x. Xác định các cực trị và giải thích bằng dấu của đạo hàm.'],
    ['Nguyên hàm cơ bản', 'Một nguyên hàm của f là hàm F thỏa F′ = f. Với n khác -1, nguyên hàm của xⁿ là xⁿ⁺¹/(n+1) + C. Luôn kiểm tra kết quả bằng phép đạo hàm.', 'Tìm nguyên hàm của 3x² - 4x + 2 và đạo hàm kết quả để kiểm chứng.'],
    ['Tích phân xác định', 'Nếu F là một nguyên hàm của hàm liên tục f trên [a,b], tích phân từ a đến b bằng F(b) - F(a). Kết quả có dấu nên không luôn bằng diện tích hình phẳng.', 'Tính tích phân của 2x trên [0,3] và so sánh với diện tích tam giác dưới đồ thị.'],
    ['Vectơ và tọa độ trong không gian', 'Vectơ AB có tọa độ bằng tọa độ B trừ A. Độ dài của vectơ (a,b,c) là căn bậc hai của a² + b² + c².', 'Cho A(1,2,0), B(4,6,0). Tìm vectơ AB, độ dài AB và tọa độ trung điểm của đoạn thẳng.'],
    ['Xác suất có điều kiện', 'Khi P(B) lớn hơn 0, P(A|B) = P(A giao B)/P(B). Điều kiện B làm thay đổi không gian xét; cần phân biệt với P(B|A).', 'Một nhóm có 6 nam và 4 nữ; 3 nam và 2 nữ đeo kính. Tính xác suất chọn được nữ khi biết người được chọn đeo kính.']
  ] },
  { match: /tiếng anh 10/i, key: 'english', label: 'ENGLISH', color: '#b55972', lessons: [
    ['Hiện tại đơn và thói quen hằng ngày', 'Với chủ ngữ he, she, it, động từ thường thêm s hoặc es ở câu khẳng định. Câu phủ định và câu hỏi dùng does với động từ nguyên mẫu.', 'Viết một đoạn 6 câu mô tả thói quen của một người thân, gồm ít nhất một câu phủ định.'],
    ['Hiện tại tiếp diễn và việc đang xảy ra', 'Cấu trúc am/is/are + V-ing diễn tả nhiều hành động đang diễn ra. Ví dụ “She is reading now”. Không nhầm động từ to be với trợ động từ do.', 'Quan sát lớp học và viết 5 câu về hành động đang xảy ra; chuyển 2 câu sang dạng hỏi.'],
    ['Quá khứ đơn và kể chuyện', 'Quá khứ đơn dùng động từ quá khứ trong câu khẳng định; câu hỏi và phủ định dùng did với động từ nguyên mẫu. Học động từ bất quy tắc trong câu hoàn chỉnh.', 'Kể một hoạt động cuối tuần bằng 8 câu, sử dụng went, saw, played và các từ nối chỉ trình tự.'],
    ['So sánh hơn và so sánh nhất', 'Tính từ ngắn thường dùng -er/-est; nhiều tính từ dài dùng more/most. Một số dạng bất quy tắc như good, better, best cần học riêng.', 'So sánh hai phương tiện đi học về chi phí, tốc độ và sự tiện lợi bằng ít nhất 5 câu.'],
    ['Đọc hiểu và đoán nghĩa theo ngữ cảnh', 'Tìm ý chính từ câu chủ đề, sau đó dùng các câu xung quanh để suy đoán từ chưa biết. Kiểm tra lại nghĩa đoán được có phù hợp với toàn đoạn hay không.', 'Đọc một đoạn 150 từ. Viết một câu tóm tắt, chọn 3 từ mới và giải thích bằng ngữ cảnh.'],
    ['Viết đoạn văn có câu chủ đề', 'Một đoạn văn rõ ý có câu chủ đề, các câu phát triển và câu kết phù hợp. Dùng ví dụ để hỗ trợ ý chính, tránh liệt kê nhiều ý không liên quan.', 'Viết đoạn 100–120 từ về một thói quen tốt cho việc học; kiểm tra chủ ngữ, động từ và dấu câu.']
  ] },
  { match: /mos/i, key: 'office', label: 'OFFICE', color: '#3571b0', lessons: [
    ['Word: định dạng bằng Styles', 'Styles quản lý định dạng nhất quán cho tiêu đề và nội dung. Dùng Heading 1, Heading 2 theo cấp bậc thay vì chỉ đổi cỡ chữ thủ công.', 'Tạo văn bản hai trang với 3 tiêu đề cấp 1 và 2 tiêu đề cấp 2. Thay đổi style để cập nhật toàn bộ tiêu đề.'],
    ['Word: bố cục trang và ngắt phần', 'Page Break bắt đầu trang mới; Section Break tạo phần có thể có bố cục riêng. Phân biệt hai loại trước khi thay hướng giấy hoặc số trang.', 'Tạo tài liệu ba trang, đặt một trang nằm ngang bằng section và kiểm tra lại đầu trang, chân trang.'],
    ['Word: bảng và mục lục', 'Bảng phù hợp cho dữ liệu có hàng và cột. Mục lục tự động dựa trên cấu trúc heading và cần cập nhật sau khi nội dung thay đổi.', 'Chèn bảng kế hoạch học tập và tạo mục lục tự động. Thêm một tiêu đề mới rồi cập nhật mục lục.'],
    ['Excel: Table và định dạng dữ liệu', 'Table tạo vùng dữ liệu có tiêu đề, bộ lọc và cơ chế mở rộng. Định dạng tiền tệ chỉ thay cách hiển thị; giá trị ô vẫn phải là số để tính toán.', 'Tạo bảng bán hàng 10 dòng, áp dụng định dạng tiền và thêm hàng tổng cuối bảng.'],
    ['Excel: công thức và hàm điều kiện', 'Dùng tham chiếu tương đối cho các hàng dữ liệu và tham chiếu tuyệt đối cho tham số cố định. IF giúp trả về kết quả theo điều kiện.', 'Tính thành tiền và trạng thái đạt doanh số cho 10 nhân viên, dùng một ô mục tiêu chung.'],
    ['Office: hoàn thiện một báo cáo', 'Báo cáo cần số liệu thống nhất, biểu đồ phù hợp và cấu trúc dễ đọc. Kiểm tra nguồn dữ liệu và xem trước khi xuất để phát hiện lỗi ngắt trang.', 'Tổng hợp số liệu trong Excel, tạo biểu đồ rồi chèn vào Word kèm nhận xét ba câu.']
  ] },
  { match: /vật lý/i, key: 'physics', label: 'VAT LY', color: '#267e91', lessons: [
    ['Nội năng và sự truyền năng lượng', 'Nội năng liên quan đến chuyển động và tương tác của các phân tử. Năng lượng của hệ có thể thay đổi qua truyền nhiệt và thực hiện công; cần nêu rõ quy ước dấu khi tính.', 'Mô tả điều gì xảy ra khi xoa hai bàn tay và khi đặt tay gần cốc nước ấm. Chỉ ra cách truyền năng lượng trong mỗi trường hợp.'],
    ['Nhiệt lượng và nhiệt dung riêng', 'Trong điều kiện không chuyển thể và nhiệt dung riêng coi như không đổi, Q = mcΔT. Khối lượng tính bằng kg, nhiệt dung riêng bằng J/(kg.K).', 'Tính nhiệt lượng để tăng nhiệt độ 0,5 kg nước thêm 20 K, dùng c = 4200 J/(kg.K), bỏ qua thất thoát.'],
    ['Khí lí tưởng và phương trình trạng thái', 'Với một lượng khí lí tưởng xác định, pV/T không đổi giữa các trạng thái cân bằng. Dùng nhiệt độ tuyệt đối theo kelvin; không thế trực tiếp độ C.', 'Một lượng khí giữ nguyên thể tích tăng nhiệt độ từ 300 K lên 450 K. Tính tỷ số áp suất sau và trước.'],
    ['Từ trường và lực từ', 'Với đoạn dây thẳng trong từ trường đều, độ lớn lực từ là F = BIl sinθ. Góc θ là góc giữa chiều dòng điện và vectơ cảm ứng từ.', 'So sánh lực từ khi dây song song và vuông góc với từ trường. Tính lực với B = 0,2 T, I = 3 A, l = 0,5 m ở trường hợp vuông góc.'],
    ['Từ thông và cảm ứng điện từ', 'Từ thông qua một vòng phẳng trong từ trường đều là Φ = BS cosα, với α là góc giữa B và pháp tuyến mặt phẳng. Suất điện động cảm ứng liên quan đến tốc độ biến thiên từ thông.', 'Giữ B và S không đổi, so sánh từ thông khi α bằng 0°, 60° và 90°. Giải thích vai trò của pháp tuyến.'],
    ['Phóng xạ và chu kỳ bán rã', 'Sau mỗi chu kỳ bán rã, số hạt nhân chưa phân rã giảm còn một nửa. Theo mô hình phân rã, N = N₀·2^(-t/T), với T là chu kỳ bán rã.', 'Một mẫu còn 1/8 số hạt ban đầu. Xác định số chu kỳ bán rã đã trôi qua và diễn giải kết quả.']
  ] },
  { match: /cơ sở dữ liệu/i, key: 'database', label: 'DATABASE', color: '#645caa', lessons: [
    ['Bảng, bản ghi và thuộc tính', 'Trong mô hình quan hệ, bảng tổ chức dữ liệu theo hàng và cột. Mỗi hàng là một bản ghi; mỗi cột có miền giá trị và ý nghĩa cụ thể.', 'Thiết kế bảng SinhVien gồm mã sinh viên, họ tên và email. Nhập 5 bản ghi rồi chỉ ra thuộc tính bắt buộc.'],
    ['Khóa chính và khóa ngoại', 'Khóa chính nhận diện duy nhất một bản ghi. Khóa ngoại biểu diễn tham chiếu sang bảng khác và hỗ trợ toàn vẹn tham chiếu khi được khai báo ràng buộc.', 'Thiết kế hai bảng LopHoc và SinhVien. Chọn khóa chính, khóa ngoại và mô tả quan hệ một–nhiều.'],
    ['Truy vấn SELECT và WHERE', 'SELECT chọn cột, FROM xác định bảng và WHERE lọc hàng. Dùng điều kiện rõ ràng và chỉ lấy những cột cần thiết.', 'Viết SELECT ma_sv, ho_ten FROM SinhVien WHERE ma_lop = "L01"; thay chuỗi bằng dấu nháy đơn theo cú pháp SQL đang sử dụng.'],
    ['Sắp xếp và tổng hợp dữ liệu', 'ORDER BY sắp xếp kết quả; GROUP BY gom các hàng theo khóa nhóm. COUNT, SUM và AVG tính thống kê trên từng nhóm.', 'Viết truy vấn đếm số sinh viên mỗi lớp và sắp xếp theo số lượng giảm dần.'],
    ['Kết hợp bảng bằng JOIN', 'INNER JOIN chỉ giữ các cặp hàng khớp điều kiện. LEFT JOIN giữ tất cả hàng bên trái và đưa NULL cho phần bên phải không có kết quả khớp.', 'Viết hai truy vấn liệt kê lớp và học viên bằng INNER JOIN và LEFT JOIN; giải thích trường hợp lớp chưa có học viên.'],
    ['Chuẩn hóa và giảm trùng lặp', 'Tách dữ liệu theo thực thể giúp giảm lỗi cập nhật. Thuộc tính của một bảng cần phụ thuộc phù hợp vào khóa của bảng đó; không lưu tên lớp lặp lại trong mọi dòng sinh viên nếu đã có bảng lớp.', 'Tách bảng đăng ký học chứa thông tin sinh viên, lớp và giảng viên thành các bảng phù hợp, rồi xác định khóa liên kết.']
  ] },
  { match: /kỹ năng|zzzz/i, key: 'study', label: 'STUDY SKILLS', color: '#417b71', lessons: [
    ['Đặt mục tiêu học tập có thể thực hiện', 'Một mục tiêu hữu ích mô tả kết quả quan sát được và thời hạn cụ thể. Thay “học tốt hơn” bằng “hoàn thành 20 câu luyện tập trước thứ Sáu và ghi lại các lỗi sai”.', 'Chọn một môn đang học, viết mục tiêu tuần này và chia thành ba việc có thể hoàn thành trong từng buổi.'],
    ['Lập kế hoạch tuần và ưu tiên công việc', 'Đưa các hạn nộp và lịch cố định vào lịch trước, sau đó phân bổ thời gian tự học. Giữ một khoảng đệm cho công việc phát sinh thay vì lấp kín toàn bộ lịch.', 'Lập lịch một tuần có giờ học, nghỉ và tự học. Chọn ba ưu tiên quan trọng nhất và nêu lý do.'],
    ['Ghi chép để hiểu và nhớ lâu', 'Ghi lại ý chính, mối quan hệ và câu hỏi còn vướng thay vì chép nguyên văn. Sau buổi học, tự tóm tắt nội dung bằng lời của mình.', 'Đọc một trang tài liệu. Đóng tài liệu và viết bản tóm tắt 5 câu, sau đó mở lại để bổ sung phần còn thiếu.'],
    ['Ôn tập bằng cách tự nhớ lại', 'Tự trả lời khi không nhìn tài liệu giúp nhận ra phần chưa nắm vững. Phân bố những lượt ôn ngắn ở các ngày khác nhau thay vì dồn toàn bộ vào một buổi.', 'Tạo 10 thẻ hỏi–đáp cho một chủ đề. Ôn lại sau một ngày và ghi nhận câu nào cần xem kỹ hơn.'],
    ['Làm việc nhóm với trách nhiệm rõ ràng', 'Nhóm cần thống nhất sản phẩm cuối, người phụ trách và hạn hoàn thành của từng đầu việc. Ghi nhận quyết định chung để giảm hiểu nhầm.', 'Lập bảng phân công cho dự án bốn người, gồm nhiệm vụ, người thực hiện, hạn nộp và tiêu chí hoàn thành.'],
    ['Chuẩn bị thuyết trình và tự đánh giá', 'Một bài trình bày dễ theo dõi có mở đầu nêu vấn đề, các ý chính có ví dụ và kết thúc rõ ràng. Luyện nói theo thời gian thực tế và dành chỗ cho câu hỏi.', 'Chuẩn bị bài nói ba phút về điều đã học trong tuần. Ghi âm, nghe lại và chọn hai điểm cần cải thiện.']
  ] }
];

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function contentFor([title, explanation, practice]) {
  return `<h2>${escapeHtml(title)}</h2><p>Bài học nhập môn gồm kiến thức trọng tâm và một hoạt động thực hành. Hãy chuẩn bị sổ ghi chép hoặc công cụ phù hợp trước khi bắt đầu.</p><h3>1. Kiến thức trọng tâm</h3><p>${escapeHtml(explanation)}</p><h3>2. Cách học</h3><ol><li>Đọc nội dung và diễn đạt lại ý chính bằng lời của bạn.</li><li>Ghi lại ví dụ hoặc tự xây dựng một trường hợp tương tự.</li><li>Đánh dấu điểm chưa hiểu để trao đổi với giảng viên.</li></ol><h3>3. Thực hành</h3><p>${escapeHtml(practice)}</p><h3>4. Tự kiểm tra</h3><p>Đối chiếu kết quả với kiến thức trọng tâm. Giải thích từng bước thực hiện, ghi một lỗi bạn đã sửa và viết một câu tóm tắt điều vừa học.</p>`;
}

function coverFor(catalog, number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${catalog.color}"/><stop offset="1" stop-color="#163858"/></linearGradient></defs><rect width="800" height="400" fill="url(#g)"/><circle cx="730" cy="65" r="190" fill="white" opacity=".07"/><circle cx="650" cy="390" r="150" fill="white" opacity=".06"/><path d="M540 135 Q595 115 640 140 L640 275 Q590 250 540 270 Z M640 140 Q690 115 740 135 L740 270 Q690 250 640 275 Z" fill="none" stroke="white" stroke-width="5" opacity=".55"/><text x="55" y="165" fill="white" font-family="Arial,sans-serif" font-size="38" font-weight="700">${catalog.label}</text><text x="55" y="225" fill="white" opacity=".75" font-family="Arial,sans-serif" font-size="22">LESSON ${String(number).padStart(2, '0')}</text><path d="M55 255 H145" stroke="white" stroke-width="5" opacity=".5"/></svg>`;
}

async function main() {
  const env = dotenv.parse(fs.readFileSync(path.join(__dirname, '../.env'), 'utf8'));
  const apply = process.argv.includes('--apply');
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const classes = await LopHoc.find().lean();
  let inserted = 0;
  const report = [];
  const output = path.join(__dirname, '../public/uploads/lesson-covers');
  if (apply) fs.mkdirSync(output, { recursive: true });
  for (const classroom of classes) {
    const catalog = catalogs.find((entry) => entry.match.test(classroom.ten_lop)) || catalogs[catalogs.length - 1];
    const existing = await BaiGiang.find({ id_lop_hoc: classroom._id }).select('ten_bai_giang maBaiGiang').lean();
    const needed = Math.max(0, 6 - existing.length);
    const candidates = catalog.lessons.map((lesson, index) => ({ lesson, index }))
      .filter(({ lesson }) => !existing.some((item) => item.ten_bai_giang === lesson[0])).slice(0, needed);
    for (const { lesson, index } of candidates) {
      const code = crypto.createHash('sha256').update(`free-lessons-v1:${classroom._id}:${index}`).digest('hex').slice(0, 12).toUpperCase();
      if (apply) {
        const cover = `${catalog.key}-${index + 1}.svg`;
        fs.writeFileSync(path.join(output, cover), coverFor(catalog, index + 1));
        const doc = new BaiGiang({
          maBaiGiang: code, id_lop_hoc: classroom._id,
          ten_bai_giang: lesson[0], gioiThieu: lesson[1],
          noi_dung_bai_hoc: contentFor(lesson),
          anhDaiDien: `/uploads/lesson-covers/${cover}`,
          giaBaiGiang: 0, thoi_gian_lam_bai: 15 + (index % 3) * 5,
          danhSachCauHoi: [],
          ngay_tao: new Date(Date.UTC(2026, 10, 13, 0, 0, 6 - index))
        });
        await doc.validate();
        const result = await BaiGiang.updateOne({ maBaiGiang: code }, { $setOnInsert: doc.toObject() }, { upsert: true });
        inserted += result.upsertedCount;
      }
    }
    const actual = apply ? await BaiGiang.countDocuments({ id_lop_hoc: classroom._id }) : existing.length + candidates.length;
    if (actual < 5) throw new Error('Class has fewer than five lessons after seeding');
    report.push({ className: classroom.ten_lop, lessons: actual, added: candidates.length });
  }
  if (apply) {
    const invalid = await BaiGiang.countDocuments({ maBaiGiang: /^[A-F0-9]{12}$/, $or: [{ giaBaiGiang: { $ne: 0 } }, { noi_dung_bai_hoc: '' }] });
    if (invalid) throw new Error('Seed validation failed');
  }
  console.log(JSON.stringify({ applied: apply, inserted, classes: report }, null, 2));
}
module.exports = { catalogs };
if (require.main === module) {
  const timeout = setTimeout(() => { console.error('Database operation timed out. Re-run safely to finish.'); process.exit(1); }, 90000);
  main().catch((error) => { console.error('Seeding failed: ' + error.name); process.exitCode = 1; })
    .finally(async () => { await mongoose.disconnect(); clearTimeout(timeout); });
}
