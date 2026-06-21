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
let score = 0;          // Điểm phân loại rác chính thức (dùng để xét lên cấp)
let quizScore = 0;      // Điểm thưởng từ câu hỏi trắc nghiệm (cộng dồn lúc kết thúc game)
let lives = 3;
let health = 100; 
let currentLevel = 1;
let gameOver = false;
let gameStarted = false;
let showIntro = true;
let levelUpTimer = 0;
let isPaused = false; 

// Trạng thái cho chế độ câu hỏi trắc nghiệm phụ giữa các cấp độ
let inQuizMode = false;
let currentQuiz = null;
let quizFeedback = "";       // Lưu thông báo Đúng/Sai cho câu hỏi
let quizFeedbackTimer = 0;  // Thời gian hiển thị thông báo Đúng/Sai trước khi đóng câu hỏi

let clouds = [
    { x: 40, y: 80, speed: 0.25, size: 25 },
    { x: 220, y: 120, speed: 0.15, size: 35 }
];

// --- TOÀN BỘ ĐỊNH NGHĨA NÚT TẠM DỪNG (PAUSE BUTTON) ---
const pauseBtn = { x: V_WIDTH - 50, y: 15, w: 35, h: 35 };

// --- 🎵 TỔ HỢP ÂM THANH & NHẠC NỀN XUYÊN SUỐT ---
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        startBackgroundMusic();
    }
}

