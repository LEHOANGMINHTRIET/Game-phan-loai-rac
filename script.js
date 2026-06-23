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
let comboCount = 0;
let comboTimer = 0;

let inQuizMode = false;
let currentQuiz = null;
let quizFeedback = "";       
let quizFeedbackTimer = 0;  

// Bộ sưu tập vật phẩm phần thưởng minh họa qua từng cấp
let playerBadges = [];
const rewardsData = {
    2: { name: "🌱 Hạt Giống Xanh", desc: "Tặng vì đạt mốc Cấp 2: Ươm mầm ý thức phân loại!" },
    3: { name: "🪵 Phân Bón Sinh Học", desc: "Tặng vì đạt mốc Cấp 3: Tái chế rác hữu cơ thành công!" },
    4: { name: "🪣 Thùng Rác Thông Minh", desc: "Tặng vì đạt mốc Cấp 4: Chuyên gia phân loại rác vô cơ!" },
    5: { name: "🛡️ Găng Tay Bảo Hộ", desc: "Tặng vì đạt mốc Cấp 5: An toàn xử lý rác nguy hại!" },
    6: { name: "🌪️ Huy Hiệu Dũng Sĩ Siêu Bão", desc: "Tặng vì đạt mốc Cấp 6: Kiên cường vượt bão môi trường!" }
};
let currentRewardShow = null;
let rewardShowTimer = 0;

let clouds = [
    { x: 40, y: 80, speed: 0.15, size: 25 },
    { x: 220, y: 120, speed: 0.08, size: 35 }
];

const pauseBtn = { x: V_WIDTH - 50, y: 15, w: 35, h: 35 };

// --- 🎵 HỆ THỐNG ÂM THANH CHUẨN ---
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
                if (currentLevel >= 5) freq *= 1.25; // Nhạc đẩy nhanh kịch tính ở cấp siêu bão
                bgmOsc.frequency.setValueAtTime(freq, now);
                noteIdx++;
            }
        }, 450);
        
        bgmOsc.connect(bgmGain);
        bgmGain.connect(audioCtx.destination);
        bgmOsc.start();
    } catch(e) { console.log("BGM Error:", e); }
}

function stopBGM() {
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
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.setValueAtTime(554.37, audioCtx.currentTime + 0.1);
            osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.2);
            osc.frequency.exponentialRampToValueAtTime(1108.7, audioCtx.currentTime + 0.4);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
            osc.start(); osc.stop(audioCtx.currentTime + 0.45);
        } else if (type === 'combo') {
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
            osc.frequency.setValueAtTime(698.46, audioCtx.currentTime + 0.08);
            osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.16);
            gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start(); osc.stop(audioCtx.currentTime + 0.3);
        }
    } catch (e) {}
}

