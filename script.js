const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('canvas-wrapper');
let lightningEffect = null;

const V_WIDTH = 480; 
const V_HEIGHT = 700;

function resizeCanvas() {
    const scaleX = wrapper.clientWidth / V_WIDTH;
    const scaleY = wrapper.clientHeight / V_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    canvas.width = V_WIDTH * scale;
    canvas.height = V_HEIGHT * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 150);

// --- HỆ THỐNG TRẠNG THÁI TRÒ CHƠI ---
let score = 0;          
let quizScore = 0;      
let lives = 3;
let health = 100; 
let currentLevel = 1;
let gameOver = false;
let gameStarted = false;
let showIntro = true;
let levelUpTimer = 0;
let isPaused = false; 

let inQuizMode = false;
let currentQuiz = null;
let quizFeedback = "";       
let quizFeedbackTimer = 0;  

let clouds = [
    { x: 40, y: 80, speed: 0.15, size: 25 },
    { x: 220, y: 120, speed: 0.08, size: 35 }
];

const pauseBtn = { x: V_WIDTH - 50, y: 15, w: 35, h: 35 };

// --- 🎵 HỆ THỐNG ÂM THANH CHUẨN (HỖ TRỢ NGẮT PHÁT TUYỆT ĐỐI) ---
let audioCtx = null;
let bgmOsc = null;
let bgmGain = null;
let bgmInterval = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    startBGM();
}

function startBGM() {
    // Nếu nhạc đang chạy thì không tạo thêm tránh bị trùng tiếng
    if (bgmOsc) return; 

    try {
        bgmOsc = audioCtx.createOscillator();
        bgmGain = audioCtx.createGain();
        
        let notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
        let noteIdx = 0;
        bgmOsc.type = 'triangle';
        bgmGain.gain.setValueAtTime(0.015, audioCtx.currentTime);
        
        bgmInterval = setInterval(() => {
            if (audioCtx && gameStarted && !gameOver && !inQuizMode && !isPaused && bgmOsc) {
                let now = audioCtx.currentTime;
                let freq = notes[noteIdx % notes.length];
                if (currentLevel === 5) freq *= 1.15;
                bgmOsc.frequency.setValueAtTime(freq, now);
                noteIdx++;
            }
        }, 500);
        
        bgmOsc.connect(bgmGain);
        bgmGain.connect(audioCtx.destination);
        bgmOsc.start();
    } catch(e) { console.log("Lỗi khởi tạo BGM:", e); }
}

function stopBGM() {
    // Xóa bộ đếm nốt nhạc và giải phóng Node âm thanh ngay lập tức để tắt tiếng triệt để
    if (bgmInterval) { clearInterval(bgmInterval); bgmInterval = null; }
    if (bgmOsc) {
        try { bgmOsc.stop(); bgmOsc.disconnect(); } catch(e){}
        bgmOsc = null;
    }
    if (bgmGain) { try { bgmGain.disconnect(); } catch(e){} bgmGain = null; }
}

function playSound(type) {
    if (!audioCtx || isPaused) return;
    try {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        if (type === 'correct') {
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc.start(); osc.stop(audioCtx.currentTime + 0.15);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(140, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(65, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            osc.start(); osc.stop(audioCtx.currentTime + 0.2);
        } else if (type === 'levelup') {
            osc.frequency.setValueAtTime(392, audioCtx.currentTime);
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime + 0.1);
            osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.2);
            osc.frequency.exponentialRampToValueAtTime(1046.5, audioCtx.currentTime + 0.35);
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc.start(); osc.stop(audioCtx.currentTime + 0.4);
        }
    } catch (e) {}
}

// --- 📦 KHO DỮ LIỆU RÁC THẢI ---
const trashData = [
    { text: "🍏", name: "Táo cắn dở", type: "organic" },
    { text: "🍌", name: "Vỏ chuối chín", type: "organic" },
    { text: "🍉", name: "Vỏ dưa hấu", type: "organic" },
    { text: "🍂", name: "Lá cây khô", type: "organic" }, 
    { text: "🥀", name: "Hoa héo", type: "organic" },
    { text: "🍃", name: "Lá chè hỏng", type: "organic" },
    { text: "🥚", name: "Vỏ trứng", type: "organic" },
    { text: "🦴", name: "Xương gà", type: "organic" },
    { text: "🌽", name: "Hạt ngô thối", type: "organic" }, 
    { text: "🥖", name: "Bánh mì mốc", type: "organic" },

    { text: "📦", name: "Hộp giấy vụn", type: "recyclable" },
    { text: "🍾", name: "Chai thủy tinh", type: "recyclable" },
    { text: "🥫", name: "Vỏ lon nước", type: "recyclable" },
    { text: "🥤", name: "Cốc trà sữa", type: "recyclable" },
    { text: "📰", name: "Sách báo cũ", type: "recyclable" },
    { text: "📚", name: "Sách vở cũ", type: "recyclable" }, 
    { text: "📎", name: "Ghim kẹp sắt", type: "recyclable" },
    { text: "🥛", name: "Vỏ hộp sữa", type: "recyclable" },
    { text: "⚙️", name: "Bánh răng sắt", type: "recyclable" },

    { text: "🛍️", name: "Túi nilon rách", type: "residual" },
    { text: "🚬", name: "Tàn thuốc lá", type: "residual" },
    { text: "🧱", name: "Mảnh gương vỡ", type: "residual" }, 
    { text: "🥣", name: "Bát sứ mẻ", type: "residual" },
    { text: "👟", name: "Giày vải rách", type: "residual" },
    { text: "🧻", name: "Giấy ăn đã dùng", type: "residual" },
    { text: "✏️", name: "Bút chì gãy", type: "residual" }, 
    { text: "🎈", name: "Xác bóng bay", type: "residual" },
    { text: "🍬", name: "Túi bánh kẹo", type: "residual" }, 

    { text: "🔋", name: "Cục Pin hỏng", type: "medical" },
    { text: "💉", name: "Kim tiêm y tế", type: "medical" },
    { text: "😷", name: "Khẩu trang bẩn", type: "medical" },
    { text: "🌡️", name: "Nhiệt kế vỡ", type: "medical" },
    { text: "🧪", name: "Lọ hóa chất", type: "medical" },
    { text: "💡", name: "Bóng đèn hỏng", type: "medical" },
    { text: "💊", name: "Thuốc hết hạn", type: "medical" },
    { text: "🩹", name: "Băng gạc cũ", type: "medical" }
];