function startBackgroundMusic() {
    try {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        let notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
        let noteIdx = 0;
        osc.type = 'triangle';
        gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
        
        setInterval(() => {
            // 🌟 ĐÃ SỬA: Tắt nhạc nền nếu đang trong Quiz Mode (inQuizMode = true)
            if (audioCtx && gameStarted && !gameOver && !inQuizMode && !isPaused) {
                let now = audioCtx.currentTime;
                let freq = notes[noteIdx % notes.length];
                if (currentLevel === 5) freq *= 1.15;
                osc.frequency.setValueAtTime(freq, now);
                noteIdx++;
            }
        }, 450);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start();
    } catch(e) { console.log(e); }
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
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc.start(); osc.stop(audioCtx.currentTime + 0.15);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(140, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(65, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            osc.start(); osc.stop(audioCtx.currentTime + 0.2);
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

// --- ❓ NGÂN HÀNG CÂU HỎI TRẮC NGHIỆM ---
const quizBank = {
    2: { q: "Rác hữu cơ sau khi phân loại nên được xử lý thế nào?", a: "A. Thiêu hủy đốt bỏ", b: "B. Ủ làm phân bón hữu cơ sinh học", c: "C. Chôn lấp vô thời hạn", ans: "b" },
    3: { q: "Hành động nào giúp tái chế rác thải giấy hiệu quả nhất?", a: "A. Gom bán ve chai, đưa về nhà máy giấy tái chế", b: "B. Vứt chung với rác nilon", c: "C. Đốt để sưởi ấm", ans: "a" },
    4: { q: "Tại sao không được vứt gộp Pin cũ chung với rác thải Vô cơ thông thường?", a: "A. Vì Pin quá nặng", b: "B. Rò rỉ kim loại nặng gây ô nhiễm đất, nguồn nước", c: "C. Gây tốn diện tích chôn", ans: "b" },
    5: { q: "Biện pháp xử lý tối ưu nhất đối với rác thải y tế lây nhiễm độc hại là gì?", a: "A. Rửa sạch tái sử dụng công cộng", b: "B. Đốt trong lò thiêu chuyên dụng nhiệt độ cao", c: "C. Đổ ra sông suối tự nhiên", ans: "b" }
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
    
    // Tăng thời gian quy định cho học sinh thư thả xử lý
    let maxDuration = Math.max(7, 15 - currentLevel * 1.5); 

    fallingItems.push({
        id: Math.random(),
        text: raw.text, name: raw.name, type: raw.type,
        x: Math.random() * (V_WIDTH - 140) + 70,
        // 🌟 ĐÃ SỬA: Tăng khoảng cách chiều cao rơi so le xa nhau rõ rệt (cách từ 150px đến 250px)
        y: -50 - (fallingItems.length * 180), 
        angle: Math.random() * 5,
        windShift: (Math.random() - 0.5) * 1.5,
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
    inQuizMode = true;
    currentQuiz = quizBank[level];
    quizFeedback = "";
    quizFeedbackTimer = 0;
}

function checkLevelProgress() {
    let newLevel = 1;
    // 🌟 ĐÃ SỬA: Khung điểm thăng cấp chuẩn xác không tính điểm thưởng cộng dồn
    if (score >= 220) newLevel = 5;
    else if (score >= 150) newLevel = 4;
    else if (score >= 90) newLevel = 3;
    else if (score >= 40) newLevel = 2;

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
        if (lives <= 0) gameOver = true;
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
        ctx.fillText("HÀNH TRÌNH XANH LÂM ĐỒNG - BẢN 7.0", V_WIDTH / 2, 90);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)"; ctx.fillRect(25, 130, 430, 360);
        ctx.lineWidth = 2; ctx.strokeStyle = "#27ae60"; ctx.strokeRect(25, 130, 430, 360);

        ctx.fillStyle = "#2c3e50"; ctx.font = "13px Arial"; ctx.textAlign = "left";
        let lines = [
            "🏆 Khung cấp độ: Cấp 1 (40đ) | Cấp 2 (90đ) | Cấp 3 (150đ) | Cấp 4 (220đ)",
            "🎁 Điểm trắc nghiệm (+50đ) sẽ được CỘNG DỒN khi kết thúc trò chơi.",
            "🔇 Âm nhạc: Hệ thống tự tắt nhạc nền khi mở câu hỏi trắc nghiệm.",
            "⏳ Tốc độ: Đã giảm tốc độ rơi dịu lại khi xuất hiện nhiều rác cùng lúc.",
            "↕️ Khoảng cách: Vật phẩm rác xuất hiện cách xa nhau so le dễ nhìn.",
            "⏸️ Tính năng: Bấm biểu tượng [||] ở góc trên bên phải để tạm dừng.",
            "📊 Cơ chế thanh máu HP: Thả sai hoặc hết giờ đếm ngược sẽ bị hao máu."
        ];
        lines.forEach((line, idx) => ctx.fillText(line, 40, 165 + idx * 28));

        ctx.fillStyle = "#27ae60"; ctx.fillRect(140, 515, 200, 46);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "center";
        ctx.fillText("BẮT ĐẦU THỬ THÁCH", V_WIDTH / 2, 543);
        requestAnimationFrame(gameLoop); return;
    }

    // GIAO DIỆN MÀN HÌNH CÂU HỎI TRẮC NGHIỆM PHỤ TĂNG ĐIỂM
    if (inQuizMode && currentQuiz) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)"; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);
        ctx.fillStyle = "#f1c40f"; ctx.font = "bold 18px Arial"; ctx.textAlign = "center";
        ctx.fillText("🌟 THỬ THÁCH KIẾN THỨC MÔI TRƯỜNG 🌟", V_WIDTH / 2, 100);
        
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 14px Arial";
        ctx.fillText(currentQuiz.q, V_WIDTH / 2, 160);

        let opts = [
            { id: "a", text: currentQuiz.a, y: 230 },
            { id: "b", text: currentQuiz.b, y: 300 },
            { id: "c", text: currentQuiz.c, y: 370 }
        ];

        opts.forEach(opt => {
            ctx.fillStyle = "#34495e"; ctx.fillRect(40, opt.y, 400, 48);
            ctx.lineWidth = 1; ctx.strokeStyle = "#ffffff"; ctx.strokeRect(40, opt.y, 400, 48);
            ctx.fillStyle = "#ffffff"; ctx.font = "13px Arial"; ctx.textAlign = "left";
            ctx.fillText(opt.text, 60, opt.y + 28);
        });

        // 🌟 ĐÃ SỬA: Vẽ thông báo phản hồi Đúng/Sai trực quan ngay trên giao diện câu hỏi
        if (quizFeedbackTimer > 0) {
            ctx.fillStyle = quizFeedback.includes("ĐÚNG") ? "#2ecc71" : "#e74c3c";
            ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
            ctx.fillText(quizFeedback, V_WIDTH / 2, 470);
            quizFeedbackTimer--;
            if (quizFeedbackTimer <= 0) {
                inQuizMode = false;
                currentQuiz = null; // Trở lại màn hình chính sau khi đọc thông báo xong
            }
        }

        requestAnimationFrame(gameLoop); return;
    }

    // MÀN HÌNH KẾT THÚC GAME (GAME OVER)
    if (gameOver) {
        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 32px Arial"; ctx.textAlign = "center";
        ctx.fillText("TRÒ CHƠI KẾT THÚC", V_WIDTH / 2, 220);
        
        ctx.fillStyle = "#2c3e50"; ctx.font = "bold 16px Arial";
        ctx.fillText("Điểm phân loại: " + score + " Điểm", V_WIDTH / 2, 270);
        ctx.fillStyle = "#27ae60";
        ctx.fillText("Điểm thưởng Trắc nghiệm: +" + quizScore + " Điểm", V_WIDTH / 2, 300);
        
        // 🌟 ĐÃ SỬA: Hiển thị Tổng điểm cộng dồn cuối cùng cực kỳ rõ ràng
        ctx.fillStyle = "#d35400"; ctx.font = "bold 22px Arial";
        ctx.fillText("TỔNG ĐIỂM CHUNG CUỘC: " + (score + quizScore) + " ĐIỂM", V_WIDTH / 2, 340);

        ctx.fillStyle = "#3498db"; ctx.fillRect(160, 400, 160, 46);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 15px Arial"; ctx.fillText("CHƠI LẠI", V_WIDTH / 2, 428);
        requestAnimationFrame(gameLoop); return;
    }

    // MÀN HÌNH TẠM DỪNG (PAUSE)
    if (isPaused) {
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 26px Arial"; ctx.textAlign = "center";
        ctx.fillText("ĐANG TẠM DỪNG GAME", V_WIDTH / 2, 300);
        ctx.font = "15px Arial";
        ctx.fillText("Bấm vào biểu tượng nút ở góc trên để chơi tiếp", V_WIDTH / 2, 340);
        
        ctx.fillStyle = "#e67e22"; ctx.beginPath(); ctx.roundRect(pauseBtn.x, pauseBtn.y, pauseBtn.w, pauseBtn.h, 6); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 13px Arial"; ctx.textAlign = "center";
        ctx.fillText("▶", pauseBtn.x + pauseBtn.w/2, pauseBtn.y + pauseBtn.h/2 + 5);
        requestAnimationFrame(gameLoop); return;
    }

    // 2. HIỂN THỊ CHỈ SỐ HUD VÀ THANH MÁU (HP BAR)
    ctx.fillStyle = "#2c3e50"; ctx.font = "bold 14px Arial"; ctx.textAlign = "left";
    ctx.fillText("🏆 ĐIỂM: " + score, 20, 35);
    ctx.fillText("⚡ CẤP ĐỘ: " + currentLevel, 20, 58);
    ctx.textAlign = "right"; ctx.fillText("MẠNG: " + "❤️".repeat(lives), V_WIDTH - 70, 35);
    
    ctx.textAlign = "left"; ctx.fillText("HP: ", 220, 35);
    ctx.fillStyle = "#bdc3c7"; ctx.fillRect(255, 24, 130, 14);
    ctx.fillStyle = health > 30 ? "#2ecc71" : "#e74c3c"; 
    ctx.fillRect(255, 24, (health / 100) * 130, 14);

    // VẼ NÚT TẠM DỪNG TRÊN GÓC PHẢI MÀN HÌNH
    ctx.fillStyle = "#7f8c8d"; ctx.beginPath(); ctx.roundRect(pauseBtn.x, pauseBtn.y, pauseBtn.w, pauseBtn.h, 6); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center";
    ctx.fillText("||", pauseBtn.x + pauseBtn.w/2, pauseBtn.y + pauseBtn.h/2 + 4);

    // 3. VẼ HỆ THỐNG THÙNG RÁC CĂN ĐỀU
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

    // 4. QUẢN LÝ ĐIỀU PHỐI RA NHIỀU RÁC ĐỒNG THỜI
    let maxItemsOnScreen = 1;
    if (currentLevel === 2) maxItemsOnScreen = 2;
    if (currentLevel === 3) maxItemsOnScreen = 2;
    if (currentLevel >= 4) maxItemsOnScreen = 3; 

    if (fallingItems.length < maxItemsOnScreen && Math.random() < 0.04) {
        spawnItem();
    }

    // VÒNG LẶP XỬ LÝ DI CHUYỂN VÀ VẼ TỪNG LOẠI RÁC ĐANG RƠI
    for (let i = fallingItems.length - 1; i >= 0; i--) {
        let item = fallingItems[i];

        if (draggingItem && draggingItem.id === item.id) {
            item.timeLeft -= 1/60;
        } else {
            // 🌟 ĐÃ SỬA: Hạ bớt tốc độ rơi vật lý (chậm tịnh tiến vừa tay, dễ điều khiển hơn)
            let fallSpeed = 0.6 + (currentLevel * 0.4);
            if (currentLevel === 5) fallSpeed = 3.5;
            item.y += fallSpeed;
            item.timeLeft -= 1/60; 

            if (currentLevel === 3 || currentLevel === 4) {
                item.angle += 0.03; item.x += Math.sin(item.angle) * 1.0;
            } else if (currentLevel === 5) {
                item.angle += 0.07; item.x += Math.sin(item.angle) * 2.0 + item.windShift;
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

    // Không nhận phản hồi bấm nút nếu đang trong lúc hiển thị kết quả đúng/sai của câu hỏi
    if (inQuizMode && quizFeedbackTimer > 0) return;

    if (gameStarted && !gameOver && !inQuizMode && !showIntro) {
        if (pos.x >= pauseBtn.x && pos.x <= pauseBtn.x + pauseBtn.w &&
            pos.y >= pauseBtn.y && pos.y <= pauseBtn.y + pauseBtn.h) {
            isPaused = !isPaused;
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

    // XỬ LÝ CHỌN ĐÁP ÁN TRẮC NGHIỆM
    if (inQuizMode && currentQuiz && quizFeedbackTimer === 0) {
        let chosen = null;
        if (pos.x >= 40 && pos.x <= 440) {
            if (pos.y >= 230 && pos.y <= 278) chosen = "a";
            if (pos.y >= 300 && pos.y <= 348) chosen = "b";
            if (pos.y >= 370 && pos.y <= 418) chosen = "c";
        }
        if (chosen) {
            // 🌟 ĐÃ SỬA: Hiện rõ thông báo Đúng/Sai trực diện và lưu điểm riêng
            if (chosen === currentQuiz.ans) {
                quizScore += 50; // Điểm lưu riêng vào mảng quizScore
                playSound('correct');
                quizFeedback = "🎉 ĐÚNG RỒI! BẠN ĐƯỢC TÍNH +50Đ THƯỞNG KHI KẾT THÚC";
            } else {
                playSound('wrong');
                quizFeedback = "😟 SAI RỒI! HÃY CHÚ Ý PHÂN LOẠI KỸ HƠN NHÉ EL";
            }
            quizFeedbackTimer = 110; // Đợi khoảng 2 giây cho học sinh đọc phản hồi rồi mới chuyển màn hình
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