// --- 📦 KHO DỮ LIỆU KHỔNG LỒ ~400 LOẠI RÁC TUẦN HOÀN (HỮU CƠ CHIẾM ĐA SỐ) ---
const rawTrashDatabase = [
    // 🍏 1. RÁC HỮU CƠ (DỒI DÀO NHẤT)
    { text: "🍏", name: "Táo xanh cắn dở", type: "organic" }, { text: "🍎", name: "Táo đỏ úng thối", type: "organic" },
    { text: "🍐", name: "Quả lê dập nát", type: "organic" }, { text: "🍊", name: "Vỏ cam quýt khô", type: "organic" },
    { text: "Lemonade", text: "🍋", name: "Vỏ chanh héo mốc", type: "organic" }, { text: "🍌", name: "Vỏ chuối chín", type: "organic" },
    { text: "Watermelon", text: "🍉", name: "Vỏ dưa hấu", type: "organic" }, { text: "🍇", name: "Chùm nho thối mốc", type: "organic" },
    { text: "strawberry", text: "🍓", name: "Quả dâu tây ủng", type: "organic" }, { text: "🍈", name: "Vỏ dưa lưới thiu", type: "organic" },
    { text: "cherry", text: "🍒", name: "Quả anh đào hỏng", type: "organic" }, { text: "peach", text: "🍑", name: "Quả đào thối hoắc", type: "organic" },
    { text: "mango", text: "🥭", name: "Vỏ xoài chín rữa", type: "organic" }, { text: "pineapple", text: "🍍", name: "Mắt dứa cắt bỏ", type: "organic" },
    { text: "coconut", text: "🥥", name: "Xác vỏ dừa khô", type: "organic" }, { text: "kiwi", text: "🥝", name: "Quả kiwi nhũn nát", type: "organic" },
    { text: "tomato", text: "🍅", name: "Cà chua thối nát", type: "organic" }, { text: "avocado", text: "🥑", name: "Hạt bơ già thối", type: "organic" },
    { text: "eggplant", text: "🍆", name: "Cà tím héo đen", type: "organic" }, { text: "potato", text: "🥔", name: "Khoai tây mọc mầm", type: "organic" },
    { text: "carrot", text: "🥕", name: "Củ cà rốt mục nát", type: "organic" }, { text: "corn", text: "🌽", name: "Lõi ngô thối rữa", type: "organic" },
    { text: "chili", text: "🌶️", name: "Quả ớt cay úng", type: "organic" }, { text: "cucumber", text: "🥒", name: "Dưa chuột héo vàng", type: "organic" },
    { text: "cabbage", text: "🥬", name: "Lá cải bắp úa", type: "organic" }, { text: "broccoli", text: "🥦", name: "Súp lơ mốc đen", type: "organic" },
    { text: "garlic", text: "🧄", name: "Củ tỏi lép mốc", type: "organic" }, { text: "onion", text: "🧅", name: "Vỏ hành tây bóc bỏ", type: "organic" },
    { text: "mushroom", text: "🍄", name: "Nấm rơm ủng nước", type: "organic" }, { text: "peanut", text: "🥜", name: "Vỏ lạc khô vỡ", type: "organic" },
    { text: "chestnut", text: "🌰", name: "Hạt dẻ luộc hỏng", type: "organic" }, { text: "bread", text: "🍞", name: "Bánh mì mốc xanh", type: "organic" },
    { text: "croissant", text: "🥐", name: "Bánh sừng bò ỉu", type: "organic" }, { text: "baguette", text: "🥖", name: "Bánh mì dài mốc", type: "organic" },
    { text: "waffle", text: "🧇", name: "Bánh kẹp quá hạn", type: "organic" }, { text: "pancake", text: "🥞", name: "Bánh rán ăn thừa", type: "organic" },
    { text: "cheese", text: "🧀", name: "Phô mai chảy mùi", type: "organic" }, { text: "meat", text: "🍖", name: "Xương sườn lợn thừa", type: "organic" },
    { text: "chicken", text: "🍗", name: "Xương đùi gà", type: "organic" }, { text: "steak", text: "🥩", name: "Mỡ thịt bò lọc bỏ", type: "organic" },
    { text: "bacon", text: "🥓", name: "Thịt xông khói ôi", type: "organic" }, { text: "burger", text: "🍔", name: "Hamburger cắn dở", type: "organic" },
    { text: "fries", text: "🍟", name: "Khoai tây chiên thiu", type: "organic" }, { text: "pizza", text: "🍕", name: "Đế pizza cháy sém", type: "organic" },
    { text: "hotdog", text: "🌭", name: "Xúc xích hôi thiu", type: "organic" }, { text: "sandwich", text: "🥪", name: "Sandwich chảy nhớt", type: "organic" },
    { text: "salad", text: "🥗", name: "Rau trộn thừa chua", type: "organic" }, { text: "egg", text: "🥚", name: "Vỏ trứng gà vỡ", type: "organic" },
    { text: "soup", text: "🍲", name: "Cặn bã canh rau", type: "organic" }, { text: "rice", text: "🍚", name: "Cơm nguội mốc hỏng", type: "organic" },
    { text: "noodle", text: "🍜", name: "Sợi mì tôm trương thừa", type: "organic" }, { text: "spaghetti", text: "🍝", name: "Mì Ý đổ thừa", type: "organic" },
    { text: "shrimp", text: "🍤", name: "Vỏ tôm đuôi tôm", type: "organic" }, { text: "fish", text: "🍥", name: "Đầu cá chả cá thừa", type: "organic" },
    { text: "mochi", text: "🍡", name: "Bánh nếp chua ẩm", type: "organic" }, { text: "dumpling", text: "🥟", name: "Há cảo luộc hỏng", type: "organic" },
    { text: "cake", text: "🍰", name: "Bánh ngọt thiu chua", type: "organic" }, { text: "bacon2", text: "🦪", name: "Vỏ hàu vỏ nghêu", type: "organic" },
    { text: "leaf", text: "🍂", name: "Lá cây khô sân trường", type: "organic" }, { text: "rose", text: "🥀", name: "Hoa hồng héo rũ", type: "organic" },
    { text: "green_leaf", text: "🍃", name: "Lá chè xanh hỏng", type: "organic" }, { text: "rice_field", text: "🌾", name: "Rơm rạ rễ lúa mục", type: "organic" },
    { text: "tea", text: "🍵", name: "Bã trà lọc cặn", type: "organic" }, { text: "coffee", text: "☕", name: "Bã cà phê nguyên chất", type: "organic" },
    { text: "seed", text: "🌱", name: "Cỏ dại nhổ bỏ", type: "organic" }, { text: "wood", text: "🪵", name: "Mẩu gỗ vụn mục nát", type: "organic" },

    // 📦 2. RÁC TÁI CHẾ
    { text: "📦", name: "Hộp giấy carton cũ", type: "recyclable" }, { text: "📰", name: "Tờ báo cũ lỗi thời", type: "recyclable" },
    { text: "📑", name: "Tài liệu in lỗi mặt", type: "recyclable" }, { text: "📚", name: "Sách giáo khoa nát", type: "recyclable" },
    { text: "📓", name: "Vở viết cũ hết trang", type: "recyclable" }, { text: "✉️", name: "Phong bì thư cũ", type: "recyclable" },
    { text: "🍾", name: "Chai thủy tinh rỗng", type: "recyclable" }, { text: "🥫", name: "Vỏ lon nước ngọt", type: "recyclable" },
    { text: "🥤", name: "Ly cốc nhựa rỗng sạch", type: "recyclable" }, { text: "🥛", name: "Vỏ hộp sữa tươi giấy", type: "recyclable" },
    { text: "🧴", name: "Chai dầu gội hết", type: "recyclable" }, { text: "⚙️", name: "Bánh răng sắt phế liệu", type: "recyclable" },
    { text: "📎", name: "Ghim kẹp giấy sắt", type: "recyclable" }, { text: "🛠️", name: "Cờ lê cũ gỉ sét", type: "recyclable" },
    { text: "🔩", name: "Bu lông ốc vít sắt", type: "recyclable" }, { text: "Keys", text: "🔑", name: "Chìa khóa sắt bỏ", type: "recyclable" },
    { text: "spoon", text: "🥄", name: "Thìa inox móp méo", type: "recyclable" }, { text: "jar", text: "🫙", name: "Hũ thủy tinh rỗng", type: "recyclable" },
    { text: "pan", text: "🍳", name: "Chảo gang hỏng đáy", type: "recyclable" }, { text: "basket", text: "🧺", name: "Rổ nhựa cũ gãy nan", type: "recyclable" },

    // 🛍️ 3. RÁC VÔ CƠ CÒN LẠI (RESIDUAL)
    { text: "🛍️", name: "Túi nilon rách nát", type: "residual" }, { text: "🚬", name: "Tàn thuốc lá hôi thối", type: "residual" },
    { text: "🧱", name: "Mảnh gạch vỡ nát", type: "residual" }, { text: "🥣", name: "Bát chén sứ mẻ góc", type: "residual" },
    { text: "👟", name: "Giày vải rách đế", type: "residual" }, { text: "🧦", name: "Tất chân rách ngón", type: "residual" },
    { text: "👕", name: "Áo cũ rách nát", type: "residual" }, { text: "👖", name: "Quần jeans rách hỏng", type: "residual" },
    { text: "🌂", name: "Ô che mưa gãy nan", type: "residual" }, { text: "🪮", name: "Lược nhựa gãy răng", type: "residual" },
    { text: "✏️", name: "Mẩu bút chì gãy lõi", type: "residual" }, { text: "🖋️", name: "Vỏ bút bi hết mực", type: "residual" },
    { text: "🎈", name: "Xác bóng bay nổ", type: "residual" }, { text: "🧸", name: "Gấu bông rách bông", type: "residual" },
    { text: "🧻", name: "Giấy ăn đã lau bẩn", type: "residual" }, { text: "mirror", text: "🧱", name: "Mảnh gương vỡ vụn", type: "residual" },

    // 🔋 4. RÁC NGUY HẠI ĐỘC HẠI (MEDICAL/HAZARDOUS)
    { text: "🔋", name: "Cục pin hỏng rỉ hóa chất", type: "medical" }, { text: "💉", name: "Kim tiêm y tế nguy hại", type: "medical" },
    { text: "😷", name: "Khẩu trang bẩn dính dịch", type: "medical" }, { text: "🌡️", name: "Nhiệt kế thủy ngân vỡ", type: "medical" },
    { text: "🧪", name: "Lọ đựng hóa chất nghiệm", type: "medical" }, { text: "💡", name: "Bóng đèn huỳnh quang vỡ", type: "medical" },
    { text: "💊", name: "Thuốc viên hết hạn sử dụng", type: "medical" }, { text: "🩹", name: "Băng gạc cá nhân cũ bẩn", type: "medical" },
    { text: "spray", text: "🧴", name: "Chai chứa thuốc trừ sâu", type: "medical" }, { text: "phone", text: "📱", name: "Điện thoại vỡ pin phồng", type: "medical" },
    { text: "chip", text: "💻", name: "Bo mạch điện tử cũ nát", type: "medical" }
];

