// ============================================================================
// 🍏 TRÒ CHƠI: HÀNH TRÌNH XANH LÂM ĐỒNG - PHIÊN BẢN CHÍNH THỨC (PRODUCTION READY)
// 📝 THÔNG TIN SẢN PHẨM & BẢN QUYỀN TÁC GIẢ 
// ============================================================================
const AUTHOR_NAME  = "Lê Hoàng Minh Triết - Nguyễn Thành Thiện Nhân "; 
const AUTHOR_CLASS = "Lớp 6A1 - Trường THCS Chí Công";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('canvas-wrapper');

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
let score = 0, quizScore = 0, lives = 3, health = 100, currentLevel = 1;
let gameOver = false, gameStarted = false, showIntro = true, levelUpTimer = 0, isPaused = false; 
let comboCount = 0, comboTimer = 0, inQuizMode = false, currentQuiz = null, quizFeedback = "", quizFeedbackTimer = 0;  
let floatingTexts = []; // MỚI: Mảng quản lý hiệu ứng chữ điểm bay sinh động

let playerBadges = [];
const rewardsData = {
    1: { name: "🌱 Mầm Xanh Hy Vọng", desc: "Tặng vì khởi đầu xuất sắc ở Cấp 1: Ươm mầm ý thức bảo vệ môi trường!" },
    2: { name: "🧪 Tinh Chất Sinh Học", desc: "Tặng vì đạt mốc Cấp 2: Tái chế rác hữu cơ thành siêu vi lượng chất dinh dưỡng!" },
    3: { name: "💎 Thùng Vô Cực Hologram", desc: "Tặng vì đạt mốc Cấp 3: Chuyên gia phân cấp rác đúng chuẩn công nghệ tương lai!" },
    4: { name: "🛡️ Găng Tay Kháng Độc", desc: "Tặng vì đạt mốc Cấp 4: An toàn phân loại tuyệt đối chất thải nguy hại!" },
    5: { name: "⚡ Động Cơ Thu Gom Phản Lực", desc: "Tặng vì đạt mốc Cấp 5: Làm chủ phản xạ đảo thùng rác thần tốc!" },
    6: { name: "👑 Vương Miện Sinh Thái", desc: "Huy hiệu Tối cao Cấp 6: Kiên cường vượt qua bão táp biến đổi khí hậu!" }
};
let currentRewardShow = null, rewardShowTimer = 0;

// --- HỆ THỐNG HIỆU ỨNG MÔI TRƯỜNG CHUYỂN ĐỘNG XUYÊN SUỐT ---
let ambientParticles = [];
function initAmbientParticles() {
    ambientParticles = [];
    for(let i=0; i<30; i++) {
        ambientParticles.push({
            x: Math.random() * V_WIDTH, y: Math.random() * V_HEIGHT,
            speedY: Math.random() * 1 + 0.5, speedX: (Math.random() - 0.5) * 1,
            size: Math.random() * 3 + 2, angle: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.02
        });
    }
}
initAmbientParticles();

function updateAndDrawAmbient(ctx) {
    ctx.save();
    for (let i = 0; i < ambientParticles.length; i++) {
        let p = ambientParticles[i];
        if (currentLevel <= 3) {
            p.y += p.speedY * 0.7; p.x += Math.sin(p.angle) * 0.5 + 0.3; p.angle += p.rotSpeed;
            ctx.fillStyle = "rgba(46, 204, 113, 0.4)"; ctx.beginPath();
            ctx.ellipse(p.x, p.y, p.size * 1.5, p.size * 0.7, p.angle, 0, Math.PI * 2); ctx.fill();
        } else if (currentLevel <= 5) {
            p.y += (Math.random() - 0.5) * 0.6; p.x += (Math.random() - 0.5) * 0.6;
            ctx.fillStyle = "rgba(241, 196, 15, 0.3)"; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2); ctx.fill();
        } else {
            p.y += 8; p.x -= 3;
            ctx.strokeStyle = "rgba(174, 214, 241, 0.4)"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 6, p.y + 15); ctx.stroke();
        }
        if (p.y > V_HEIGHT) { p.y = -20; p.x = Math.random() * V_WIDTH; }
        if (p.x > V_WIDTH) p.x = 0; if (p.x < 0) p.x = V_WIDTH;
    }
    ctx.restore();
}

let clouds = [{ x: 40, y: 80, speed: 0.15, size: 25 }, { x: 220, y: 120, speed: 0.08, size: 35 }];
const pauseBtn = { x: V_WIDTH - 50, y: 15, w: 35, h: 35 };

// --- HỆ THỐNG ÂM THANH GIẢ LẬP ---
let audioCtx = null, bgmOsc = null, bgmGain = null, bgmInterval = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    startBGM();
}
function startBGM() {
    if (bgmOsc) return; 
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        bgmOsc = audioCtx.createOscillator(); bgmGain = audioCtx.createGain();
        let notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63], noteIdx = 0;
        bgmOsc.type = 'triangle'; bgmGain.gain.setValueAtTime(0.015, audioCtx.currentTime);
        bgmInterval = setInterval(() => {
            if (audioCtx && gameStarted && !gameOver && !inQuizMode && !isPaused && bgmOsc) {
                let now = audioCtx.currentTime, freq = notes[noteIdx % notes.length];
                if (currentLevel >= 5) freq *= 1.25; 
                bgmOsc.frequency.setValueAtTime(freq, now); noteIdx++;
            }
        }, 450);
        bgmOsc.connect(bgmGain); bgmGain.connect(audioCtx.destination); bgmOsc.start();
    } catch(e) { console.log(e); }
}
function stopBGM() {
    if (bgmInterval) { clearInterval(bgmInterval); bgmInterval = null; }
    if (bgmOsc) { try { bgmOsc.stop(); bgmOsc.disconnect(); } catch(e){} bgmOsc = null; }
    if (bgmGain) { try { bgmGain.disconnect(); } catch(e){} bgmGain = null; }
}
function playSound(type) {
    if (!audioCtx || isPaused) return;
    try {
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        if (type === 'correct') {
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.12, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc.start(); osc.stop(audioCtx.currentTime + 0.15);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(140, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(65, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.18, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            osc.start(); osc.stop(audioCtx.currentTime + 0.2);
        } else if (type === 'levelup') {
            osc.frequency.setValueAtTime(440, audioCtx.currentTime); osc.frequency.setValueAtTime(554.37, audioCtx.currentTime + 0.1);
            osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.2); osc.frequency.exponentialRampToValueAtTime(1108.7, audioCtx.currentTime + 0.4);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
            osc.start(); osc.stop(audioCtx.currentTime + 0.45);
        } else if (type === 'combo') {
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); osc.frequency.setValueAtTime(698.46, audioCtx.currentTime + 0.08);
            osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.16); gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3); osc.start(); osc.stop(audioCtx.currentTime + 0.3);
        }
    } catch (e) {}
}