let trashPool = [];

function replenishPool() {
    let available = trashData;
    if (currentLevel < 4) {
        available = trashData.filter(item => item.type !== 'medical');
    }
    trashPool = [...available];
    for (let i = trashPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [trashPool[i], trashPool[j]] = [trashPool[j], trashPool[i]];
    }
}

// --- ❓ NGÂN HÀNG 60 CÂU HỎI TRẮC NGHIỆM PHÂN THEO CẤP ĐỘ ---
const quizBank = {
    2: [
        { q: "Rác hữu cơ gồm những loại nào sau đây?", a: "A. Thức ăn thừa, lá cây khô, vỏ trái cây", b: "B. Túi nilon, cốc nhựa và vỏ lon sắt", c: "C. Pin hỏng và bóng đèn huỳnh quang", ans: "a" },
        { q: "Ủ rác hữu cơ tại nhà mang lại lợi ích gì?", a: "A. Tạo ra phân bón sinh học nuôi cây xanh", b: "B. Làm sạch nguồn nước ngầm trực tiếp", c: "C. Giúp rác biến thành kim loại quý", ans: "a" },
        { q: "Vỏ chuối và lõi táo được phân vào nhóm rác nào?", a: "A. Rác vô cơ tái chế", b: "B. Rác hữu cơ dễ phân hủy", c: "C. Rác nguy hại y tế", ans: "b" },
        { q: "Rác hữu cơ nếu vứt lẫn lộn vào bãi chôn lấp sẽ sinh ra khí gì?", a: "A. Khí Ô-xy tinh khiết", b: "B. Khí Mê-tan gây hiệu ứng nhà kính", c: "C. Khí Ni-tơ lỏng chống cháy", ans: "b" },
        { q: "Loại rác hữu cơ nào sau đây mất nhiều thời gian phân hủy nhất?", a: "A. Lá rau muống thừa", b: "B. Khúc xương động vật to", c: "C. Ruột quả dưa hấu chín", ans: "b" },
        { q: "Trước khi đem ủ phân, rác hữu cơ nên xử lý sơ bộ thế nào?", a: "A. Chặt nhỏ bớt để nhanh phân hủy", b: "B. Ngâm ngập hoàn toàn trong hóa chất tẩy rửa", c: "C. Đốt cháy thành than đen", ans: "a" },
        { q: "Phân hữu cơ tự ủ giúp đất trồng thay đổi như thế nào?", a: "A. Làm đất bị chai cứng, bạc màu", b: "B. Tăng độ tơi xốp và dinh dưỡng tự nhiên", c: "C. Làm đất nhiễm mặn nghiêm trọng", ans: "b" },
        { q: "Tại sao lá trà hỏng lại là rác hữu cơ lý tưởng?", a: "A. Vì chúng dễ mục nát và giàu đạm cho cây", b: "B. Vì chúng không bao giờ bốc mùi khét", c: "C. Vì chúng có thể ép thành nhựa tái sinh", ans: "a" },
        { q: "Xương cá và râu tôm sau bữa ăn thuộc nhóm rác nào?", a: "A. Rác vô cơ còn lại", b: "B. Rác hữu cơ", c: "C. Rác nguy hại sinh hoạt", ans: "b" },
        { q: "Hoa héo rơi ở sân trường nên bỏ vào thùng rác màu gì?", a: "A. Thùng màu Xanh lá (Hữu cơ)", b: "B. Thùng màu Trắng (Tái chế)", c: "C. Thùng màu Cam (Độc hại)", ans: "a" },
        { q: "Hành vi đổ nước canh thừa trực tiếp vào thùng rác khô gây ra điều gì?", a: "A. Làm rác phân hủy sạch sẽ nhanh hơn", b: "B. Gây rỉ nước bẩn, sinh mùi hôi thối dữ dội", c: "C. Giúp bảo quản thùng rác không gỉ sét", ans: "b" },
        { q: "Hạt trái cây (như hạt xoài, hạt nhãn) thuộc nhóm rác nào?", a: "A. Rác hữu cơ", b: "B. Rác vô cơ còn lại", c: "C. Rác y tế lây nhiễm", ans: "a" },
        { q: "Bánh mì bị mốc đen có nên gom đi tái chế nhựa không?", a: "A. Có, vì mọi thứ đều tái chế được", b: "B. Không, đây là rác hữu cơ dễ phân hủy", c: "C. Có, dùng làm nguyên liệu chế tạo gạch", ans: "b" },
        { q: "Sử dụng phân bón hữu cơ thay phân hóa học giúp ích gì?", a: "A. Bảo vệ hệ sinh vật đất và nguồn nước sạch", b: "B. Làm cây héo úa ngay lập tức", c: "C. Gây ô nhiễm môi trường đất nặng hơn", ans: "a" },
        { q: "Vì sao không nên vứt rác hữu cơ bừa bãi ra lòng đường?", a: "A. Làm mất mỹ quan và thu hút ruồi muỗi mang mầm bệnh", b: "B. Làm mặt đường bị chảy nhựa hỏng hóc", c: "C. Gây ra hiện tượng sụt lún mặt đường", ans: "a" }
    ],
    3: [
        { q: "Rác tái chế bao gồm các chất liệu cốt lõi nào?", a: "A. Giấy vụn, thùng carton, chai nhựa, lon nhôm", b: "B. Thức ăn thối và gạch đá vụn", c: "C. Kim tiêm và khẩu trang bẩn", ans: "a" },
        { q: "Hành động nào giúp thu gom giấy vụn học đường đúng cách?", a: "A. Gom sạch bán ve chai hoặc đưa tới nhà máy tái chế", b: "B. Vứt chung vào thùng nilon bẩn", c: "C. Đốt bỏ ngay sau buổi học", ans: "a" },
        { q: "Chai nhựa đựng nước sau khi dùng xong nên xử lý sơ bộ thế nào?", a: "A. Súc sạch nước thừa, làm xẹp nhỏ lại rồi bỏ vào thùng tái chế", b: "B. Cắt nát vứt ra vườn cỏ trường học", c: "C. Đổ đầy đất cát vào bên trong", ans: "a" },
        { q: "Tái chế 1 tấn giấy cũ giúp cứu sống khoảng bao nhiêu cây xanh?", a: "A. Khoảng 17 cây xanh trưởng thành", b: "B. Không cứu được cây nào", c: "C. Khoảng 500 cây cổ thụ", ans: "a" },
        { q: "Biểu tượng mũi tên hình tam giác xoay vòng trên đồ nhựa nghĩa là gì?", a: "A. Sản phẩm này có khả năng tái chế", b: "B. Sản phẩm chứa chất độc phóng xạ", c: "C. Đồ vật cấm chạm tay vào", ans: "a" },
        { q: "Lon nước ngọt bằng nhôm có thể tái chế bao nhiêu lần?", a: "A. Tái chế vô số lần không suy giảm chất lượng", b: "B. Chỉ tái chế được đúng 1 lần duy nhất", c: "C. Tối đa 3 lần rồi phải đem chôn", ans: "a" },
        { q: "Sách giáo khoa cũ không dùng nữa nên xử lý thế nào tốt nhất?", a: "A. Đem quyên góp tặng học sinh khóa sau hoặc gom tái chế giấy", b: "B. Vứt bỏ ra bãi rác sinh hoạt chung", c: "C. Xé nhỏ làm pháo giấy vui chơi", ans: "a" },
        { q: "Loại rác nào sau đây CÓ THỂ đưa vào dây chuyền tái chế giấy?", a: "A. Hộp giấy carton khô sạch", b: "B. Giấy ăn đã lau dầu mỡ bẩn", c: "C. Giấy bạc lót nướng thức ăn", ans: "a" },
        { q: "Việc tái chế kim loại giúp tiết kiệm bao nhiêu năng lượng so với khai thác mới?", a: "A. Tiết kiệm tới 75% - 95% năng lượng tiêu thụ", b: "B. Không tiết kiệm được chút nào", c: "C. Làm tiêu tốn năng lượng gấp đôi", ans: "a" },
        { q: "Vỏ hộp sữa giấy sau khi uống xong cần làm gì trước khi phân loại?", a: "A. Làm dẹp hộp, cho ống hút vào trong để gom tái chế", b: "B. Giữ nguyên khối chứa đầy cặn sữa thối", c: "C. Vứt bay ra cửa sổ lớp học", ans: "a" },
        { q: "Chai thủy tinh cũ được tái chế bằng phương pháp nào?", a: "A. Thu gom, rửa sạch, đập vụn rồi nung chảy tạo sản phẩm mới", b: "B. Chôn sâu dưới lòng đất 10 ngày để tự biến đổi", c: "C. Phơi nắng tự nhiên cho chảy ra", ans: "a" },
        { q: "Sản phẩm nào dưới đây là kết quả của việc tái chế hạt nhựa cũ?", a: "A. Thùng rác mới, sợi vải may áo thể thao, chậu cây nhựa", b: "B. Thức ăn đóng hộp cao cấp", c: "C. Thuốc chữa bệnh cho con người", ans: "a" },
        { q: "Tại sao hạt ghim sắt văn phòng lại thuộc nhóm rác tái chế?", a: "A. Vì là kim loại, có thể nung chảy thu hồi sắt sạch", b: "B. Vì nó có thể phân hủy thành đất mùn", c: "C. Vì nó làm bằng gỗ ép công nghiệp", ans: "a" },
        { q: "Khi mua sắm, việc chọn sản phẩm có bao bì tái chế giúp ích gì?", a: "A. Giảm khai thác tài nguyên nguyên sinh, giảm ô nhiễm", b: "B. Làm tăng giá thành sản phẩm lên gấp 10 lần", c: "C. Khiến bãi rác công cộng bị quá tải nhanh hơn", ans: "a" },
        { q: "Tại sao không nên vứt chai thủy tinh chung với rác hữu cơ?", a: "A. Gây nguy hiểm cho công nhân thu gom và không ủ phân được", b: "B. Làm thủy tinh biến thành chất độc ngấm vào đất", c: "C. Thủy tinh sẽ hút hết chất bổ của rác hữu cơ", ans: "a" }
    ],
    4: [
        { q: "Rác vô cơ còn lại (Residual) gồm những mặt hàng nào?", a: "A. Túi nilon rách, giấy ăn bẩn, tàn thuốc, mảnh sành", b: "B. Sách báo cũ và chai nhựa pet", c: "C. Kim tiêm và vỏ hộp thuốc kháng sinh", ans: "a" },
        { q: "Giấy ăn đã qua sử dụng lau bẩn có tái chế được không?", a: "A. Không, vì chứa chất bẩn sinh học, phải phân vào rác vô cơ", b: "B. Có, đưa vào máy tái chế thành giấy viết mới bình thường", c: "C. Có, dùng làm chất nền chế tạo nhựa cứng", ans: "a" },
        { q: "Túi nilon thông thường mất khoảng bao lâu để phân hủy tự nhiên?", a: "A. Khoảng từ 100 năm đến 500 năm hoặc lâu hơn", b: "B. Chỉ cần 2 tuần lễ nắng hè", c: "C. Đúng 1 năm rưỡi", ans: "a" },
        { q: "Mảnh gương vỡ hoặc bát sứ mẻ nên xử lý thế nào để an toàn?", a: "A. Gói bọc kỹ trong giấy báo/hộp dày rồi bỏ thùng rác vô cơ", b: "B. Ném trực tiếp xuống ao hồ gần trường", c: "C. Rải đều ra lòng đường nhựa", ans: "a" },
        { q: "Tại sao xác bóng bay cao su sau sự kiện lại là rác vô cơ?", a: "A. Vì đã chứa tạp chất và không thể tái chế hay ủ phân", b: "B. Vì bóng bay có thể tự bay biến mất sau vài tiếng", c: "C. Vì bóng bay làm từ kim loại lỏng", ans: "a" },
        { q: "Hành động đốt rác nilon tự do tại bãi rác lộ thiên sinh ra chất độc gì?", a: "A. Khí Đi-ô-xin cực độc gây ung thư và dị tật dị dạng", b: "B. Khí Hê-li giúp giọng nói thanh cao", c: "C. Khí hơi nước mát lành", ans: "a" },
        { q: "Hạn chế sử dụng túi nilon bằng cách nào hiệu quả nhất?", a: "A. Thay bằng túi vải sử dụng nhiều lần khi đi chợ", b: "B. Dùng xong ném ngay xuống sông để trôi đi nơi khác", c: "C. Chuyển sang dùng túi làm bằng da động vật quý hiếm", ans: "a" },
        { q: "Vỏ kẹo, vỏ bánh làm từ màng nhôm phức hợp thuộc nhóm rác nào?", a: "A. Rác vô cơ còn lại", b: "B. Rác hữu cơ dễ tiêu", c: "C. Rác nguy hại y tế", ans: "a" },
        { q: "Bút chì gãy gỗ kèm lõi than đen thuộc phân loại rác nào?", a: "A. Rác vô cơ còn lại", b: "B. Rác tái chế giấy", c: "C. Rác độc hại sinh học", ans: "a" },
        { q: "Đồ chơi nhựa bị vỡ nát, cháy sém nặng được gom vào thùng rác nào?", a: "A. Thùng rác Vô cơ còn lại (Màu xám/đen)", b: "B. Thùng rác Hữu cơ phân hủy", c: "C. Thùng rác Tái chế màu trắng", ans: "a" },
        { q: "Rác vô cơ còn lại thường được xử lý cuối cùng bằng biện pháp gì?", a: "A. Chôn lấp hợp vệ sinh hoặc thiêu đốt thu hồi năng lượng", b: "B. Đổ trực tiếp ra đại dương xa bờ", c: "C. Đem nghiền thành bột làm thức ăn gia súc", ans: "a" },
        { q: "Tại sao khẩu trang vải thông thường bị rách nát lại xếp vào rác vô cơ?", a: "A. Vì sợi vải pha nilon không còn khả năng phân hủy nhanh hay tái chế", b: "B. Vì vải có thể tự tan trong nước mưa", c: "C. Vì khẩu trang cấu tạo hoàn toàn bằng kim loại", ans: "a" },
        { q: "Giày dép da cũ rách nát hoàn toàn được xếp vào nhóm rác nào?", a: "A. Rác vô cơ còn lại", b: "B. Rác hữu cơ", c: "C. Rác tái chế kim loại", ans: "a" },
        { q: "Băng dính dán tường đã bóc ra bẩn thuộc phân loại rác nào?", a: "A. Rác vô cơ còn lại", b: "B. Rác tái chế siêu cấp", c: "C. Rác hữu cơ sân vườn", ans: "a" },
        { q: "Vì sao việc phân loại rác vô cơ giúp ích cho công nhân môi trường?", a: "A. Giúp giảm khối lượng rác chôn lấp, dễ xử lý công nghiệp", b: "B. Giúp công nhân tìm được nhiều đồ cổ quý", c: "C. Khiến xe chở rác chạy nhanh hơn", ans: "a" }
    ],
    5: [
        { q: "Rác thải nguy hại y tế và độc hại gia đình gồm những vật phẩm nào?", a: "A. Pin hỏng, bóng đèn vỡ, kim tiêm, nhiệt kế thủy ngân, thuốc hết hạn", b: "B. Vỏ lon bia và lõi ngô thối", c: "C. Sách giáo khoa cũ rách giấy", ans: "a" },
        { q: "Tại sao tuyệt đối không vứt pin cũ chung với rác vô cơ thông thường?", a: "A. Rò rỉ kim loại nặng (chì, thủy ngân) gây ô nhiễm đất, nguồn nước ngầm", b: "B. Vì pin cũ sẽ tự nổ tung biến thành vàng", c: "C. Vì pin quá nặng làm gãy bánh xe rác", ans: "a" },
        { q: "Nhiệt kế thủy ngân bị vỡ ra chất lỏng màu bạc, chất đó có độc không?", a: "A. Cực kỳ độc, bay hơi gây hại cho hệ thần kinh và phổi người hít phải", b: "B. Hoàn toàn vô hại, có thể dùng bôi lên da", c: "C. Rất bổ dưỡng, giúp làm mát cơ thể", ans: "a" },
        { q: "Biện pháp xử lý tối ưu nhất đối với rác thải y tế lây nhiễm độc hại là gì?", a: "A. Đốt trong lò hấp/lò thiêu chuyên dụng ở nhiệt độ cực cao", b: "B. Rửa sạch bằng nước xà phòng rồi bán lại", c: "C. Chôn chung với rác hữu cơ làm phân bón", ans: "a" },
        { q: "Khẩu trang bẩn, bông băng dính máu ở trạm y tế thuộc thùng rác màu gì?", a: "A. Thùng rác màu Vàng hoặc Cam (Cảnh báo lây nhiễm/Độc hại)", b: "B. Thùng rác màu Xanh bộ đội", c: "C. Thùng rác tái chế màu trắng", ans: "a" },
        { q: "Bóng đèn huỳnh quang hỏng chứa chất khí độc nào bên trong?", a: "A. Hơi thủy ngân cực độc", b: "B. Khí Ô-xy tự nhiên", c: "C. Khí Gas nấu ăn gia đình", ans: "a" },
        { q: "Thuốc chữa bệnh quá hạn sử dụng nên xử lý thế nào ở nhà?", a: "A. Gom riêng giao cho đơn vị xử lý rác nguy hại, không vứt bừa bãi", b: "B. Nghiền nhỏ đổ vào bể nước ăn", c: "C. Trộn với thức ăn cho vật nuôi ăn đỡ phí", ans: "a" },
        { q: "Vỏ chai lọ chứa hóa chất tẩy rửa mạnh, thuốc trừ sâu thuộc loại rác nào?", a: "A. Rác thải nguy hại, độc hại", b: "B. Rác tái chế thông thường", c: "C. Rác hữu cơ sân vườn", ans: "a" },
        { q: "Một viên pin tự nhiên chôn lấp có thể làm ô nhiễm bao nhiêu lít nước?", a: "A. Khoảng 500.000 lít nước sạch", b: "B. Không làm ô nhiễm giọt nào", c: "C. Chỉ khoảng 1 lít nước", ans: "a" },
        { q: "Lọ sơn móng tay cũ còn thừa hóa chất thuộc nhóm rác nào?", a: "A. Rác nguy hại độc hại", b: "B. Rác hữu cơ nhà bếp", c: "C. Rác tái chế nhựa", ans: "a" },
        { q: "Băng gạc cá nhân sau khi băng bó vết thương hở nên vứt vào đâu?", a: "A. Thùng rác y tế/độc hại để tiêu hủy an toàn", b: "B. Thùng rác giấy tái chế", c: "C. Thả trôi sông tự do", ans: "a" },
        { q: "Hóa chất diệt muỗi hết hạn sử dụng có được đổ xuống cống thoát nước không?", a: "A. Tuyệt đối không, vì gây chết cá và nhiễm độc toàn bộ nguồn nước công cộng", b: "B. Có thể đổ thoải mái vì nước cống sẽ tự lọc sạch", c: "C. Đổ xuống giúp khử trùng cống tốt hơn", ans: "a" },
        { q: "Linh kiện điện tử cũ (như bo mạch máy tính, điện thoại hỏng) chứa chất độc gì?", a: "A. Các kim loại nặng như Chì, Cadimi, Thạch tín", b: "B. Hoàn toàn làm bằng đất sét nung", c: "C. Chứa nước tinh khiết đóng băng", ans: "a" },
        { q: "Ký hiệu đầu lâu xương chéo trên vỏ chai rác thải nghĩa là gì?", a: "A. Chất cực độc, nguy hiểm chết người, cấm chạm trực tiếp", b: "B. Đồ chơi dành cho trẻ em", c: "C. Sản phẩm nước uống tăng lực", ans: "a" },
        { q: "Khi nhặt pin cũ rơi ở lớp, em nên làm gì để bảo vệ bản thân?", a: "A. Dùng kẹp hoặc đeo găng tay nhặt bỏ thùng thu gom pin, rửa sạch tay", b: "B. Ngậm vào miệng xem pin còn điện không", c: "C. Đập vỡ ra xem chất bột bên trong", ans: "a" }
    ]
};