// Sinh tự động nhân bản mở rộng kho rác chuẩn hóa đạt ~400 loại bằng cách đính kèm tính từ đa dạng trạng thái thực tế
let masterTrashPool = [];
function build400TrashDatabase() {
    masterTrashPool = [];
    // Tạo 220 rác hữu cơ bằng biến thể trạng thái sinh động
    let orgs = rawTrashDatabase.filter(t => t.type === 'organic');
    for (let i = 0; i < 220; i++) {
        let base = orgs[i % orgs.length];
        let suffixes = ["", " thối rữa", " ủng nước", " mốc đen", " bốc mùi", " kiến bu", " chua thiu", " nát vụn"];
        let suf = suffixes[Math.floor(i / orgs.length) % suffixes.length];
        masterTrashPool.push({ text: base.text, name: base.name + suf, type: "organic" });
    }
    // Tạo 70 rác tái chế
    let recs = rawTrashDatabase.filter(t => t.type === 'recyclable');
    for (let i = 0; i < 70; i++) {
        let base = recs[i % recs.length];
        let suffixes = ["", " sạch khô", " móp méo", " rỗng", " phế liệu", " cũ nát"];
        let suf = suffixes[Math.floor(i / recs.length) % suffixes.length];
        masterTrashPool.push({ text: base.text, name: base.name + suf, type: "recyclable" });
    }
    // Tạo 65 rác vô cơ
    let ress = rawTrashDatabase.filter(t => t.type === 'residual');
    for (let i = 0; i < 65; i++) {
        let base = ress[i % ress.length];
        let suffixes = ["", " bẩn bám bụi", " rách rưới", " mất góc", " hỏng nát"];
        let suf = suffixes[Math.floor(i / ress.length) % suffixes.length];
        masterTrashPool.push({ text: base.text, name: base.name + suf, type: "residual" });
    }
    // Tạo 50 rác nguy hại
    let meds = rawTrashDatabase.filter(t => t.type === 'medical');
    for (let i = 0; i < 50; i++) {
        let base = meds[i % meds.length];
        let suffixes = ["", " độc hại", " đã qua sử dụng", " gỉ sét độc", " nguy hiểm"];
        let suf = suffixes[Math.floor(i / meds.length) % suffixes.length];
        masterTrashPool.push({ text: base.text, name: base.name + suf, type: "medical" });
    }
}
build400TrashDatabase();