// --- KHO DỮ LIỆU ĐỘC BẢN RÁC THẢI ---
const masterTrashPool = [
    { text: "🍏", name: "Táo xanh úng thối", type: "organic" }, { text: "🍎", name: "Táo đỏ dập nát", type: "organic" }, { text: "🍐", name: "Quả lê héo mốc", type: "organic" },
    { text: "🍊", name: "Vỏ cam quýt bỏ thừa", type: "organic" }, { text: "🍋", name: "Vỏ chanh mục nát", type: "organic" }, { text: "🍌", name: "Vỏ chuối lên men", type: "organic" },
    { text: "🍉", name: "Vỏ dưa hấu chảy nước", type: "organic" }, { text: "🍇", name: "Chùm nho thối hỏng", type: "organic" }, { text: "🍓", name: "Dâu tây mốc trắng", type: "organic" },
    { text: "🍅", name: "Cà chua dập thối", type: "organic" }, { text: "🥔", name: "Khoai tây mọc mầm", type: "organic" }, { text: "🥕", name: "Củ cà rốt khô héo", type: "organic" },
    { text: "🌽", name: "Lõi ngô thừa", type: "organic" }, { text: "🥬", name: "Lá cải bắp úa vàng", type: "organic" }, { text: "🍞", name: "Bánh mì quá hạn mốc", type: "organic" },
    { text: "🍖", name: "Xương sườn lợn thừa", type: "organic" }, { text: "🍗", name: "Xương đùi gà ăn dở", type: "organic" }, { text: "EG", name: "Vỏ trứng vịt vỡ", type: "organic" },
    { text: "🍲", name: "Cặn bã rau canh", type: "organic" }, { text: "🌾", name: "Rơm rạ mục mọc nấm", type: "organic" }, { text: "🍂", name: "Lá cây khô rụng", type: "organic" },
    { text: "🥀", name: "Hoa hồng héo tàn", type: "organic" }, { text: "🍵", name: "Bã trà lọc ẩm ướt", type: "organic" }, { text: "☕", name: "Bã cà phê nguyên chất", type: "organic" },
    { text: "📦", name: "Hộp giấy carton phế liệu", type: "recyclable" }, { text: "📰", name: "Tờ báo cũ rách", type: "recyclable" }, { text: "📑", name: "Giấy in văn phòng cũ", type: "recyclable" },
    { text: "📚", name: "Sách giáo khoa cũ bỏ", type: "recyclable" }, { text: "🍾", name: "Chai thủy tinh rỗng sạch", type: "recyclable" }, { text: "🥫", name: "Vỏ lon nước ngọt móp", type: "recyclable" },
    { text: "🥤", name: "Chai nhựa PET rửa sạch", type: "recyclable" }, { text: "🥛", name: "Hộp sữa giấy hết sạch", type: "recyclable" }, { text: "🧴", name: "Chai dầu gội nhựa rỗng", type: "recyclable" },
    { text: "⚙️", name: "Bánh răng sắt phế liệu", type: "recyclable" }, { text: "🛠️", name: "Cờ lê gỉ không dùng", type: "recyclable" }, { text: "螺", name: "Bu lông ốc vít sắt cũ", type: "recyclable" },
    { text: "勺", name: "Thìa inox cũ hỏng", type: "recyclable" }, { text: "🫙", name: "Hũ thủy tinh rỗng", type: "recyclable" }, { text: "🍳", name: "Chảo nhôm hỏng quai", type: "recyclable" },
    { text: "🛍️", name: "Túi nilon rách bẩn", type: "residual" }, { text: "🚬", name: "Tàn thuốc lá đã tắt", type: "residual" }, { text: "🧱", name: "Mảnh gạch ngói vỡ vụn", type: "residual" },
    { text: "🥣", name: "Bát đĩa gốm sứ mẻ góc", type: "residual" }, { text: "🧦", name: "Tất chân cũ rách nát", type: "residual" }, { text: "👕", name: "Vải vụn quần áo bẩn", type: "residual" },
    { text: "🌂", name: "Ô che mưa gãy nan", type: "residual" }, { text: "🏺", name: "Mảnh gốm sành vỡ nát", type: "residual" }, { text: "✏️", name: "Mẩu bút chì cụt", type: "residual" },
    { text: "🎈", name: "Xác bóng bay cao su nổ", type: "residual" }, { text: "🧻", name: "Giấy ăn bẩn dính dầu", type: "residual" }, { text: "🎞️", name: "Băng keo cuộn dính tạp chất", type: "residual" },
    { text: "🧼", name: "Vỏ bao bì bánh kẹo bẩn", type: "residual" }, { text: "🥾", name: "Đế giày cao su mòn vẹt", type: "residual" },
    { text: "🔋", name: "Cục pin tiểu hư", type: "medical" }, { text: "😷", name: "Khẩu trang y tế đã dùng", type: "medical" }, { text: "🩹", name: "Băng gạc cá nhân cũ bẩn", type: "medical" },
    { text: "💊", name: "Thuốc viên Tây y quá hạn", type: "medical" }, { text: "💡", name: "Bóng đèn huỳnh quang hỏng", type: "medical" }, { text: "🪫", name: "Bình ắc quy chì axit hỏng", type: "medical" },
    { text: "💨", name: "Bình xịt côn trùng dở dang", type: "medical" }, { text: "🛢️", name: "Dầu thải động cơ xe máy", type: "medical" }, { text: "💅", name: "Lọ sơn móng tay cũ độc hại", type: "medical" },
    { text: "💥", name: "Hộp keo dán sắt công nghiệp", type: "medical" }, { text: "🪣", name: "Chất tẩy rửa bồn cầu cực mạnh", type: "medical" }, { text: "📱", name: "Pin Lithium máy tính phồng", type: "medical" },
    { text: "💾", name: "Linh kiện bo mạch điện tử chì", type: "medical" }, { text: "🌿", name: "Thuốc diệt cỏ chứa hóa chất", type: "medical" }, { text: "🎨", name: "Dung môi pha sơn công nghiệp", type: "medical" },
    { text: "🪵", name: "Hóa chất bảo quan gỗ độc hại", type: "medical" }, { text: "🔥", name: "Chất lỏng tẩy rỉ sét axit", type: "medical" },
    { text: "💉", name: "Kim tiêm dính máu y tế", type: "special_danger" }, { text: "🌡️", name: "Nhiệt kế thủy ngân vỡ", type: "special_danger" }, { text: "🧪", name: "Lọ hóa chất thí nghiệm độc", type: "special_danger" },
    { text: "☠️", name: "Vỏ chai thuốc trừ sâu độc", type: "special_danger" }, { text: "☢️", name: "Chất thải phóng xạ nguy hại", type: "special_danger" }, { text: "🔬", name: "Ống nghiệm chứa mẫu bệnh phẩm", type: "special_danger" },
    { text: "🩸", name: "Chai cồn sát trùng công nghiệp", type: "special_danger" }
];

let activeDrawQueue = [];
function replenishQueue() {
    let filtered = [...masterTrashPool];
    if (currentLevel < 4) filtered = filtered.filter(item => item.type !== 'medical' && item.type !== 'special_danger');
    for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }
    activeDrawQueue = filtered;
}