let bins = [
    { id: "organic", name: "HỮU CƠ", color1: "#2ecc71", color2: "#27ae60", x: 0, y: 595, w: 92, h: 80 },
    { id: "recyclable", name: "TÁI CHẾ", color1: "#3498db", color2: "#2980b9", x: 0, y: 595, w: 92, h: 80 },
    { id: "residual", name: "VÔ CƠ", color1: "#95a5a6", color2: "#7f8c8d", x: 0, y: 595, w: 92, h: 80 },
    { id: "medical", name: "ĐỘC HẠI", color1: "#e67e22", color2: "#d35400", x: 0, y: 595, w: 92, h: 80 }
];

let fallingItems = [];
let draggingItem = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let particles = [];

let feedbackText = ""; let feedbackColor = ""; let feedbackTimer = 0;
function showFeedback(text, color) {
    feedbackText = text; feedbackColor = color; feedbackTimer = 40;
}

function spawnItem() {
    if (trashPool.length === 0) { replenishPool(); }
    let raw = trashPool.pop();
    
    let maxDuration = Math.max(9, 18 - currentLevel * 1.5); 

    fallingItems.push({
        id: Math.random(),
        text: raw.text, name: raw.name, type: raw.type,
        x: Math.random() * (V_WIDTH - 140) + 70,
        // 🌟 ĐÃ GIÃN CÁCH XA SO LE NHAU RẤT RÕ RÀNG (Khoảng cách lên tới 200px)
        y: -60 - (fallingItems.length * 200), 
        angle: Math.random() * 5,
        windShift: (Math.random() - 0.5) * 1.2,
        timeLeft: maxDuration, 
        maxTime: maxDuration   
    });
}