// Hệ thống hàng đợi bốc ngẫu nhiên không lặp lại đến khi hết vòng tự động xáo lại vòng mới
let activeDrawQueue = [];
function replenishQueue() {
    let filtered = [...masterTrashPool];
    // Giới hạn chưa cho rác nguy hại rơi ở cấp quá thấp để học sinh làm quen
    if (currentLevel < 4) {
        filtered = masterTrashPool.filter(item => item.type !== 'medical');
    }
    // Xáo trộn ngẫu nhiên danh sách (Fisher-Yates)
    for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }
    activeDrawQueue = filtered;
}

// --- ❓ KHO CÂU HỎI TRẮC NGHIỆM MÔI TRƯỜNG ---
const quizBank = {
    2: [
        { q: "Rác hữu cơ gồm những loại nào sau đây?", a: "A. Thức ăn thừa, lá cây khô, vỏ trái cây", b: "B. Túi nilon, cốc nhựa và vỏ lon sắt", c: "C. Pin hỏng và bóng đèn huỳnh quang", ans: "a" },
        { q: "Ủ rác hữu cơ tại nhà mang lại lợi ích gì?", a: "A. Tạo ra phân bón sinh học nuôi cây xanh", b: "B. Làm sạch nguồn nước ngầm trực tiếp", c: "C. Giúp rác biến thành kim loại quý", ans: "a" }
    ],
    3: [
        { q: "Rác tái chế bao gồm các chất liệu cốt lõi nào?", a: "A. Giấy vụn, thùng carton, chai nhựa, lon nhôm", b: "B. Thức ăn thối và gạch đá vụn", c: "C. Kim tiêm và khẩu trang bẩn", ans: "a" },
        { q: "Chai nhựa đựng nước sau khi dùng xong nên xử lý sơ bộ thế nào?", a: "A. Súc sạch nước thừa, làm xẹp nhỏ lại rồi bỏ vào thùng tái chế", b: "B. Cắt nát vứt ra vườn cỏ trường học", c: "C. Đổ đầy đất cát vào bên trong", ans: "a" }
    ],
    4: [
        { q: "Rác vô cơ còn lại (Residual) gồm những mặt hàng nào?", a: "A. Túi nilon rách, giấy ăn bẩn, tàn thuốc, mảnh sành", b: "B. Sách báo cũ và chai nhựa pet", c: "C. Kim tiêm và vỏ hộp thuốc kháng sinh", ans: "a" },
        { q: "Túi nilon thông thường mất khoảng bao lâu để phân hủy tự nhiên?", a: "A. Khoảng từ 100 năm đến 500 năm hoặc lâu hơn", b: "B. Chỉ cần 2 tuần lễ nắng hè", c: "C. Đúng 1 năm rưỡi", ans: "a" }
    ],
    5: [
        { q: "Tại sao tuyệt đối không vứt pin cũ chung với rác vô cơ thông thường?", a: "A. Rò rỉ kim loại nặng (chì, thủy ngân) gây ô nhiễm đất, nguồn nước ngầm", b: "B. Vì pin cũ sẽ tự nổ tung biến thành vàng", c: "C. Vì pin quá nặng làm gãy bánh xe rác", ans: "a" },
        { q: "Nhiệt kế thủy ngân bị vỡ ra chất lỏng màu bạc, chất đó có độc không?", a: "A. Cực kỳ độc, bay hơi gây hại cho hệ thần kinh và phổi người hít phải", b: "B. Hoàn toàn vô hại, có thể dùng bôi lên da", c: "C. Rất bổ dưỡng, giúp làm mát cơ thể", ans: "a" }
    ],
    6: [
        { q: "Trong điều kiện siêu bão biến đổi khí hậu, hành động nào là thiết thực nhất?", a: "A. Gia cố nhà cửa, phân loại thu gom rác gọn gàng tránh ngập nghẹt cống", b: "B. Vứt bừa bãi rác xuống cống để nước cuốn đi", c: "C. Ra đường thả diều ngắm mưa bão", ans: "a" }
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
    if (activeDrawQueue.length === 0) { replenishQueue(); }
    let raw = activeDrawQueue.pop();
    
    // 🌟 SỬA: Tăng đáng kể thời gian đếm ngược lên 26-36 giây để rác kịp rơi hết khung hình thoải mái
    let baseTime = 36 - (currentLevel * 2);
    if (currentLevel === 6) baseTime = 22; 

    // Tính toán so le y dựa trên số rác hiện hành trên màn hình để không dính chùm
    let spawnY = -60;
    if (fallingItems.length > 0) {
        let lowestY = Math.min(...fallingItems.map(i => i.y));
        spawnY = lowestY - 200; // Cách xa nhau ít nhất 200px chiều dọc
    }

    fallingItems.push({
        id: Math.random(),
        text: raw.text, name: raw.name, type: raw.type,
        x: Math.random() * (V_WIDTH - 150) + 75,
        y: spawnY,
        angle: Math.random() * Math.PI,
        windShift: (Math.random() - 0.5) * 1.5,
        timeLeft: baseTime, 
        maxTime: baseTime   
    });
}

function rearrangeBins() {
    let activeCount = (currentLevel >= 4) ? 4 : 3;
    let padding = (V_WIDTH - (activeCount * 92)) / (activeCount + 1);
    let activeBins = (currentLevel >= 4) ? bins : bins.filter(b => b.id !== 'medical');
    activeBins.forEach((bin, idx) => { bin.x = padding + idx * (92 + padding); });
}

function triggerQuiz(level) {
    stopBGM(); 
    inQuizMode = true;
    let questionsList = quizBank[level] || quizBank[2];
    let randomIndex = Math.floor(Math.random() * questionsList.length);
    currentQuiz = questionsList[randomIndex];
    quizFeedback = "";
    quizFeedbackTimer = 0;
}

function checkLevelProgress() {
    let newLevel = 1;
    // 🌟 SỬA: Thiết lập phân tầng cấp độ giãn rộng rõ rệt theo ý muốn, mốc 2500 tăng tốc, mốc 3000 đạt Cấp 6 Siêu Bão
    if (score >= 3000) newLevel = 6;
    else if (score >= 2500) newLevel = 5;
    else if (score >= 1800) newLevel = 4;
    else if (score >= 1000) newLevel = 3;
    else if (score >= 400) newLevel = 2;

    if (newLevel !== currentLevel) {
        currentLevel = newLevel;
        levelUpTimer = 90;
        playSound('levelup');
        
        // Cấp tặng vật phẩm danh hiệu minh họa
        if (rewardsData[currentLevel]) {
            currentRewardShow = rewardsData[currentLevel];
            rewardShowTimer = 130; // Hiện banner tặng quà vinh danh
            playerBadges.push(currentRewardShow.name.split(" ")[0]); // Giữ lại biểu tượng tích lũy góc dưới
        }

        rearrangeBins();
        fallingItems = []; 
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
            stopBGM(); 
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

// --- VÒNG LẶP ĐỒ HỌA CHÍNH ---
function gameLoop() {
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

    // Bầu trời thay đổi sắc thái u ám bão táp dần theo từng cấp độ
    let skyGrad = ctx.createLinearGradient(0, 0, 0, V_HEIGHT);
    if (currentLevel <= 3) {
        skyGrad.addColorStop(0, '#eef7f6'); skyGrad.addColorStop(1, '#d5eadd');
    } else if (currentLevel <= 5) {
        skyGrad.addColorStop(0, '#bdc3c7'); skyGrad.addColorStop(1, '#95a5a6');
    } else {
        skyGrad.addColorStop(0, '#34495e'); skyGrad.addColorStop(1, '#2c3e50'); // Sắc xám đen Siêu Bão
    }
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // Vẽ mây trôi bình yên hoặc chuyển động nhanh khi bão bùng
    ctx.fillStyle = currentLevel >= 5 ? "rgba(100, 110, 120, 0.5)" : "rgba(255, 255, 255, 0.6)";
    clouds.forEach(c => {
        if (!isPaused && !showIntro && !inQuizMode && !gameOver) {
            c.x += (currentLevel >= 5) ? c.speed * 8 : c.speed;
        }
        if (c.x - 40 > V_WIDTH) c.x = -40;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2); ctx.fill();
    });

    // Thảm cỏ nền xanh của Lâm Đồng
    ctx.fillStyle = currentLevel === 6 ? "#1e5f38" : "#27ae60"; 
    ctx.fillRect(0, 580, V_WIDTH, 120);

    if (showIntro) {
        ctx.fillStyle = "#27ae60"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
        ctx.fillText("HÀNH TRÌNH XANH LÂM ĐỒNG - BẢN 9.0", V_WIDTH / 2, 80);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)"; ctx.fillRect(25, 120, 430, 380);
        ctx.lineWidth = 2; ctx.strokeStyle = "#27ae60"; ctx.strokeRect(25, 120, 430, 380);

        ctx.fillStyle = "#2c3e50"; ctx.font = "12px Arial"; ctx.textAlign = "left";
        let lines = [
            "📦 Kho rác Tuần Hoàn 400 loại: Rác Hữu Cơ đa dạng không lo trùng lặp.",
            "⏱️ Cân bằng thời gian: Thanh đếm ngược dài 35s, rác rơi tự nhiên thong thả.",
            "🎁 Quà tặng vật phẩm vinh danh: Đạt cấp độ mới nhận ngay danh hiệu hiện vật.",
            "🔥 Hệ thống Combo thần tốc: Phân loại đúng liên tục để kích hoạt nhân đôi điểm.",
            "🌪️ Thách thức điểm số: Vượt mốc 2500đ đảo vị trí, mốc 3000đ bùng nổ CẤP 6 SIÊU BÃO.",
            "⏸️ Tạm dừng chuẩn xác: Nhấp 1 chạm vào nút [||] để dừng, bảo lưu điểm số an toàn."
        ];
        lines.forEach((line, idx) => ctx.fillText(line, 40, 160 + idx * 36));

        ctx.fillStyle = "#27ae60"; ctx.fillRect(140, 525, 200, 46);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "center";
        ctx.fillText("BẮT ĐẦU THỨ THÁCH", V_WIDTH / 2, 553);
        requestAnimationFrame(gameLoop); return;
    }

    // GIAO DIỆN CÂU HỎI TRẮC NGHIỆM
    if (inQuizMode && currentQuiz) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);
        ctx.fillStyle = "#f1c40f"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center";
        ctx.fillText("🌟 THỬ THÁCH TRI THỨC XANH 🌟", V_WIDTH / 2, 95);
        
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 13px Arial";
        let words = currentQuiz.q.split(' ');
        let line = ''; let startY = 145;
        for(let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            if (testLine.length > 55) {
                ctx.fillText(line, V_WIDTH / 2, startY); line = words[n] + ' '; startY += 22;
            } else { line = testLine; }
        }
        ctx.fillText(line, V_WIDTH / 2, startY);

        let opts = [
            { id: "a", text: currentQuiz.a, y: 250 },
            { id: "b", text: currentQuiz.b, y: 320 },
            { id: "c", text: currentQuiz.c, y: 390 }
        ];

        opts.forEach(opt => {
            ctx.fillStyle = "#34495e"; ctx.fillRect(35, opt.y, 410, 50);
            ctx.lineWidth = 1; ctx.strokeStyle = "#ffffff"; ctx.strokeRect(35, opt.y, 410, 50);
            ctx.fillStyle = "#ffffff"; ctx.font = "12px Arial"; ctx.textAlign = "left";
            ctx.fillText(opt.text, 50, opt.y + 29);
        });

        if (quizFeedbackTimer > 0) {
            ctx.fillStyle = quizFeedback.includes("ĐÚNG") ? "#2ecc71" : "#e74c3c";
            ctx.font = "bold 14px Arial"; ctx.textAlign = "center";
            ctx.fillText(quizFeedback, V_WIDTH / 2, 480);
            quizFeedbackTimer--;
            if (quizFeedbackTimer <= 0) { inQuizMode = false; currentQuiz = null; startBGM(); }
        }
        requestAnimationFrame(gameLoop); return;
    }

    // GIAO DIỆN KẾT THÚC GAME
    if (gameOver) {
        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 32px Arial"; ctx.textAlign = "center";
        ctx.fillText("TRÒ CHƠI KẾT THÚC", V_WIDTH / 2, 210);
        ctx.fillStyle = "#2c3e50"; ctx.font = "bold 16px Arial";
        ctx.fillText("Điểm phân loại: " + score + " Điểm", V_WIDTH / 2, 260);
        ctx.fillStyle = "#27ae60";
        ctx.fillText("Điểm trắc nghiệm: +" + quizScore + " Điểm", V_WIDTH / 2, 290);
        ctx.fillStyle = "#d35400"; ctx.font = "bold 22px Arial";
        ctx.fillText("TỔNG ĐIỂM CHUNG CUỘC: " + (score + quizScore) + " ĐIỂM", V_WIDTH / 2, 335);

        ctx.fillStyle = "#3498db"; ctx.fillRect(160, 410, 160, 46);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 15px Arial"; ctx.fillText("CHƠI LẠI", V_WIDTH / 2, 438);
        requestAnimationFrame(gameLoop); return;
    }

    // GIAO DIỆN TẠM DỪNG (PAUSE)
    if (isPaused) {
        ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 22px Arial"; ctx.textAlign = "center";
        ctx.fillText("ĐANG TẠM DỪNG TRÒ CHƠI", V_WIDTH / 2, 300);
        
        ctx.fillStyle = "#2ecc71"; ctx.beginPath(); ctx.roundRect(pauseBtn.x, pauseBtn.y, pauseBtn.w, pauseBtn.h, 6); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px Arial"; ctx.fillText("▶", pauseBtn.x + pauseBtn.w/2, pauseBtn.y + pauseBtn.h/2 + 4);
        requestAnimationFrame(gameLoop); return;
    }

    // --- 📊 HIỂN THỊ HUD ĐẸP VÀ THÔNG THOÁNG CHỐNG ĐÈ CHỮ ---
    ctx.fillStyle = currentLevel === 6 ? "#ffffff" : "#2c3e50"; 
    ctx.font = "bold 13px Arial"; 
    
    // 1. Mạng trái tim nằm góc trái
    ctx.textAlign = "left"; ctx.fillText("MẠNG: " + "❤️".repeat(lives), 15, 33);
    
    // 2. Thanh Máu HP nằm chính giữa thông thoáng
    ctx.fillText("HP: ", 145, 33);
    ctx.fillStyle = "#bdc3c7"; ctx.fillRect(175, 22, 100, 14);
    ctx.fillStyle = health > 30 ? "#2ecc71" : "#e74c3c"; ctx.fillRect(175, 22, (health / 100) * 100, 14);

    // 3. Điểm số và cấp độ nằm dịch sang phải
    ctx.textAlign = "right"; 
    ctx.fillText("🏆 ĐIỂM: " + score + " | LV: " + currentLevel, V_WIDTH - 65, 33);

    // Vẽ nút tạm dừng
    ctx.fillStyle = "#7f8c8d"; ctx.beginPath(); ctx.roundRect(pauseBtn.x, pauseBtn.y, pauseBtn.w, pauseBtn.h, 6); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center"; ctx.fillText("||", pauseBtn.x + pauseBtn.w/2, pauseBtn.y + pauseBtn.h/2 + 4);

    // Vẽ Thùng Rác phân loại sinh động
    let activeCount = (currentLevel >= 4) ? 4 : 3;
    let activeBins = bins.slice(0, activeCount);

    activeBins.forEach(bin => {
        let grad = ctx.createLinearGradient(bin.x, bin.y, bin.x, bin.y + bin.h);
        grad.addColorStop(0, bin.color1); grad.addColorStop(1, bin.color2);
        ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(bin.x, bin.y, bin.w, bin.h, 8); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(bin.x, bin.y, bin.w, 15);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 11px Arial"; ctx.textAlign = "center";
        ctx.fillText(bin.name, bin.x + bin.w / 2, bin.y + bin.h / 2 + 6);
    });

    // --- 🌧️ CHẾ ĐỘ MƯA RÁC ĐỒNG THỜI SO LE AN TOÀN ---
    // Duy trì liên tục từ 2 đến 3 rác trên màn hình ở mọi cấp độ
    let targetItemsCount = (currentLevel >= 5) ? 3 : 2;
    if (currentLevel === 6) targetItemsCount = 4; // Cấp siêu bão có 4 rác dồn dập

    if (fallingItems.length < targetItemsCount) {
        spawnItem();
    }

    // Xử lý đếm ngược thanh Combo phân loại thần tốc
    if (comboTimer > 0) {
        comboTimer--; if (comboTimer <= 0) comboCount = 0;
    }

    // Hiệu ứng dung giật màn hình nhẹ của 🌪️ CẤP 6 SIÊU BÃO
    let stormX = 0;
    if (currentLevel === 6) {
        stormX = Math.sin(Date.now() * 0.05) * 2; // Rung lắc bão táp nhẹ tăng tính trải nghiệm sinh động
    }

    for (let i = fallingItems.length - 1; i >= 0; i--) {
        let item = fallingItems[i];

        if (draggingItem && draggingItem.id === item.id) {
            item.timeLeft -= 1/60;
        } else {
            // Tốc độ rơi phân tầng rõ rệt theo từng cấp độ tiến trình
            let fallSpeed = 0.5 + (currentLevel * 0.2); 
            if (currentLevel === 5) fallSpeed = 1.9;
            if (currentLevel === 6) fallSpeed = 2.4; // Siêu bão rơi nhanh kịch tính

            item.y += fallSpeed;
            item.timeLeft -= 1/60; 

            // Cấu trúc quỹ đạo bay phức tạp theo cấp độ tiến trình giáo dục
            if (currentLevel === 3 || currentLevel === 4) {
                item.angle += 0.015; item.x += Math.sin(item.angle) * 0.7;
            } else if (currentLevel >= 5) {
                // Cấp độ cao hoặc Siêu Bão: Gió thổi giật mạnh zic-zac liên tục
                item.angle += 0.05; item.x += Math.sin(item.angle) * 1.6 + item.windShift;
            }

            if (item.x < 35) item.x = 35;
            if (item.x > V_WIDTH - 35) item.x = V_WIDTH - 35;

            // Chạm đáy mất máu
            if (item.y > 580) {
                decreaseHealth(12); comboCount = 0;
                playSound('wrong'); showFeedback("Lọt rác mất rồi! 😟", "#e67e22");
                fallingItems.splice(i, 1); continue;
            }
        }

        // Hết thời gian đếm ngược xử lý của từng rác
        if (item.timeLeft <= 0) {
            decreaseHealth(12); comboCount = 0;
            playSound('wrong'); showFeedback("Hết giờ xử lý rác! ⏰", "#e74c3c");
            if (draggingItem && draggingItem.id === item.id) draggingItem = null;
            fallingItems.splice(i, 1); continue;
        }

        ctx.save(); ctx.font = "52px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(item.text, item.x + stormX, item.y);
        
        ctx.font = "bold 11px Arial"; ctx.fillStyle = currentLevel === 6 ? "#ffffff" : "#2c3e50"; 
        ctx.fillText(item.name, item.x + stormX, item.y - 35);

        // Thanh tiến trình đếm ngược thời gian (Đã kéo dài ra 35s rất vừa tay)
        let timeBarWidth = 52;
        let progress = item.timeLeft / item.maxTime;
        ctx.fillStyle = "rgba(189, 195, 199, 0.5)"; ctx.fillRect(item.x - timeBarWidth/2 + stormX, item.y - 50, timeBarWidth, 5);
        ctx.fillStyle = progress > 0.35 ? "#2ecc71" : "#e74c3c"; 
        ctx.fillRect(item.x - timeBarWidth/2 + stormX, item.y - 50, timeBarWidth * Math.max(0, progress), 5);

        ctx.restore();
    }

    // Hiển thị các hạt hiệu ứng bùng nổ
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.03;
        if (p.alpha <= 0) { particles.splice(i, 1); } 
        else {
            ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
    }

    // Hiển thị chữ phản hồi (Chính xác, Nhầm thùng)
    if (feedbackTimer > 0) {
        ctx.fillStyle = feedbackColor; ctx.font = "bold 15px Arial"; ctx.textAlign = "center";
        ctx.fillText(feedbackText, V_WIDTH / 2, 130); feedbackTimer--;
    }

    // Hiển thị phần thưởng danh hiệu khi thăng cấp (Banner Vinh Danh Sáng Tạo)
    if (rewardShowTimer > 0 && currentRewardShow) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)"; ctx.fillRect(15, 220, 450, 140);
        ctx.lineWidth = 2; ctx.strokeStyle = "#f1c40f"; ctx.strokeRect(15, 220, 450, 140);
        
        ctx.fillStyle = "#f1c40f"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center";
        ctx.fillText("🎁 PHẦN THƯỞNG DANH HIỆU MÔI TRƯỜNG 🎁", V_WIDTH / 2, 255);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 14px Arial";
        ctx.fillText("Nhận vật phẩm: " + currentRewardShow.name, V_WIDTH / 2, 295);
        ctx.font = "italic 11px Arial"; ctx.fillStyle = "#bdc3c7";
        ctx.fillText(currentRewardShow.desc, V_WIDTH / 2, 325);
        
        rewardShowTimer--;
        if (rewardShowTimer <= 0) currentRewardShow = null;
    }

    // Hiển thị thông báo thăng cấp vòng
    if (levelUpTimer > 0 && !currentRewardShow) {
        ctx.fillStyle = currentLevel === 6 ? "#f1c40f" : "#d35400"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
        let titleLvl = currentLevel === 6 ? "🌪️ KÍCH HOẠT CẤP 6: SIÊU BÃO ĐẢO LỘN 🌪️" : "🌟 VÒNG KHÓ CẤP " + currentLevel + " BẮT ĐẦU 🌟";
        ctx.fillText(titleLvl, V_WIDTH / 2, 320);
        levelUpTimer--;
    }

    // Hiển thị chữ Combo thần tốc nếu có
    if (comboCount >= 3) {
        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 13px Arial"; ctx.textAlign = "left";
        ctx.fillText("🔥 COMBO x" + comboCount + " (+ Nhịp độ)", 20, 65);
    }

    // Hiển thị bộ sưu tập vật phẩm đã tích lũy gọn gàng dưới đáy màn hình nền cỏ
    if (playerBadges.length > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(10, 680, V_WIDTH - 20, 16);
        ctx.fillStyle = "#ffffff"; ctx.font = "10px Arial"; ctx.textAlign = "left";
        ctx.fillText("Vật phẩm thu thập: " + playerBadges.join("  "), 15, 692);
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
    initAudio(); 
    const pos = getMousePos(e);

    if (inQuizMode && quizFeedbackTimer > 0) return;

    // KÍCH HOẠT TẠM DỪNG 1 CHẠM HOÀN HẢO
    if (gameStarted && !gameOver && !inQuizMode && !showIntro) {
        if (pos.x >= pauseBtn.x && pos.x <= pauseBtn.x + pauseBtn.w &&
            pos.y >= pauseBtn.y && pos.y <= pauseBtn.y + pauseBtn.h) {
            isPaused = !isPaused;
            if (isPaused) stopBGM(); else startBGM(); 
            if (e.cancelable) e.preventDefault();
            return; 
        }
    }

    if (isPaused) return; 

    if (showIntro) {
        if (pos.x >= 140 && pos.x <= 340 && pos.y >= 525 && pos.y <= 571) {
            showIntro = false; gameStarted = true; score = 0; quizScore = 0; lives = 3; health = 100; currentLevel = 1;
            playerBadges = []; comboCount = 0;
            replenishQueue(); spawnItem();
        }
        return;
    }

    if (inQuizMode && currentQuiz && quizFeedbackTimer === 0) {
        let chosen = null;
        if (pos.x >= 35 && pos.x <= 445) {
            if (pos.y >= 250 && pos.y <= 300) chosen = "a";
            if (pos.y >= 320 && pos.y <= 370) chosen = "b";
            if (pos.y >= 390 && pos.y <= 440) chosen = "c";
        }
        if (chosen) {
            if (chosen === currentQuiz.ans) {
                quizScore += 100; 
                playSound('correct');
                quizFeedback = "🎉 ĐÚNG RỒI! BẠN ĐƯỢC TÍNH +100Đ THƯỞNG KHI KẾT THÚC VÒNG";
            } else {
                playSound('wrong');
                quizFeedback = "😟 SAI RỒI! HÃY CHÚ Ý PHÂN LOẠI KỸ HƠN NHÉ!";
            }
            quizFeedbackTimer = 110; 
        }
        return;
    }

    if (gameOver) {
        if (pos.x >= 160 && pos.x <= 320 && pos.y >= 410 && pos.y <= 456) {
            gameOver = false; score = 0; quizScore = 0; lives = 3; health = 100; currentLevel = 1; fallingItems = []; activeDrawQueue = []; playerBadges = []; comboCount = 0;
            rearrangeBins(); build400TrashDatabase(); replenishQueue(); spawnItem();
        }
        return;
    }

    // Logic gắp rác tầm chuẩn
    for (let i = fallingItems.length - 1; i >= 0; i--) {
        let item = fallingItems[i];
        const dist = Math.hypot(pos.x - item.x, pos.y - item.y);
        if (dist < 45) { 
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

function handleEnd(e) {
    if (isPaused || !draggingItem) { draggingItem = null; return; }
    
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
            // Tích hợp tính năng Combo sáng tạo độc đáo thi đấu
            comboCount++; comboTimer = 150; 
            let addedScore = 10;
            if (comboCount >= 3) {
                addedScore = 20; // Nhân đôi điểm thưởng khi đạt chuỗi combo
                playSound('combo');
                showFeedback(`🔥 COMBO CHUỖI XANH! +20 Điểm 🎉`, "#e74c3c");
            } else {
                playSound('correct');
                showFeedback("Chính xác! +10 Điểm 🎉", "#2ecc71");
            }
            
            score += addedScore;
            createParticles(item.x, item.y, binColor(matchedBin.id));
            fallingItems = fallingItems.filter(i => i.id !== item.id);
            checkLevelProgress();
            
            // Đạt từ 2500 điểm trở lên (Cấp 5+): Xáo đảo lộn vị trí thùng liên tục để tăng tính thử thách cực đại
            if (score >= 2500) {
                bins.sort(() => Math.random() - 0.5); rearrangeBins();
            }
        } else {
            decreaseHealth(15); comboCount = 0;
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