// --- KHO CÂU HỎI TRẮC NGHIỆM ĐỒ SỘ ĐÃ ĐỒNG BỘ ĐÁP ÁN C ---
const quizBank = {
    1: [
        { q: "Rác hữu cơ dễ phân hủy gồm những loại nào sau đây?", a: "A. Thức ăn thừa, rau quả hư, lá cây khô, bã trà", b: "B. Lon nước ngọt nhôm và chai nhựa PET rỗng", c: "C. Cục pin tiểu hỏng và khẩu trang y tế đã dùng", ans: "a", realAns: "A" },
        { q: "Trong rác hữu cơ, loại nào phân hủy nhanh nhất?", a: "A. Xương động vật, sừng động vật lớn", b: "B. Lá cây tươi, vỏ trái cây mọng nước", c: "C. Cành cây gỗ khô mục", ans: "b", realAns: "B" },
        { q: "Sản phẩm phân hữu cơ sau khi ủ rác sinh hoạt có ích gì?", a: "A. Làm sạch nguồn nước ngầm tuyệt đối", b: "B. Cung cấp chất dinh dưỡng tốt cho đất và cây trồng", c: "C. Giúp diệt trừ toàn bộ sâu bệnh hại", ans: "b", realAns: "B" },
        { q: "Thời gian phân hủy trung bình của một chiếc lá cây rụng là bao lâu?", a: "A. Từ vài tuần đến vài tháng tùy độ ẩm", b: "B. Phải mất ít nhất là 50 năm chôn lấp", c: "C. Không bao giờ tự phân hủy được", ans: "a", realAns: "A" },
        { q: "Loại rác hữu cơ nào sau đây chứa hàm lượng xenlulozo cao khó mục nhất?", a: "A. Xác rau cải bắp", b: "B. Vỏ chuối chín nẫu", c: "C. Xơ xơ dừa và cành củi khô", ans: "c", realAns: "C" },
        { q: "Tại sao không nên để rác hữu cơ quá lâu trong nhà mà không xử lý?", a: "A. Sẽ sinh khí gas làm nổ ngôi nhà", b: "B. Phát sinh mùi hôi thối và vi khuẩn, ruồi muỗi lây bệnh", c: "C. Làm hỏng kết cấu gạch nền nhà", ans: "b", realAns: "B" },
        { q: "Mùi hôi từ rác hữu cơ phân hủy sinh ra chủ yếu do loại khí nào?", a: "A. Khí Oxy tinh khiết", b: "B. Khí Hydro Sunfua (H2S) và Amoniac (NH3)", c: "C. Khí Nitơ trơ khí quyển", ans: "b", realAns: "B" },
        { q: "Bộ phận nào của động vật trong rác hữu cơ khó phân hủy nhất?", a: "A. Thịt thừa, mỡ động vật", b: "B. Xương, răng, vỏ sò vỏ ngao", c: "C. Da và lông mao bọc ngoài bảo vệ", ans: "b", realAns: "B" },
        { q: "Ủ rác hữu cơ theo phương pháp hiếu khí nghĩa là gì?", a: "A. Ủ kín không cho không khí lọt vào", b: "B. Ủ thoáng có cung cấp Oxy đầy đủ cho vi sinh vật", c: "C. Ngâm hoàn toàn rác sâu dưới nước bẩn", ans: "b", realAns: "B" },
        { q: "Vỏ của các loại quả có tinh dầu (cam, chanh) có tác dụng gì khi ủ?", a: "A. Làm đất bị nhiễm độc nặng", b: "B. Xua đuổi côn trùng và tạo mùi thơm tự nhiên cho phân ủ", c: "C. Làm phân hủy nhanh gấp 100 lần", ans: "b", realAns: "B" }
    ],
    2: [
        { q: "Tại sao cần đổ hết nước thừa trong chai nhựa trước khi phân loại?", a: "A. Tránh làm ướt, hỏng rác giấy tái chế khác và giảm tải trọng", b: "B. Để chai nhựa không phát nổ khi gặp nắng", c: "C. Để chai có thể nổi trên mặt nước dâng", ans: "a", realAns: "A" },
        { q: "Loại nhựa nào sau đây phổ biến nhất để làm chai nước khoáng tái chế?", a: "A. Nhựa PVC độc hại", b: "B. Nhựa PET hoặc PETE chịu lực", c: "C. Nhựa xốp PS dùng một lần", ans: "b", realAns: "B" },
        { q: "Ký hiệu tam giác có số 1 dưới đáy chai nghĩa là gì?", a: "A. Chỉ được dùng một lần rồi đem tái chế", b: "B. Có thể đựng nước sôi vô hạn lần", c: "C. Chai làm từ kim loại quý", ans: "a", realAns: "A" },
        { q: "Tái chế nhôm phế liệu giúp tiết kiệm bao nhiêu năng lượng so với sản xuất nhôm mới?", a: "A. Tiết kiệm tới 95% năng lượng tiêu thụ", b: "B. Chỉ tiết kiệm được khoảng 5%", c: "C. Không tiết kiệm được chút năng lượng nào", ans: "a", realAns: "A" },
        { q: "Giấy vụn có thể được tái chế tối đa khoảng bao nhiêu lần trước khi sợi xenlulozo quá ngắn?", a: "A. Tái chế vô hạn lần", b: "B. Khoảng từ 5 đến 7 lần", c: "C. Chỉ đúng 1 lần duy nhất", ans: "b", realAns: "B" },
        { q: "Chất liệu thủy tinh có thể tái chế như thế nào?", a: "A. Tái chế vô hạn lần mà không giảm chất lượng", b: "B. Chỉ tái chế được thành pha lê đắt tiền", c: "C. Rất khó nóng chảy nên không thể tái chế", ans: "a", realAns: "A" },
        { q: "Vỏ hộp sữa giấy (hộp giấy tetra pak) cấu tạo gồm những thành phần nào?", a: "A. 100% là đất sét nung", b: "B. Giấy, nhựa PE và lớp màng nhôm mỏng siêu bảo vệ", c: "C. Thủy tinh lỏng dẻo", ans: "b", realAns: "B" },
        { q: "Tại sao lốp xe cao su cũ không nên vứt ra bãi rác chôn lấp tự do?", a: "A. Chiếm diện tích lớn và là nơi đọng nước sinh muỗi vằn sốt xuất huyết", b: "B. Lốp xe sẽ tự bốc cháy tạo ra kim cương", c: "C. Lốp xe tan chảy làm hỏng mạch nước", ans: "a", realAns: "A" },
        { q: "Kim loại nào thu hồi nhiều nhất từ vỏ lon bia phế liệu?", a: "A. Kim loại Sắt", b: "B. Kim loại Nhôm", c: "C. Kim loại Đồng đỏ", ans: "b", realAns: "B" },
        { q: "Mục đích lớn nhất của việc thu gom và tái chế phế liệu sắt thép là gì?", a: "A. Giảm khai thác quặng mỏ tự nhiên và giảm ô nhiễm khí thải CO2", b: "B. Tăng lượng rác thải ra đại dương", c: "C. Giúp sắt thép biến đổi thành nhựa cứng", ans: "a", realAns: "A" }
    ],
    3: [
        { q: "Sản phẩm nào sau đây KHÔNG THỂ tái chế và phải bỏ vào rác vô cơ?", a: "A. Sách giáo khoa, báo giấy cũ", b: "B. Gương vỡ, bát đĩa gốm sứ, thủy tinh chịu nhiệt", c: "C. Vỏ lon nước ngọt nhôm sạch", ans: "b", realAns: "B" },
        { q: "Túi nilon thông thường mất bao lâu để tự phân hủy trong lòng đất chôn lấp?", a: "A. Vài tháng mùa hè", b: "B. Khoảng từ 100 đến 500 năm hoặc lâu hơn nữa", c: "C. Chỉ mất 1 đến 2 năm sinh hoạt", ans: "b", realAns: "B" },
        { q: "Hộp xốp đựng cơm làm từ nhựa PS thuộc nhóm rác nào?", a: "A. Rác hữu cơ tự nhiên", b: "B. Rác vô cơ (rác còn lại) do cực kỳ khó tái chế và giá trị thấp", c: "C. Rác nguy hại y tế lây nhiễm", ans: "b", realAns: "B" },
        { q: "Phương pháp xử lý rác vô cơ không thể tái chế phổ biến hiện nay là gì?", a: "A. Đốt phát điện tiêu chuẩn cao hoặc chôn lấp hợp vệ sinh", b: "B. Đổ toàn bộ ra sông suối lớn", c: "C. Nghiền nhỏ trộn vào thức ăn gia súc", ans: "a", realAns: "A" },
        { q: "Đốt rác nilon, nhựa vô cơ ở nhiệt độ thấp tại nhà sinh ra chất độc nào?", a: "A. Khí Oxy tinh khiết", b: "B. Khí Dioxin và Furan cực độc gây ung thư", c: "C. Khí Nitơ làm mát bầu không khí", ans: "b", realAns: "B" },
        { q: "Tại sao băng keo đóng gói đã bẩn dính tạp chất được xếp vào rác vô cơ còn lại?", a: "A. Vì cấu trúc nhựa dẻo pha tạp chất keo hóa học bám dính không thể nghiền bột hay tái chế thô", b: "B. Vì chúng làm từ lá cây hữu cơ", c: "C. Vì chúng có thể ủ thành mùn dinh dưỡng", ans: "a", realAns: "A" },
        { q: "Giấy ăn đã bẩn dính dầu mỡ thực phẩm thuộc nhóm rác nào?", a: "A. Rác tái chế cao cấp", b: "B. Rác vô cơ (còn lại) vì không thể nghiền bột giấy tái chế được nữa", c: "C. Rác nguy hại chất phóng xạ", ans: "b", realAns: "B" },
        { q: "Mẩu tàn thuốc lá vứt bừa bãi gây hại gì cho sinh vật?", a: "A. Chứa sợi lọc nhựa xenlulozo axetat và nicotin độc hại đầu độc nguồn nước", b: "B. Làm sạch đất trồng xung quanh", c: "C. Cung cấp vitamin cho loài cá", ans: "a", realAns: "A" },
        { q: "Quần áo cũ làm từ sợi nhân tạo polyester khi mục nát thải ra thứ gì nguy hiểm?", a: "A. Các hạt vi nhựa (microplastics) xâm nhập chuỗi thức ăn", b: "B. Khí oxy hóa lỏng", c: "C. Kim loại vàng nguyên chất", ans: "a", realAns: "A" },
        { q: "Hạt vi nhựa có đường kính định nghĩa nhỏ hơn bao nhiêu?", a: "A. Nhỏ hơn 5 milimét (5 mm)", b: "B. Nhỏ hơn 5 mét (5 m)", c: "C. Nhỏ hơn 50 centimét (50 cm)", ans: "a", realAns: "A" }
    ],
    4: [
        { q: "Loại rác nguy hại nào hay gặp ở gia đình chứa kim loại nặng chì, thủy ngân?", a: "A. Túi nilon đen đựng đồ", b: "B. Các loại pin tiểu, bình ắc quy, bóng đèn huỳnh quang hỏng", c: "C. Vỏ chai nước suối nhựa", ans: "b", realAns: "B" },
        { q: "Khi thu gom các chất độc hại như kim tiêm y tế hoặc vỏ chai thuốc trừ sâu, ta phải bỏ vào thùng màu gì?", a: "A. Thùng màu xanh lá cây hữu cơ", b: "B. Thùng màu cam chuyên dụng chứa chất nguy hại", c: "C. Thùng rác tái chế bằng giấy", ans: "b", realAns: "B" },
        { q: "Tại sao không được vứt pin cũ chung với rác sinh hoạt thông thường?", a: "A. Tránh rò rỉ hóa chất và kim loại nặng đầu độc đất, mạch nước ngầm", b: "B. Vì pin làm nặng thùng rác của xe", c: "C. Vì pin có thể tự sạc lại điện", ans: "a", realAns: "A" },
        { q: "Kim loại nặng Cadmium trong pin cũ tích tụ trong cơ thể gây hỏng cơ quan nào?", a: "A. Làm chắc xương khớp", b: "B. Gây suy thận kinh niên và xương giòn dễ gãy", c: "C. Tăng cường thị lực cho mắt", ans: "b", realAns: "B" },
        { q: "Bóng đèn huỳnh quang cũ bị vỡ phát tán ra khí độc gì?", a: "A. Hơi thủy ngân cực độc hại cho hệ thần kinh và hô hấp", b: "B. Khí Oxy thiên nhiên", c: "C. Khí Gas nấu ăn", ans: "a", realAns: "A" },
        { q: "Ký hiệu thùng rác y tế/nguy hại lây nhiễm trong trò chơi có màu gì đặc trưng?", a: "A. Thường có màu cam kèm chữ ĐỘC HẠI nổi bật", b: "B. Màu xanh lá cây thân thiện", c: "C. Màu hồng cá tính", ans: "a", realAns: "A" },
        { q: "Thuốc tây y quá hạn sử dụng nếu vứt tự do ra bãi rác gây hậu quả gì?", a: "A. Tạo ra các siêu vi khuẩn kháng thuốc (kháng sinh) nguy hiểm", b: "B. Làm bổ dưỡng cho tôm cá dưới ao", c: "C. Giúp cây cối mọc nhanh hơn", ans: "a", realAns: "A" },
        { q: "Vỏ chai xi măng, bao bì dính hóa chất xây dựng thuộc nhóm rác nào?", a: "A. Rác hữu cơ ủ phân", b: "B. Chất thải nguy hại cần thu gom riêng biệt", c: "C. Rác tái chế làm vở viết", ans: "b", realAns: "B" },
        { q: "Lọ sơn móng tay, dung môi một khi bỏ đi thuộc nhóm rác nào vì sao?", a: "A. Rác tái chế vì làm từ thủy tinh", b: "B. Rác nguy hại vì chứa các hợp chất hữu cơ dễ bay hơi độc (VOCs)", c: "C. Rác hữu cơ lành tính", ans: "b", realAns: "B" },
        { q: "Biện pháp xử lý pin cũ thu gom đúng quy chuẩn kỹ thuật hiện nay là gì?", a: "A. Đem chôn sâu dưới cát mịn", b: "B. Hóa già, bóc tách thu hồi kim loại quý trong nhà máy chuyên dụng", c: "C. Thả trôi sông đại dương", ans: "b", realAns: "B" }
    ],
    5: [
        { q: "Theo Luật Bảo vệ Môi trường mới, hành vi không phân loại rác bị xử lý thế nào?", a: "A. Tịch thu nhà ở vĩnh viễn", b: "B. Bị từ chối thu gom rác và xử phạt vi phạm hành chính bằng tiền", c: "C. Bắt buộc đi lao động công ích 5 năm", ans: "b", realAns: "B" },
        { q: "Mô hình kinh tế kéo dài tuổi thọ vật liệu, loại bỏ rác từ khâu thiết kế?", a: "A. Kinh tế tuyến tính lỗi thời", b: "B. Kinh tế tuần hoàn (Circular Economy)", c: "C. Kinh tế thị trường tự do", ans: "b", realAns: "B" },
        { q: "Khí gas sinh ra mạnh từ bãi rác chôn lấp kị khí gây hiệu ứng nhà kính?", a: "A. Khí Oxy bầu trời", b: "B. Khí Mê-tan (CH4) mạnh gấp 28 lần CO2", c: "C. Khí Heli bay khinh khí cầu", ans: "b", realAns: "B" },
        { q: "Nguyên tắc '3R' trong bảo vệ môi trường viết tắt của những từ nào?", a: "A. Run, Read, Remember", b: "B. Reduce (Giảm thiểu), Reuse (Tái sử dụng), Recycle (Tái chế)", c: "C. Repair, Replace, Remove", ans: "b", realAns: "B" },
        { q: "Rác thải đại dương phần lớn là loại vật liệu nào chiếm tỷ lệ cao nhất?", a: "A. Rác gỗ và rơm rạ khô", b: "B. Rác nhựa dùng một lần và lưới đánh cá phế thải", c: "C. Xác gốm sứ cổ đại", ans: "b", realAns: "B" },
        { q: "Hiện tượng 'Đại dương axit hóa' chủ yếu do biển hấp thụ quá nhiều khí gì?", a: "A. Khí Cacbonic (CO2) từ hoạt động đốt nhiên liệu hóa thạch", b: "B. Khí Nitơ lỏng", c: "C. Khí Hydro tinh thể", ans: "a", realAns: "A" },
        { q: "Hành động nào giúp học sinh giảm lượng rác thải nhựa tại trường học?", a: "A. Mỗi ngày mua một chai nước suối nhựa mới", b: "B. Mang theo bình nước cá nhân sử dụng nhiều lần", c: "C. Vứt túi nilon xuống cống trường", ans: "b", realAns: "B" },
        { q: "Chất độc Dioxin (chất độc màu da cam) cực kỳ bền vững, thuộc nhóm chất ô nhiễm nào?", a: "A. Chất ô nhiễm hữu cơ khó phân hủy (POPs)", b: "B. Chất hữu cơ dễ phân hủy sinh học", c: "C. Khí hiếm thân thiện môi trường", ans: "a", realAns: "A" },
        { q: "Khái niệm 'Dấu chân Cacbon' (Carbon Footprint) thể hiện điều gì?", a: "A. Kích thước bàn chân của con người", b: "B. Tổng lượng khí nhà kính phát thải trực tiếp và gián tiếp từ hoạt động của con người", c: "C. Trọng lượng rác thải giấy thu gom", ans: "b", realAns: "B" },
        { q: "Ngày Môi trường Thế giới được Liên Hợp Quốc quy định là ngày nào?", a: "A. Ngày 5 tháng 6 hàng năm", b: "B. Ngày 1 tháng 1 hàng năm", c: "C. Ngày 25 tháng 12 hàng năm", ans: "a", realAns: "A" }
    ],
    6: [
        { q: "When severe storms occur, which environmental action is most appropriate?", a: "A. Clean up garbage neatly, clear drainage to avoid flooding", b: "B. Dump all wastes down into drainage pipes", c: "C. Do nothing and leave waste drifting freely with storm water", ans: "a", realAns: "A" },
        { q: "Biến đổi khí hậu toàn cầu gây ra hậu quả cực đoan nào rõ rệt nhất?", a: "A. Thời tiết ôn hòa quanh năm", b: "B. Nước biển dâng, bão lũ siêu cấp, hạn hán và xâm nhập mặn khốc liệt", c: "C. Trái đất quay chậm lại đáng kể", ans: "b", realAns: "B" },
        { q: "Nguồn năng lượng nào sau đây được gọi là năng lượng xanh sạch tái tạo?", a: "A. Than đá, dầu mỏ, khí đốt tự nhiên", b: "B. Năng lượng mặt trời, gió, sóng biển và địa nhiệt", c: "C. Năng lượng từ đốt rác nhựa hở", ans: "b", realAns: "B" },
        { q: "Hiện tượng 'Hiệu ứng nhà kính' khiến Trái Đất gặp tình trạng gì?", a: "A. Bị lạnh giá bao phủ toàn cầu", b: "B. Nhiệt độ bầu khí quyển nóng lên, làm tan băng ở hai cực", c: "C. Ánh sáng mặt trời biến mất hoàn toàn", ans: "b", realAns: "B" },
        { q: "Mưa axit hình thành do khí thải độc hại nào từ nhà máy điện than?", a: "A. Khí Lưu huỳnh đi-ô-xít (SO2) và các Ô-xít Nitơ (NOx)", b: "B. Khí Hơi nước tinh khiết", c: "C. Khí Argon quý hiếm", ans: "a", realAns: "A" },
        { q: "Tầng Ô-zôn (O3) trong bầu khí quyển có vai trò sinh tồn gì?", a: "A. Cung cấp Oxy cho máy bay hoạt động", b: "B. Ngăn chặn các tia cực tím (UV) độc hại từ Mặt Trời hủy hoại da sinh vật", c: "C. Giữ cho rác không bay vào vũ trụ", ans: "b", realAns: "B" },
        { q: "Hóa chất công nghiệp nào cấu chế làm thủng tầng Ô-zôn mạnh nhất?", a: "A. Khí Nitơ lỏng mát", b: "B. Hợp chất Chlorofluorocarbons (CFCs) từ tủ lạnh, điều hòa cũ", c: "C. Khí Cacbonic tưới cây", ans: "b", realAns: "B" },
        { q: "Trồng rừng phòng hộ đầu nguồn mang lại lợi ích sinh thái then chốt gì?", a: "A. Tạo cảnh quan để xây biệt thự", b: "B. Giữ đất chống xói mòn, hạn chế lũ quét, lũ ống khi mưa bão", c: "C. Làm tăng nhiệt độ vùng núi", ans: "b", realAns: "B" },
        { q: "Mực nước biển dâng cao đe dọa trực tiếp đến đồng bằng nào lớn nhất nước ta?", a: "A. Đồng bằng sông Hồng", b: "B. Đồng bằng sông Cửu Long (vùng vựa lúa miền Tây)", c: "C. Đồng bằng duyên hải miền Trung", ans: "b", realAns: "B" },
        { q: "Mục tiêu tối thượng của Thỏa thuận Khí hậu Paris toàn cầu là gì?", a: "A. Tăng gấp đôi sản lượng khai thác dầu", b: "B. Giữ nhiệt độ Trái Đất tăng không quá 2 độ C so với thời kỳ tiền công nghiệp", c: "C. Xây dựng bến cảng trên mặt trăng", ans: "b", realAns: "B" }
    ]
};