function rearrangeBins() {
    let activeCount = (currentLevel >= 4) ? 4 : 3;
    let padding = (V_WIDTH - (activeCount * 92)) / (activeCount + 1);
    let activeBins = (currentLevel >= 4) ? bins : bins.filter(b => b.id !== 'medical');
    activeBins.forEach((bin, idx) => { bin.x = padding + idx * (92 + padding); });
}

function triggerQuiz(level) {
    stopBGM(); // 🌟 SỬA TRIỆT ĐỂ: Tắt nhạc nền lập tức khi mở Quiz
    inQuizMode = true;
    
    // Bốc ngẫu nhiên 1 câu hỏi trong kho 15 câu của cấp độ đó
    let questionsList = quizBank[level];
    let randomIndex = Math.floor(Math.random() * questionsList.length);
    currentQuiz = questionsList[randomIndex];
    
    quizFeedback = "";
    quizFeedbackTimer = 0;
}

function checkLevelProgress() {
    let newLevel = 1;
    // 🌟 ĐÃ SỬA: Khung điểm nâng cao kéo dài thời gian chơi, chạm mốc 1000đ sẽ khốc liệt tung nóc
    if (score >= 1000) newLevel = 5;
    else if (score >= 700) newLevel = 4;
    else if (score >= 400) newLevel = 3;
    else if (score >= 150) newLevel = 2;

    if (newLevel !== currentLevel) {
        currentLevel = newLevel;
        levelUpTimer = 80;
        playSound('levelup');
        rearrangeBins();
        fallingItems = []; 
        trashPool = [];
        triggerQuiz(currentLevel); 
    }
}