let bins = [
    { id: "organic", name: "HỮU CƠ", color1: "#8B5A2B", color2: "#5C3A21", x: 0, y: 595, w: 92, h: 80 },
    { id: "recyclable", name: "TÁI CHẾ", color1: "#3498db", color2: "#2980b9", x: 0, y: 595, w: 92, h: 80 },
    { id: "residual", name: "VÔ CƠ", color1: "#95a5a6", color2: "#7f8c8d", x: 0, y: 595, w: 92, h: 80 },
    { id: "medical", name: "ĐỘC HẠI", color1: "#e67e22", color2: "#d35400", x: 0, y: 595, w: 92, h: 80 }
];

let fallingItems = [], draggingItem = null, dragOffsetX = 0, dragOffsetY = 0, particles = [];
let feedbackText = "", feedbackColor = "", feedbackTimer = 0;

function showFeedback(text, color) { feedbackText = text; feedbackColor = color; feedbackTimer = 50; }

// MỚI: Khởi tạo hàm sinh chữ bay điểm số (+10, -15...) chuẩn gaming
function spawnFloatingText(text, x, y, color, size = "bold 16px Arial") {
    floatingTexts.push({ text: text, x: x, y: y, color: color, alpha: 1, vy: -1.2, size: size });
}

function spawnItem() {
    if (activeDrawQueue.length === 0) replenishQueue();
    let raw = activeDrawQueue.pop(); if (!raw) return;
    let baseTime = 36 - (currentLevel * 2); if (currentLevel === 6) baseTime = 22; 
    let spawnY = -60;
    if (fallingItems.length > 0) {
        let lowestY = Math.min(...fallingItems.map(i => i.y)); spawnY = lowestY - 200; 
    }
    fallingItems.push({
        id: Math.random(), text: raw.text, name: raw.name, type: raw.type,
        x: Math.random() * (V_WIDTH - 150) + 75, y: spawnY,
        angle: Math.random() * Math.PI, windShift: (Math.random() - 0.5) * 1.5,
        timeLeft: baseTime, maxTime: baseTime   
    });
}

function rearrangeBins() {
    let activeCount = (currentLevel >= 4) ? 4 : 3;
    let padding = (V_WIDTH - (activeCount * 92)) / (activeCount + 1);
    let activeBins = (currentLevel >= 4) ? bins : bins.filter(b => b.id !== 'medical');
    activeBins.forEach((bin, idx) => { bin.x = padding + idx * (92 + padding); });
}

function triggerQuiz(level) {
    stopBGM(); inQuizMode = true;
    let questionsList = quizBank[level] || quizBank[1];
    currentQuiz = questionsList[Math.floor(Math.random() * questionsList.length)];
    quizFeedback = ""; quizFeedbackTimer = 0;
}

function checkLevelProgress() {
    let newLevel = 1;
    if (score >= 1500) newLevel = 6;
    else if (score >= 1200) newLevel = 5; 
    else if (score >= 750) newLevel = 4;  
    else if (score >= 400) newLevel = 3;  
    else if (score >= 150) newLevel = 2;  

    if (newLevel !== currentLevel) {
        currentLevel = newLevel; levelUpTimer = 90; playSound('levelup');
        if (rewardsData[currentLevel]) {
            currentRewardShow = rewardsData[currentLevel]; rewardShowTimer = 130; 
            playerBadges.push(currentRewardShow.name.split(" ")[0]); 
        }
        rearrangeBins(); fallingItems = []; triggerQuiz(currentLevel); 
    }
}

function decreaseHealth(amount) {
    health -= amount;
    if (health <= 0) {
        lives--; health = 100; if (lives <= 0) { gameOver = true; stopBGM(); }
    }
}

function createParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: x, y: y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6 - 2,
            radius: Math.random() * 3 + 2, color: color, alpha: 1
        });
    }
}

// --- THUẬT TOÁN TỰ ĐỘNG CHIA DÒNG CHỮ TRẠNH TRÀN KHUNG HƯỚNG DẪN ---
function drawTextWrap(text, x, y, maxWidth, lineHeight) {
    let words = text.split(' '), line = '';
    for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        if (ctx.measureText(testLine).width > maxWidth && n > 0) {
            ctx.fillText(line, x, y); line = words[n] + ' '; y += lineHeight;
        } else { line = testLine; }
    }
    ctx.fillText(line, x, y); return y;
}

function draw3DBin(ctx, bin) {
    ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowOffsetY = 6;
    let topW = bin.w, botW = bin.w - 14, shift = (topW - botW) / 2;
    ctx.fillStyle = bin.color2; ctx.beginPath();
    ctx.moveTo(bin.x, bin.y + 12); ctx.lineTo(bin.x + topW, bin.y + 12);
    ctx.lineTo(bin.x + topW - shift, bin.y + bin.h); ctx.lineTo(bin.x + shift, bin.y + bin.h);
    ctx.closePath(); ctx.fill();

    let gradThun = ctx.createLinearGradient(bin.x, bin.y, bin.x, bin.y + bin.h);
    gradThun.addColorStop(0, bin.color1); gradThun.addColorStop(1, bin.color2);
    ctx.fillStyle = gradThun; ctx.beginPath();
    ctx.moveTo(bin.x + 3, bin.y + 15); ctx.lineTo(bin.x + topW - 3, bin.y + 15);
    ctx.lineTo(bin.x + topW - shift - 3, bin.y + bin.h - 3); ctx.lineTo(bin.x + shift + 3, bin.y + bin.h - 3);
    ctx.closePath(); ctx.fill();

    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.fillStyle = bin.color1;
    ctx.beginPath(); ctx.roundRect(bin.x - 3, bin.y, bin.w + 6, 12, 4); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(bin.x - 3, bin.y, bin.w + 6, 4);
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 11px Arial"; ctx.textAlign = "center";
    ctx.fillText(bin.name, bin.x + bin.w / 2, bin.y + bin.h / 2 + 10); ctx.restore();
}