function decreaseHealth(amount) {
    health -= amount;
    if (health <= 0) {
        lives--;
        health = 100; 
        if (lives <= 0) {
            gameOver = true;
            stopBGM(); // 🌟 SỬA TRIỆT ĐỂ: Tắt nhạc nền lập tức khi thua cuộc Game Over
        }
    }
}

function createParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 2,
            radius: Math.random() * 3 + 2,
            color: color, alpha: 1
        });
    }
}

// --- VÒNG LẶP ĐỒ HỌA CHÍNH (GAME LOOP) ---
function gameLoop() {
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

    let skyGrad = ctx.createLinearGradient(0, 0, 0, V_HEIGHT);
    skyGrad.addColorStop(0, '#eef7f6'); 
    skyGrad.addColorStop(1, '#d5eadd');
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    clouds.forEach(c => {
        if (!isPaused && !showIntro && !inQuizMode && !gameOver) c.x += c.speed;
        if (c.x - 40 > V_WIDTH) c.x = -40;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2); ctx.fill();
    });

    ctx.fillStyle = "#27ae60"; ctx.fillRect(0, 580, V_WIDTH, 120);

    if (showIntro) {
        ctx.fillStyle = "#27ae60"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
        ctx.fillText("HÀNH TRÌNH XANH LÂM ĐỒNG - BẢN 8.0", V_WIDTH / 2, 90);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)"; ctx.fillRect(25, 130, 430, 360);
        ctx.lineWidth = 2; ctx.strokeStyle = "#27ae60"; ctx.strokeRect(25, 130, 430, 360);

        ctx.fillStyle = "#2c3e50"; ctx.font = "12px Arial"; ctx.textAlign = "left";
        let lines = [
            "🏆 Thăng cấp bậc: Cấp 1 (150đ) | Cấp 2 (400đ) | Cấp 3 (700đ) | Cấp 4 (1000đ)",
            "🔥 Thử thách tối thượng: Mốc 1000đ sẽ kích hoạt chế độ siêu khó tung nóc!",
            "📚 Tri thức xáo trộn: Ngân hàng 60 câu hỏi chọn ngẫu nhiên không lặp nhàm chán.",
            "🔇 Âm thanh chuẩn: Tắt nhạc nền tuyệt đối khi làm Quiz trắc nghiệm.",
            "🐌 Tốc độ: Rác rơi siêu chậm rãi, giãn cách khoảng cách cực kỳ an toàn.",
            "⏸️ Tạm dừng: Click biểu tượng [||] ở góc trên bên phải để dừng trò chơi bất cứ lúc nào."
        ];
        lines.forEach((line, idx) => ctx.fillText(line, 40, 165 + idx * 32));

        ctx.fillStyle = "#27ae60"; ctx.fillRect(140, 515, 200, 46);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "center";
        ctx.fillText("BẮT ĐẦU THỬ THÁCH", V_WIDTH / 2, 543);
        requestAnimationFrame(gameLoop); return;
    }

    // GIAO DIỆN CÂU HỎI TRẮC NGHIỆM
    if (inQuizMode && currentQuiz) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.88)"; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);
        ctx.fillStyle = "#f1c40f"; ctx.font = "bold 17px Arial"; ctx.textAlign = "center";
        ctx.fillText("🌟 THỬ THÁCH KIẾN THỨC MÔI TRƯỜNG 🌟", V_WIDTH / 2, 95);
        
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 13px Arial";
        // Tự động xuống dòng cho câu hỏi dài
        let words = currentQuiz.q.split(' ');
        let line = '';
        let startY = 140;
        for(let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            if (testLine.length > 55) {
                ctx.fillText(line, V_WIDTH / 2, startY);
                line = words[n] + ' ';
                startY += 22;
            } else { line = testLine; }
        }
        ctx.fillText(line, V_WIDTH / 2, startY);

        let opts = [
            { id: "a", text: currentQuiz.a, y: 240 },
            { id: "b", text: currentQuiz.b, y: 310 },
            { id: "c", text: currentQuiz.c, y: 380 }
        ];

        opts.forEach(opt => {
            ctx.fillStyle = "#34495e"; ctx.fillRect(35, opt.y, 410, 50);
            ctx.lineWidth = 1; ctx.strokeStyle = "#ffffff"; ctx.strokeRect(35, opt.y, 410, 50);
            ctx.fillStyle = "#ffffff"; ctx.font = "12px Arial"; ctx.textAlign = "left";
            ctx.fillText(opt.text, 50, opt.y + 29);
        });

        if (quizFeedbackTimer > 0) {
            ctx.fillStyle = quizFeedback.includes("ĐÚNG") ? "#2ecc71" : "#e74c3c";
            ctx.font = "bold 15px Arial"; ctx.textAlign = "center";
            ctx.fillText(quizFeedback, V_WIDTH / 2, 475);
            quizFeedbackTimer--;
            if (quizFeedbackTimer <= 0) {
                inQuizMode = false;
                currentQuiz = null;
                startBGM(); // Kích hoạt lại nhạc nền sau khi đóng màn hình Quiz
            }
        }

        requestAnimationFrame(gameLoop); return;
    }

    // GIAO DIỆN KẾT THÚC GAME
    if (gameOver) {
        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 32px Arial"; ctx.textAlign = "center";
        ctx.fillText("TRÒ CHƠI KẾT THÚC", V_WIDTH / 2, 220);
        
        ctx.fillStyle = "#2c3e50"; ctx.font = "bold 16px Arial";
        ctx.fillText("Điểm phân loại: " + score + " Điểm", V_WIDTH / 2, 270);
        ctx.fillStyle = "#27ae60";
        ctx.fillText("Điểm thưởng Trắc nghiệm: +" + quizScore + " Điểm", V_WIDTH / 2, 300);
        
        ctx.fillStyle = "#d35400"; ctx.font = "bold 22px Arial";
        ctx.fillText("TỔNG ĐIỂM CHUNG CUỘC: " + (score + quizScore) + " ĐIỂM", V_WIDTH / 2, 340);

        ctx.fillStyle = "#3498db"; ctx.fillRect(160, 400, 160, 46);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 15px Arial"; ctx.fillText("CHƠI LẠI", V_WIDTH / 2, 428);
        requestAnimationFrame(gameLoop); return;
    }

    // GIAO DIỆN TẠM DỪNG (PAUSE GAME)
    if (isPaused) {
        ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 24px Arial"; ctx.textAlign = "center";
        ctx.fillText("ĐANG TẠM DỪNG TRÒ CHƠI", V_WIDTH / 2, 300);
        ctx.font = "14px Arial";
        ctx.fillText("Nhấn nút [▶] ở góc trên bên phải để chơi tiếp", V_WIDTH / 2, 340);
        
        ctx.fillStyle = "#2ecc71"; ctx.beginPath(); ctx.roundRect(pauseBtn.x, pauseBtn.y, pauseBtn.w, pauseBtn.h, 6); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center";
        ctx.fillText("▶", pauseBtn.x + pauseBtn.w/2, pauseBtn.y + pauseBtn.h/2 + 4);
        requestAnimationFrame(gameLoop); return;
    }

    // CHỈ SỐ HUD CHÍNH
    ctx.fillStyle = "#2c3e50"; ctx.font = "bold 14px Arial"; ctx.textAlign = "left";
    ctx.fillText("🏆 ĐIỂM: " + score, 20, 35);
    ctx.fillText("⚡ CẤP ĐỘ: " + currentLevel, 20, 58);
    ctx.textAlign = "right"; ctx.fillText("MẠNG: " + "❤️".repeat(lives), V_WIDTH - 70, 35);
    
    ctx.textAlign = "left"; ctx.fillText("HP: ", 220, 35);
    ctx.fillStyle = "#bdc3c7"; ctx.fillRect(255, 24, 130, 14);
    ctx.fillStyle = health > 30 ? "#2ecc71" : "#e74c3c"; 
    ctx.fillRect(255, 24, (health / 100) * 130, 14);

    // VẼ KHỐI NÚT TẠM DỪNG || CHUẨN ĐỒ HỌA
    ctx.fillStyle = "#7f8c8d"; ctx.beginPath(); ctx.roundRect(pauseBtn.x, pauseBtn.y, pauseBtn.w, pauseBtn.h, 6); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center";
    ctx.fillText("||", pauseBtn.x + pauseBtn.w/2, pauseBtn.y + pauseBtn.h/2 + 4);

    let activeCount = (currentLevel >= 4) ? 4 : 3;
    let activeBins = bins.slice(0, activeCount);

    activeBins.forEach(bin => {
        let grad = ctx.createLinearGradient(bin.x, bin.y, bin.x, bin.y + bin.h);
        grad.addColorStop(0, bin.color1); grad.addColorStop(1, bin.color2);
        ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(bin.x, bin.y, bin.w, bin.h, 8); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(bin.x, bin.y, bin.w, 15);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center";
        ctx.fillText(bin.name, bin.x + bin.w / 2, bin.y + bin.h / 2 + 6);
    });

    let maxItemsOnScreen = 1;
    if (currentLevel === 2) maxItemsOnScreen = 2;
    if (currentLevel === 3) maxItemsOnScreen = 2;
    if (currentLevel >= 4) maxItemsOnScreen = 3; 

    if (fallingItems.length < maxItemsOnScreen && Math.random() < 0.03) {
        spawnItem();
    }

    for (let i = fallingItems.length - 1; i >= 0; i--) {
        let item = fallingItems[i];

        if (draggingItem && draggingItem.id === item.id) {
            item.timeLeft -= 1/60;
        } else {
            // 🌟 ĐÃ SỬA: Giảm tốc độ rơi xuống tối đa giúp trò chơi vô cùng thong thả, vừa tay các em học sinh
            let fallSpeed = 0.4 + (currentLevel * 0.25);
            if (currentLevel === 5) fallSpeed = 2.8; // Cấp 5 khốc liệt lượn sóng
            item.y += fallSpeed;
            item.timeLeft -= 1/60; 

            if (currentLevel === 3 || currentLevel === 4) {
                item.angle += 0.02; item.x += Math.sin(item.angle) * 0.8;
            } else if (currentLevel === 5) {
                item.angle += 0.06; item.x += Math.sin(item.angle) * 1.8 + item.windShift;
            }

            if (item.x < 30) item.x = 30;
            if (item.x > V_WIDTH - 30) item.x = V_WIDTH - 30;

            if (item.y > 580) {
                decreaseHealth(15); 
                playSound('wrong'); showFeedback("Lọt rác mất rồi! Hao máu 😟", "#e67e22");
                fallingItems.splice(i, 1); continue;
            }
        }

        if (item.timeLeft <= 0) {
            decreaseHealth(15);
            playSound('wrong'); showFeedback("Hết thời gian xử lý rác! ⏰", "#e74c3c");
            if (draggingItem && draggingItem.id === item.id) draggingItem = null;
            fallingItems.splice(i, 1); continue;
        }

        ctx.save(); ctx.font = "55px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(item.text, item.x, item.y);
        
        ctx.font = "bold 12px Arial"; ctx.fillStyle = "#2c3e50"; 
        ctx.fillText(item.name, item.x, item.y - 36);

        let timeBarWidth = 50;
        let progress = item.timeLeft / item.maxTime;
        ctx.fillStyle = "#bdc3c7"; ctx.fillRect(item.x - timeBarWidth/2, item.y - 52, timeBarWidth, 5);
        ctx.fillStyle = progress > 0.4 ? "#e67e22" : "#e74c3c"; 
        ctx.fillRect(item.x - timeBarWidth/2, item.y - 52, timeBarWidth * Math.max(0, progress), 5);

        ctx.restore();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.03;
        if (p.alpha <= 0) { particles.splice(i, 1); } 
        else {
            ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
    }

    if (feedbackTimer > 0) {
        ctx.fillStyle = feedbackColor; ctx.font = "bold 16px Arial"; ctx.textAlign = "center";
        ctx.fillText(feedbackText, V_WIDTH / 2, 135); feedbackTimer--;
    }

    if (levelUpTimer > 0) {
        ctx.fillStyle = "#d35400"; ctx.font = "bold 22px Arial"; ctx.textAlign = "center";
        ctx.fillText("🌟 VÒNG KHÓ CẤP " + currentLevel + " BẮT ĐẦU 🌟", V_WIDTH / 2, 320);
        levelUpTimer--;
    }

    requestAnimationFrame(gameLoop);
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) * (V_WIDTH / rect.width),
        y: (clientY - rect.top) * (V_HEIGHT / rect.height)
    };
}