// --- VÒNG LẶP ĐIỀU PHỐI GAME TOÀN CỤC ---
function gameLoop() {
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);
    let skyGrad = ctx.createLinearGradient(0, 0, 0, V_HEIGHT);
    if (currentLevel <= 3) { skyGrad.addColorStop(0, '#eef7f6'); skyGrad.addColorStop(1, '#d5eadd'); } 
    else if (currentLevel <= 5) { skyGrad.addColorStop(0, '#f5f7fa'); skyGrad.addColorStop(1, '#e4e8f0'); } 
    else { skyGrad.addColorStop(0, '#2c3e50'); skyGrad.addColorStop(1, '#1a252f'); }
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    ctx.fillStyle = currentLevel === 6 ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.6)";
    clouds.forEach(c => {
        if (!isPaused && !showIntro && !inQuizMode && !gameOver) c.x += (currentLevel >= 5) ? c.speed * 8 : c.speed;
        if (c.x - 40 > V_WIDTH) c.x = -40;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2); ctx.fill();
    });

    if (!isPaused && !showIntro && !inQuizMode && !gameOver) updateAndDrawAmbient(ctx);
    ctx.fillStyle = currentLevel === 6 ? "#1e5f38" : "#27ae60"; ctx.fillRect(0, 580, V_WIDTH, 120);

    // --- MÀN HÌNH INTRO ĐÃ ĐƯỢC FIX TRIỆT ĐỂ LỖI TRÀN CHỮ BẢN QUYỀN TÁC GIẢ ---
    if (showIntro) {
        ctx.fillStyle = "#27ae60"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
        ctx.fillText("HÀNH TRÌNH XANH LÂM ĐỒNG - BẢN 11.2", V_WIDTH / 2, 55);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)"; ctx.fillRect(25, 85, 430, 420);
        ctx.lineWidth = 2; ctx.strokeStyle = "#27ae60"; ctx.strokeRect(25, 85, 430, 420);

        ctx.fillStyle = "#2c3e50"; ctx.font = "bold 12px Arial"; ctx.textAlign = "left";
        let introLines = [
            "🎮 CÁCH CHƠI: Kéo thả rác vào đúng các thùng phân loại bên dưới: HỮU CƠ, TÁI CHẾ, VÔ CƠ.",
            "☣️ THÙNG MỚI: Đạt Cấp 4 sẽ xuất hiện thêm thùng ĐỘC HẠI để xử lý các loại chất thải cực kỳ nguy hiểm.",
            "🚨 SIÊU NGUY HIỂM: Cảnh giác cao độ với 7 loại rác tử thần (Kim tiêm, thủy ngân, chai thuốc sâu...).",
            "⚡ PHẠT CỰC NẶNG: Trừ ngay 30% HP nếu phân loại sai hoặc để lọt nhóm rác Siêu Nguy Hiểm ra môi trường!",
            "📝 TRI THỨC XANH: Trả lời các câu hỏi trắc nghiệm kiến thức sinh thái sau mỗi cấp để nhận điểm.",
            "🎁 PHẦN THƯỞNG: Vượt qua các mốc điểm lớn để thu thập bộ 6 Danh hiệu bảo vệ môi trường cao quý."
        ];
        let currentY = 115;
        introLines.forEach(line => { currentY = drawTextWrap(line, 38, currentY, 405, 18) + 24; });

        // ĐÃ FIX: Tách nhỏ thông tin tác giả thành 2 dòng riêng biệt, dồn căn giữa tuyệt đối trong khung trắng
        ctx.fillStyle = "#7f8c8d"; ctx.font = "italic 11px Arial"; ctx.textAlign = "center";
        ctx.fillText(`Tác giả: ${AUTHOR_NAME}`, V_WIDTH / 2, 474);
        ctx.fillText(AUTHOR_CLASS, V_WIDTH / 2, 491);

        ctx.fillStyle = "#27ae60"; ctx.fillRect(140, 525, 200, 46);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 15px Arial"; ctx.fillText("BẮT ĐẦU THỨ THÁCH", V_WIDTH / 2, 553);
        requestAnimationFrame(gameLoop); return;
    }

    if (inQuizMode && currentQuiz) {
        ctx.fillStyle = "rgba(14, 25, 37, 0.96)"; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);
        ctx.fillStyle = "#f1c40f"; ctx.font = "bold 18px Arial"; ctx.textAlign = "center";
        ctx.fillText("🌟 THỬ THÁCH TRI THỨC XANH CẤP " + currentLevel + " 🌟", V_WIDTH / 2, 85);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 15px Arial";
        
        let words = currentQuiz.q.split(' '), line = '', startY = 135;
        for(let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            if (ctx.measureText(testLine).width > 400 && n > 0) {
                ctx.fillText(line, V_WIDTH / 2, startY); line = words[n] + ' '; startY += 26;
            } else { line = testLine; }
        }
        ctx.fillText(line, V_WIDTH / 2, startY);

        let opts = [{ id: "a", text: currentQuiz.a, y: 260, color: "#2980b9" }, { id: "b", text: currentQuiz.b, y: 345, color: "#27ae60" }, { id: "c", text: currentQuiz.c, y: 430, color: "#8e44ad" }];
        opts.forEach(opt => {
            ctx.fillStyle = opt.color; ctx.beginPath(); ctx.roundRect(35, opt.y, 410, 62, 8); ctx.fill();
            ctx.lineWidth = 1.5; ctx.strokeStyle = "#ffffff"; ctx.strokeRect(35, opt.y, 410, 62);
            ctx.fillStyle = "#ffffff"; ctx.font = "bold 13px Arial"; ctx.textAlign = "left";
            
            let oWords = opt.text.split(' '), oLine = '', oY = opt.y + 26;
            for(let m=0; m<oWords.length; m++) {
                let tOLine = oLine + oWords[m] + ' ';
                if(ctx.measureText(tOLine).width > 380 && m > 0){
                    ctx.fillText(oLine, 50, oY); oLine = oWords[m] + ' '; oY += 20;
                } else oLine = tOLine;
            }
            ctx.fillText(oLine, 50, oY);
        });

        if (quizFeedbackTimer > 0) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; ctx.fillRect(10, 520, V_WIDTH - 20, 110);
            ctx.lineWidth = 2; ctx.strokeStyle = quizFeedback.includes("ĐÚNG") ? "#2ecc71" : "#e74c3c"; ctx.strokeRect(10, 520, V_WIDTH - 20, 110);
            ctx.fillStyle = quizFeedback.includes("ĐÚNG") ? "#2ecc71" : "#ff7675"; ctx.font = "bold 13px Arial"; ctx.textAlign = "center";
            
            let fbWords = quizFeedback.split(' '), fbLine = '', fbY = 555;
            for(let k=0; k<fbWords.length; k++) {
                let tFb = fbLine + fbWords[k] + ' ';
                if(ctx.measureText(tFb).width > 420 && k > 0){
                    ctx.fillText(fbLine, V_WIDTH/2, fbY); fbLine = fbWords[k] + ' '; fbY += 20;
                } else fbLine = tFb;
            }
            ctx.fillText(fbLine, V_WIDTH/2, fbY);
            quizFeedbackTimer--; if (quizFeedbackTimer <= 0) { inQuizMode = false; currentQuiz = null; startBGM(); }
        }
        requestAnimationFrame(gameLoop); return;
    }

    if (gameOver) {
        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 32px Arial"; ctx.textAlign = "center"; ctx.fillText("TRÒ CHƠI KẾT THÚC", V_WIDTH / 2, 210);
        ctx.fillStyle = "#2c3e50"; ctx.font = "bold 16px Arial"; ctx.fillText("Điểm phân loại: " + score + " Điểm", V_WIDTH / 2, 260);
        ctx.fillStyle = "#27ae60"; ctx.fillText("Điểm trắc nghiệm: +" + quizScore + " Điểm", V_WIDTH / 2, 290);
        ctx.fillStyle = "#d35400"; ctx.font = "bold 22px Arial"; ctx.fillText("TỔNG ĐIỂM CHUNG CUỘC: " + (score + quizScore) + " ĐIỂM", V_WIDTH / 2, 335);
        ctx.fillStyle = "#3498db"; ctx.fillRect(160, 410, 160, 46);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 15px Arial"; ctx.fillText("CHƠI LẠI", V_WIDTH / 2, 438);
        requestAnimationFrame(gameLoop); return;
    }

    // --- MỚI: TẬN DỤNG GIAO DIỆN PAUSE LÀM SỔ TAY TRA CỨU PHÂN LOẠI SIÊU XỊN ---
    if (isPaused) {
        ctx.fillStyle = "rgba(10, 24, 16, 0.9)"; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center"; ctx.fillText("ĐANG TẠM DỪNG TRÒ CHƠI", V_WIDTH / 2, 110);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)"; ctx.beginPath(); ctx.roundRect(25, 145, 430, 375, 10); ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = "#2ecc71"; ctx.strokeRect(25, 145, 430, 375);
        ctx.fillStyle = "#2ecc71"; ctx.font = "bold 14px Arial"; ctx.fillText("📘 SỔ TAY TRA CỨU PHÂN LOẠI NHANH", V_WIDTH / 2, 175);

        let guides = [
            { icon: "🟫 HỮU CƠ:", text: "Thức ăn thừa, rau quả hư mục, bã trà/cà phê, lá khô, vỏ trứng, xương nhỏ..." },
            { icon: "🟦 TÁI CHẾ:", text: "Hộp carton, giấy vụn, sách cũ, vỏ lon bia/nước ngọt, chai nhựa PET sạch..." },
            { icon: "⬜ VÔ CƠ:", text: "Túi nilon dính bẩn, băng keo, giấy ăn đã dùng, vỏ kẹo, gốm sứ mẻ, tàn thuốc..." },
            { icon: "🟧 ĐỘC HẠI (LV4+):", text: "Pin hư, khẩu trang, bóng đèn huỳnh quang vỡ, thuốc tây quá hạn, dầu thải..." },
            { icon: "🟥 SIÊU CẤP ĐỘC:", text: "Kim tiêm dính máu, nhiệt kế thủy ngân vỡ, vỏ chai thuốc trừ sâu..." }
        ];
        let gy = 215;
        guides.forEach(g => {
            ctx.textAlign = "left"; ctx.fillStyle = "#f1c40f"; ctx.font = "bold 12px Arial"; ctx.fillText(g.icon, 40, gy);
            ctx.fillStyle = "#ffffff"; ctx.font = "12px Arial"; drawTextWrap(g.text, 40, gy + 16, 400, 16); gy += 56;
        });

        ctx.fillStyle = "#2ecc71"; ctx.beginPath(); ctx.roundRect(pauseBtn.x, pauseBtn.y, pauseBtn.w, pauseBtn.h, 6); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center"; ctx.fillText("▶", pauseBtn.x + pauseBtn.w/2, pauseBtn.y + pauseBtn.h/2 + 4);
        requestAnimationFrame(gameLoop); return;
    }

    ctx.fillStyle = currentLevel === 6 ? "#ffffff" : "#2c3e50"; ctx.font = "bold 13px Arial"; ctx.textAlign = "left";
    ctx.fillText("MẠNG: " + "❤️".repeat(lives), 15, 33); ctx.fillText("HP: ", 145, 33);
    ctx.fillStyle = "#bdc3c7"; ctx.fillRect(175, 22, 100, 14);
    ctx.fillStyle = health > 30 ? "#2ecc71" : "#e74c3c"; ctx.fillRect(175, 22, (health / 100) * 100, 14);
    ctx.textAlign = "right"; ctx.fillText("🏆 ĐIỂM: " + score + " | LV: " + currentLevel, V_WIDTH - 65, 33);

    ctx.fillStyle = "#7f8c8d"; ctx.beginPath(); ctx.roundRect(pauseBtn.x, pauseBtn.y, pauseBtn.w, pauseBtn.h, 6); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center"; ctx.fillText("||", pauseBtn.x + pauseBtn.w/2, pauseBtn.y + pauseBtn.h/2 + 4);

    let activeCount = (currentLevel >= 4) ? 4 : 3, activeBins = bins.slice(0, activeCount);
    activeBins.forEach(bin => draw3DBin(ctx, bin));

    let targetItemsCount = (currentLevel >= 5) ? 3 : 2; if (currentLevel === 6) targetItemsCount = 4;
    if (fallingItems.length < targetItemsCount) spawnItem();

    if (comboTimer > 0) { comboTimer--; if (comboTimer <= 0) comboCount = 0; }
    let stormX = (currentLevel === 6) ? Math.sin(Date.now() * 0.05) * 2 : 0;

    for (let i = fallingItems.length - 1; i >= 0; i--) {
        let item = fallingItems[i];
        if (draggingItem && draggingItem.id === item.id) { item.timeLeft -= 1/60; } 
        else {
            let fallSpeed = 0.5 + (currentLevel * 0.2); 
            if (currentLevel === 5) fallSpeed = 1.9; if (currentLevel === 6) fallSpeed = 2.4;
            item.y += fallSpeed; item.timeLeft -= 1/60; 

            if (currentLevel === 3 || currentLevel === 4) {
                item.angle += 0.015; item.x += Math.sin(item.angle) * 0.7;
            } else if (currentLevel >= 5) {
                item.angle += 0.05; item.x += Math.sin(item.angle) * 1.6 + item.windShift;
            }
            if (item.x < 35) item.x = 35; if (item.x > V_WIDTH - 35) item.x = V_WIDTH - 35;

            if (item.y > 580) {
                let damage = (item.type === 'special_danger') ? 30 : 15; decreaseHealth(damage); 
                showFeedback(item.type === 'special_danger' ? "🚨 LỌT CHẤT ĐẶC BIỆT NGUY HIỂM! -30% HP!!" : "Lọt rác nguy hại! -15% HP!", "#e74c3c"); 
                spawnFloatingText(`-${damage} HP`, item.x, 560, "#e74c3c", "bold 18px Arial"); // Điểm bay khi lọt rác
                playSound('wrong'); comboCount = 0; fallingItems.splice(i, 1); continue;
            }
        }

        if (item.timeLeft <= 0) {
            let damage = (item.type === 'special_danger') ? 30 : 15; decreaseHealth(damage); 
            showFeedback(item.type === 'special_danger' ? "🚨 Nổ tung chất độc do hết giờ! -30% HP!" : "Hết giờ xử lý rác! -15% HP!", "#e74c3c");
            spawnFloatingText(`-${damage} HP`, item.x, item.y - 20, "#e74c3c", "bold 18px Arial"); // Điểm bay khi hết giờ
            comboCount = 0; playSound('wrong'); if (draggingItem && draggingItem.id === item.id) draggingItem = null;
            fallingItems.splice(i, 1); continue;
        }

        ctx.save(); ctx.font = "52px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(item.text, item.x + stormX, item.y);
        ctx.font = "bold 13px Arial"; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3; ctx.strokeText(item.name, item.x + stormX, item.y + 42);
        ctx.fillStyle = (item.type === 'special_danger') ? "#ff0000" : ((item.type === 'medical') ? "#d35400" : "#2c3e50"); ctx.fillText(item.name, item.x + stormX, item.y + 42);

        let timeBarWidth = 52, progress = item.timeLeft / item.maxTime;
        ctx.fillStyle = "rgba(189, 195, 199, 0.5)"; ctx.fillRect(item.x - timeBarWidth/2 + stormX, item.y - 50, timeBarWidth, 5);
        ctx.fillStyle = progress > 0.35 ? "#2ecc71" : "#e74c3c"; ctx.fillRect(item.x - timeBarWidth/2 + stormX, item.y - 50, timeBarWidth * Math.max(0, progress), 5);
        ctx.restore();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.03;
        if (p.alpha <= 0) particles.splice(i, 1);
        else {
            ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
    }

    // MỚI: Tiến trình tính toán và vẽ chữ điểm bay (Floating Text) lên màn hình
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        let ft = floatingTexts[i]; ft.y += ft.vy; ft.alpha -= 0.02;
        if (ft.alpha <= 0) { floatingTexts.splice(i, 1); } 
        else {
            ctx.save(); ctx.globalAlpha = ft.alpha; ctx.fillStyle = ft.color; ctx.font = ft.size; ctx.textAlign = "center";
            ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 4; ctx.fillText(ft.text, ft.x, ft.y); ctx.restore();
        }
    }

    if (feedbackTimer > 0) {
        ctx.fillStyle = feedbackColor; ctx.font = "bold 15px Arial"; ctx.textAlign = "center"; ctx.fillText(feedbackText, V_WIDTH / 2, 130); feedbackTimer--;
    }

    if (rewardShowTimer > 0 && currentRewardShow) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)"; ctx.fillRect(15, 220, 450, 140);
        ctx.lineWidth = 2; ctx.strokeStyle = "#f1c40f"; ctx.strokeRect(15, 220, 450, 140);
        ctx.fillStyle = "#f1c40f"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center"; ctx.fillText("🎁 PHẦN THƯỞNG DANH HIỆU MÔI TRƯỜNG 🎁", V_WIDTH / 2, 255);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 14px Arial"; ctx.fillText("Nhận vật phẩm: " + currentRewardShow.name, V_WIDTH / 2, 295);
        ctx.font = "italic 11px Arial"; ctx.fillStyle = "#bdc3c7"; ctx.fillText(currentRewardShow.desc, V_WIDTH / 2, 325);
        rewardShowTimer--; if (rewardShowTimer <= 0) currentRewardShow = null;
    }

    if (levelUpTimer > 0 && !currentRewardShow) {
        ctx.fillStyle = currentLevel === 6 ? "#f1c40f" : "#d35400"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
        ctx.fillText(currentLevel === 6 ? "🌪️ KÍCH HOẠT CẤP 6: SIÊU BÃO ĐẢO LỘN 🌪️" : "🌟 VÒNG KHÓ CẤP " + currentLevel + " BẮT ĐẦU 🌟", V_WIDTH / 2, 320); levelUpTimer--;
    }

    if (comboCount >= 3) {
        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 13px Arial"; ctx.textAlign = "left"; ctx.fillText("🔥 COMBO x" + comboCount + " (+ Nhịp độ)", 20, 65);
    }

    // --- ĐÃ NÂNG CẤP: KHU VỰC DANH HIỆU "MẦM XANH" CHUẨN GAMING, NỔI BẬT VÀ PHÁT SÁNG ---
    if (playerBadges.length > 0) {
        ctx.save();
        let pulseAlpha = Math.abs(Math.sin(Date.now() * 0.005)); // Thuật toán băm nhịp pulsing mượt mà
        
        // Vẽ hộp nền gỗ ngọc bích đậm tạo chiều sâu
        ctx.fillStyle = "rgba(12, 44, 23, 0.92)";
        ctx.beginPath();
        ctx.roundRect(12, 674, V_WIDTH - 24, 22, 6);
        ctx.fill();
        
        // Vẽ đường viền Vàng Hoàng Kim phát sáng tỏa lan kích thích thị giác
        ctx.strokeStyle = `rgba(241, 196, 15, ${0.4 + pulseAlpha * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Hiệu ứng đổ bóng phát hào quang (Neon glow look)
        ctx.shadowColor = "#f1c40f";
        ctx.shadowBlur = 4 + pulseAlpha * 6;

        // Vẽ chữ Tiêu đề danh hiệu màu vàng kim rực rỡ
        ctx.fillStyle = "#f1c40f";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "left";
        ctx.fillText("🏆 KHO DANH HIỆU ĐÃ ĐẠT:", 20, 689);

        // Vẽ chuỗi huy hiệu emoji cỡ lớn sắc nét
        ctx.font = "14px Arial";
        ctx.shadowBlur = 0; // Tắt bóng để emoji không bị mờ nhòe chữ
        ctx.fillText(playerBadges.join("  "), 165, 691);
        ctx.restore();
    }
    requestAnimationFrame(gameLoop);
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * (V_WIDTH / rect.width), y: (clientY - rect.top) * (V_HEIGHT / rect.height) };
}

function handleStart(e) {
    initAudio(); const pos = getMousePos(e); if (inQuizMode && quizFeedbackTimer > 0) return;

    if (gameStarted && !gameOver && !inQuizMode && !showIntro) {
        if (pos.x >= pauseBtn.x && pos.x <= pauseBtn.x + pauseBtn.w && pos.y >= pauseBtn.y && pos.y <= pauseBtn.y + pauseBtn.h) {
            isPaused = !isPaused; if (isPaused) stopBGM(); else startBGM(); 
            if (e.cancelable) e.preventDefault(); return; 
        }
    }
    if (isPaused) return; 

    if (showIntro) {
        if (pos.x >= 140 && pos.x <= 340 && pos.y >= 525 && pos.y <= 571) {
            showIntro = false; gameStarted = true; score = 0; quizScore = 0; lives = 3; health = 100; currentLevel = 1;
            playerBadges = []; comboCount = 0; currentRewardShow = rewardsData[1]; rewardShowTimer = 130;
            playerBadges.push(rewardsData[1].name.split(" ")[0]);
            replenishQueue(); rearrangeBins(); spawnItem();
        }
        return;
    }

    if (inQuizMode && currentQuiz && quizFeedbackTimer === 0) {
        let chosen = null;
        if (pos.x >= 35 && pos.x <= 445) {
            if (pos.y >= 260 && pos.y <= 322) chosen = "a";
            if (pos.y >= 345 && pos.y <= 407) chosen = "b";
            if (pos.y >= 430 && pos.y <= 492) chosen = "c";
        }
        if (chosen) {
            if (chosen === currentQuiz.ans) {
                quizScore += 100; playSound('correct');
                quizFeedback = "🎉 ĐÚNG RỒI! BẠN ĐƯỢC TÍNH +100Đ THƯỞNG KHI KẾT THÚC VÒNG";
            } else {
                playSound('wrong'); quizFeedback = "😟 SAI RỒI! ĐÁP ÁN ĐÚNG PHẢI LÀ: " + currentQuiz.realAns;
            }
            quizFeedbackTimer = 130; 
        }
        return;
    }

    if (gameOver) {
        if (pos.x >= 160 && pos.x <= 320 && pos.y >= 410 && pos.y <= 456) {
            gameOver = false; score = 0; quizScore = 0; lives = 3; health = 100; currentLevel = 1; fallingItems = []; activeDrawQueue = []; playerBadges = []; comboCount = 0; floatingTexts = [];
            rearrangeBins(); replenishQueue(); spawnItem();
        }
        return;
    }

    for (let i = fallingItems.length - 1; i >= 0; i--) {
        let item = fallingItems[i]; const dist = Math.hypot(pos.x - item.x, pos.y - item.y);
        if (dist < 45) { draggingItem = item; dragOffsetX = pos.x - item.x; dragOffsetY = pos.y - item.y; if (e.cancelable) e.preventDefault(); break; }
    }
}

function handleMove(e) {
    if (isPaused || !draggingItem) return;
    const pos = getMousePos(e); draggingItem.x = pos.x - dragOffsetX; draggingItem.y = pos.y - dragOffsetY;
    if (e.cancelable) e.preventDefault();
}

function handleEnd(e) {
    if (isPaused || !draggingItem) { draggingItem = null; return; }
    let item = draggingItem; draggingItem = null;
    let activeCount = (currentLevel >= 4) ? 4 : 3, activeBins = bins.slice(0, activeCount), matchedBin = null;

    activeBins.forEach(bin => {
        if (item.x >= bin.x && item.x <= bin.x + bin.w && item.y >= bin.y && item.y <= bin.y + bin.h) matchedBin = bin;
    });

    if (matchedBin) {
        let isCorrect = (item.type === matchedBin.id) || (item.type === 'special_danger' && matchedBin.id === 'medical');
        if (isCorrect) {
            comboCount++; comboTimer = 150; let addedScore = 10;
            if (comboCount >= 3) { 
                addedScore = 20; playSound('combo'); 
                showFeedback(`🔥 COMBO CHUỖI XANH! +20 Điểm 🎉`, "#e74c3c"); 
                spawnFloatingText(`🔥 COMBO +20`, item.x, item.y - 20, "#ff3838", "bold 20px Arial"); // Điểm bay dạng combo bốc lửa
            } else { 
                playSound('correct'); 
                showFeedback("Chính xác! +10 Điểm 🎉", "#2ecc71"); 
                spawnFloatingText(`+10`, item.x, item.y - 20, "#2ecc71", "bold 16px Arial"); // Điểm bay dạng chuẩn lá xanh
            }
            score += addedScore; createParticles(item.x, item.y, binColor(matchedBin.id));
            fallingItems = fallingItems.filter(i => i.id !== item.id); checkLevelProgress();
            if (score >= 1200 && score < 1500) { bins.sort(() => Math.random() - 0.5); rearrangeBins(); }
        } else {
            let damage = (item.type === 'special_danger') ? 30 : 15; decreaseHealth(damage); comboCount = 0; playSound('wrong'); 
            showFeedback(item.type === 'special_danger' ? "🚨 SAI LẦM CHẾT NGƯỜI! Phân loại sai chất cực độc! -30% HP!" : "Nhầm thùng rồi em ơi! -15% HP!", "#e74c3c");
            spawnFloatingText(`-${damage} HP`, item.x, item.y - 20, "#e74c3c", "bold 18px Arial"); // Điểm bay báo hiệu sát thương mất máu
            fallingItems = fallingItems.filter(i => i.id !== item.id);
        }
    }
}

function binColor(id) {
    if (id === 'organic') return '#8B5A2B'; if (id === 'recyclable') return '#3498db';
    if (id === 'residual') return '#95a5a6'; return '#e67e22';
}

canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);
canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
window.addEventListener('touchend', handleEnd);

replenishQueue();
rearrangeBins();
requestAnimationFrame(gameLoop);