function handleStart(e) {
    if (!lightningEffect) lightningEffect = document.getElementById('lightningEffect');
    initAudio(); 
    const pos = getMousePos(e);

    if (inQuizMode && quizFeedbackTimer > 0) return;

    // KÍCH HOẠT NÚT TẠM DỪNG (PAUSE / RESUME)
    if (gameStarted && !gameOver && !inQuizMode && !showIntro) {
        if (pos.x >= pauseBtn.x && pos.x <= pauseBtn.x + pauseBtn.w &&
            pos.y >= pauseBtn.y && pos.y <= pauseBtn.y + pauseBtn.h) {
            isPaused = !isPaused;
            if (isPaused) stopBGM(); else startBGM(); // Dừng/Phát nhạc tương ứng trạng thái Pause
            return;
        }
    }

    if (isPaused) return; 

    if (showIntro) {
        if (pos.x >= 140 && pos.x <= 340 && pos.y >= 515 && pos.y <= 561) {
            showIntro = false; gameStarted = true; score = 0; quizScore = 0; lives = 3; health = 100; currentLevel = 1;
            rearrangeBins(); spawnItem();
        }
        return;
    }

    if (inQuizMode && currentQuiz && quizFeedbackTimer === 0) {
        let chosen = null;
        if (pos.x >= 35 && pos.x <= 445) {
            if (pos.y >= 240 && pos.y <= 290) chosen = "a";
            if (pos.y >= 310 && pos.y <= 360) chosen = "b";
            if (pos.y >= 380 && pos.y <= 430) chosen = "c";
        }
        if (chosen) {
            if (chosen === currentQuiz.ans) {
                quizScore += 50; 
                playSound('correct');
                quizFeedback = "🎉 ĐÚNG RỒI! BẠN ĐƯỢC TÍNH +50Đ THƯỞNG KHI KẾT THÚC";
            } else {
                playSound('wrong');
                quizFeedback = "😟 SAI RỒI! HÃY CHÚ Ý PHÂN LOẠI KỸ HƠN NHÉ!";
            }
            quizFeedbackTimer = 110; 
        }
        return;
    }

    if (gameOver) {
        if (pos.x >= 160 && pos.x <= 320 && pos.y >= 370 && pos.y <= 416) {
            gameOver = false; score = 0; quizScore = 0; lives = 3; health = 100; currentLevel = 1; fallingItems = []; trashPool = [];
            rearrangeBins(); spawnItem();
        }
        return;
    }

    for (let i = fallingItems.length - 1; i >= 0; i--) {
        let item = fallingItems[i];
        const dist = Math.hypot(pos.x - item.x, pos.y - item.y);
        if (dist < 42) { 
            draggingItem = item;
            dragOffsetX = pos.x - item.x; dragOffsetY = pos.y - item.y;
            if (e.cancelable) e.preventDefault();
            break;
        }
    }
}

function handleMove(e) {
    if (isPaused || !draggingItem) return;
    const pos = getMousePos(e);
    draggingItem.x = pos.x - dragOffsetX; draggingItem.y = pos.y - dragOffsetY;
    if (e.cancelable) e.preventDefault();
}

function handleEnd() {
    if (isPaused || !draggingItem) return;
    let item = draggingItem; draggingItem = null;

    let activeCount = (currentLevel >= 4) ? 4 : 3;
    let activeBins = bins.slice(0, activeCount);
    let matchedBin = null;

    activeBins.forEach(bin => {
        if (item.x >= bin.x && item.x <= bin.x + bin.w &&
            item.y >= bin.y && item.y <= bin.y + bin.h) {
            matchedBin = bin;
        }
    });

    if (matchedBin) {
        if (item.type === matchedBin.id) {
            score += 10; playSound('correct');
            createParticles(item.x, item.y, binColor(matchedBin.id));
            showFeedback("Chính xác! +10 Điểm 🎉", "#2ecc71");
            
            fallingItems = fallingItems.filter(i => i.id !== item.id);
            checkLevelProgress();
            
            if (currentLevel === 5) {
                bins.sort(() => Math.random() - 0.5); rearrangeBins();
            }
        } else {
            decreaseHealth(15); 
            playSound('wrong'); showFeedback("Nhầm thùng rồi em ơi! 😟", "#e74c3c");
            fallingItems = fallingItems.filter(i => i.id !== item.id);
        }
    }
}

function binColor(id) {
    if (id === 'organic') return '#2ecc71'; if (id === 'recyclable') return '#3498db';
    if (id === 'residual') return '#95a5a6'; return '#e67e22';
}

canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);
canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
window.addEventListener('touchend', handleEnd);

rearrangeBins();
requestAnimationFrame(gameLoop);
