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
let lives = 3;
let health = 100; // Thanh máu hao dần (0 - 100%)
let currentLevel = 1;
let gameOver = false;
let gameStarted = false;
let showIntro = true;
let levelUpTimer = 0;

// Trạng thái cho chế độ câu hỏi trắc nghiệm phụ giữa các cấp độ
let inQuizMode = false;
let currentQuiz = null;

let clouds = [
    { x: 40, y: 80, speed: 0.25, size: 25 },
    { x: 220, y: 120, speed: 0.15, size: 35 }
];

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
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        
        setInterval(() => {
            if (audioCtx && gameStarted && !gameOver && !inQuizMode) {
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
    if (!audioCtx) return;
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

// --- 📦 KHO DỮ LIỆU RÁC THẢI ĐỒ SỘ (GẦN 40 LOẠI) ---
const trashData = [
    { text: "🍏", name: "Táo cắn dở", type: "organic" },
    { text: "Banana", text: "🍌", name: "Vỏ chuối chín", type: "organic" },
    { text: "🍉", name: "Vỏ dưa hấu", type: "organic" },
    { text: "🪵", name: "Củi khô", type: "organic" },
    { text: "🥀", name: "Hoa héo", type: "organic" },
    { text: "🍃", name: "Lá chè hỏng", type: "organic" },
    { text: "🥚", name: "Vỏ trứng", type: "organic" },
    { text: "🦴", name: "Xương gà", type: "organic" },
    { text: "🫘", name: "Hạt ngô thối", type: "organic" },
    { text: "🥖", name: "Bánh mì mốc", type: "organic" },

    { text: "📦", name: "Hộp giấy vụn", type: "recyclable" },
    { text: "🍾", name: "Chai thủy tinh", type: "recyclable" },
    { text: "🥫", name: "Vỏ lon nước", type: "recyclable" },
    { text: "🥤", name: "Cốc trà sữa", type: "recyclable" },
    { text: "📰", name: "Sách báo cũ", type: "recyclable" },
    { text: "✏️", name: "Thước nhựa hỏng", type: "recyclable" },
    { text: "📎", name: "Ghim kẹp sắt", type: "recyclable" },
    { text: "🥛", name: "Vỏ hộp sữa", type: "recyclable" },
    { text: "⚙️", name: "Bánh răng sắt", type: "recyclable" },

    { text: "🛍️", name: "Túi nilon rách", type: "residual" },
    { text: "🚬", name: "Tàn thuốc lá", type: "residual" },
    { text: "🪞", name: "Mảnh gương vỡ", type: "residual" },
    { text: "🥣", name: "Bát sứ mẻ", type: "residual" },
    { text: "👟", name: "Giày vải rách", type: "residual" },
    { text: "🧻", name: "Giấy ăn đã dùng", type: "residual" },
    { text: "🪵", name: "Bút chì gãy", type: "residual" },
    { text: "🎈", name: "Xác bóng bay", type: "residual" },
    { text: "🪵", name: "Túi bánh kẹo", type: "residual" },

    { text: "🔋", name: "Cục Pin hỏng", type: "medical" },
    { text: "💉", name: "Kim tiêm y tế", type: "medical" },
    { text: "😷", name: "Khẩu trang bẩn", type: "medical" },
    { text: "🌡️", name: "Nhiệt kế vỡ", type: "medical" },
    { text: "🧪", name: "Lọ hóa chất", type: "medical" },
    { text: "💡", name: "Bóng đèn hỏng", type: "medical" },
    { text: "💊", name: "Thuốc hết hạn", type: "medical" },
    { text: "🩹", name: "Băng gạc cũ", type: "medical" }
];

// --- ❓ NGÂN HÀNG CÂU HỎI TRẮC NGHIỆM THƯỞNG ĐIỂM KHI LÊN CẤP ---
const quizBank = {
    2: {
        q: "Rác hữu cơ sau khi phân loại nên được xử lý thế nào?",
        a: "A. Thiêu hủy đốt bỏ", b: "B. Ủ làm phân bón hữu cơ sinh học", c: "C. Chôn lấp vô thời hạn", ans: "b"
    },
    3: {
        q: "Hành động nào giúp tái chế rác thải giấy hiệu quả nhất?",
        a: "A. Gom bán ve chai, đưa về nhà máy giấy tái chế", b: "B. Vứt chung với rác nilon", c: "C. Đốt để sưởi ấm", ans: "a"
    },
    4: {
        q: "Tại sao không được vứt gộp Pin cũ chung với rác thải Vô cơ thông thường?",
        a: "A. Vì Pin quá nặng", b: "B. Rò rỉ kim loại nặng gây ô nhiễm đất, nguồn nước", c: "C. Gây tốn diện tích chôn", ans: "b"
    },
    5: {
        q: "Biện pháp xử lý tối ưu nhất đối với rác thải y tế lây nhiễm độc hại là gì?",
        a: "A. Rửa sạch tái sử dụng công cộng", b: "B. Đốt trong lò thiêu chuyên dụng nhiệt độ cao", c: "C. Đổ ra sông suối tự nhiên", ans: "b"
    }
};

let bins = [
    { id: "organic", name: "HỮU CƠ", color1: "#2ecc71", color2: "#27ae60", x: 0, y: 595, w: 92, h: 80 },
    { id: "recyclable", name: "TÁI CHẾ", color1: "#3498db", color2: "#2980b9", x: 0, y: 595, w: 92, h: 80 },
    { id: "residual", name: "VÔ CƠ", color1: "#95a5a6", color2: "#7f8c8d", x: 0, y: 595, w: 92, h: 80 },
    { id: "medical", name: "ĐỘC HẠI", color1: "#e67e22", color2: "#d35400", x: 0, y: 595, w: 92, h: 80 }
];

// Mảng quản lý nhiều loại rác rơi đồng thời
let fallingItems = [];
let draggingItem = null;
let particles = [];

let feedbackText = ""; let feedbackColor = ""; let feedbackTimer = 0;
function showFeedback(text, color) {
    feedbackText = text; feedbackColor = color; feedbackTimer = 40;
}

// Hàm khởi sinh rác rơi ngẫu nhiên so le
function spawnItem() {
    let availableItems = trashData;
    if (currentLevel < 4) {
        availableItems = trashData.filter(item => item.type !== 'medical');
    }
    let raw = availableItems[Math.floor(Math.random() * availableItems.length)];
    
    fallingItems.push({
        id: Math.random(),
        text: raw.text, name: raw.name, type: raw.type,
        x: Math.random() * (V_WIDTH - 120) + 60,
        y: -50 - (Math.random() * 100), // Tạo độ lệch so le chiều cao khi xuất hiện cùng lúc
        angle: Math.random() * 5,
        windShift: (Math.random() - 0.5) * 2.5
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
}

function checkLevelProgress() {
    let newLevel = 1;
    if (score >= 250) newLevel = 5;
    else if (score >= 150) newLevel = 4;
    else if (score >= 90) newLevel = 3;
    else if (score >= 40) newLevel = 2;

    if (newLevel !== currentLevel) {
        currentLevel = newLevel;
        levelUpTimer = 80;
        playSound('levelup');
        rearrangeBins();
        fallingItems = []; // Dọn sạch rác cũ để chuẩn bị vào vòng mới
        triggerQuiz(currentLevel); // Kích hoạt minigame trắc nghiệm
    }
}

// Xử lý khi người chơi bị trừ máu (Giảm thanh máu, nếu hết máu mới mất 1 mạng)
function decreaseHealth(amount) {
    health -= amount;
    if (health <= 0) {
        lives--;
        health = 100; // Reset thanh máu mới cho mạng tiếp theo
        if (lives <= 0) gameOver = true;
    }
}

// --- VÒNG LẶP ĐỒ HỌA CHÍNH GAME LOOP ---
function gameLoop() {
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

    // 1. QUẢN LÝ MÀU SẮC NỀN TRỜI (Tối ưu tương phản trung tính)
    let skyGrad = ctx.createLinearGradient(0, 0, 0, V_HEIGHT);
    if (currentLevel === 1) { skyGrad.addColorStop(0, '#2c3e50'); skyGrad.addColorStop(1, '#34495e'); }
    else if (currentLevel === 2) { skyGrad.addColorStop(0, '#243342'); skyGrad.addColorStop(1, '#2c3e50'); }
    else if (currentLevel === 3) { skyGrad.addColorStop(0, '#1c2833'); skyGrad.addColorStop(1, '#243342'); }
    else if (currentLevel === 4) { skyGrad.addColorStop(0, '#16202c'); skyGrad.addColorStop(1, '#1c2833'); }
    else { 
        skyGrad.addColorStop(0, '#0e1720'); skyGrad.addColorStop(1, '#111a24'); 
        if (lightningEffect && Math.random() < 0.006) { 
            lightningEffect.classList.remove('lightning-active');
            void lightningEffect.offsetWidth; lightningEffect.classList.add('lightning-active');
        }
    }
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // Vẽ mây trôi nền
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    clouds.forEach(c => {
        c.x += c.speed; if (c.x - 40 > V_WIDTH) c.x = -40;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2); ctx.fill();
    });

    // Thảm cỏ đáy nền
    ctx.fillStyle = "#1e824c"; ctx.fillRect(0, 580, V_WIDTH, 120);

    // MÀN HÌNH CHÚ THÍCH BAN ĐẦU
    if (showIntro) {
        ctx.fillStyle = "#2ecc71"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
        ctx.fillText("HÀNH TRÌNH XANH LÂM ĐỒNG - BẢN 6.0", V_WIDTH / 2, 90);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)"; ctx.fillRect(25, 130, 430, 360);
        ctx.lineWidth = 2; ctx.strokeStyle = "#2ecc71"; ctx.strokeRect(25, 130, 430, 360);

        ctx.fillStyle = "#2c3e50"; ctx.font = "13px Arial"; ctx.textAlign = "left";
        let lines = [
            "🎮 Luật mới: Nhiều loại rác sẽ xuất hiện rơi cùng một lúc.",
            "🏷️ Xuyên suốt: Mọi cấp độ đều sẽ hiện rõ chữ tên loại rác.",
            "⏳ Tính năng: Thêm áp lực thời gian rơi & Cơ chế thanh máu HP.",
            "❤️ Đời sống: Sai 1 lần chỉ hao máu, hết thanh máu mới mất mạng.",
            "❓ Minigame: Mỗi khi lên cấp sẽ có câu hỏi trắc nghiệm +50đ.",
            "📊 Khung điểm thăng cấp bậc thử thách:",
            "• Cấp 1: Rác rơi thong thả | Cấp 2: Tăng tốc độ rơi 50%",
            "• Cấp 3: Hiệu ứng gió lượn sóng | Cấp 4: Mở thùng rác ĐỘC HẠI",
            "• Cấp 5: SIÊU KHÓ ĐÊM GIÔNG BÃO ĐẢO VỊ TRÍ THÙNG RÁC!"
        ];
        lines.forEach((line, idx) => ctx.fillText(line, 40, 165 + idx * 28));

        ctx.fillStyle = "#2ecc71"; ctx.fillRect(140, 515, 200, 46);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "center";
        ctx.fillText("BẮT ĐẦU THỬ THÁCH", V_WIDTH / 2, 543);
        requestAnimationFrame(gameLoop); return;
    }

    // GIAO DIỆN MÀN HÌNH CÂU HỎI TRẮC NGHIỆM PHỤ TĂNG ĐIỂM
    if (inQuizMode && currentQuiz) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)"; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);
        ctx.fillStyle = "#f1c40f"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
        ctx.fillText("🌟 THỬ THÁCH KIẾN THỨC MÔI TRƯỜNG 🌟", V_WIDTH / 2, 120);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 15px Arial";
        
        // Vẽ câu hỏi tự động xuống dòng
        ctx.fillText(currentQuiz.q, V_WIDTH / 2, 180);

        // Vẽ 3 ô đáp án A, B, C để học sinh bấm chọn
        let opts = [
            { id: "a", text: currentQuiz.a, y: 260 },
            { id: "b", text: currentQuiz.b, y: 330 },
            { id: "c", text: currentQuiz.c, y: 400 }
        ];

        opts.forEach(opt => {
            ctx.fillStyle = "#34495e"; ctx.fillRect(40, opt.y, 400, 50);
            ctx.lineWidth = 1; ctx.strokeStyle = "#ffffff"; ctx.strokeRect(40, opt.y, 400, 50);
            ctx.fillStyle = "#ffffff"; ctx.font = "14px Arial"; ctx.textAlign = "left";
            ctx.fillText(opt.text, 60, opt.y + 30);
        });

        requestAnimationFrame(gameLoop); return;
    }

    // MÀN HÌNH GAME OVER
    if (gameOver) {
        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 32px Arial"; ctx.textAlign = "center";
        ctx.fillText("TRÒ CHƠI KẾT THÚC", V_WIDTH / 2, 250);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 18px Arial";
        ctx.fillText("Tổng điểm đạt được: " + score + " Điểm", V_WIDTH / 2, 300);
        ctx.fillStyle = "#3498db"; ctx.fillRect(160, 370, 160, 46);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 15px Arial"; ctx.fillText("CHƠI LẠI", V_WIDTH / 2, 398);
        requestAnimationFrame(gameLoop); return;
    }

    // 2. HIỂN THỊ CHỈ SỐ HUD VÀ THANH MÁU (HP BAR)
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 14px Arial"; ctx.textAlign = "left";
    ctx.fillText("🏆 ĐIỂM: " + score, 20, 35);
    ctx.fillText("⚡ CẤP ĐỘ: " + currentLevel, 20, 58);
    ctx.textAlign = "right"; ctx.fillText("MẠNG: " + "❤️".repeat(lives), V_WIDTH - 20, 35);
    
    // Vẽ khung thanh máu trực quan sinh động
    ctx.textAlign = "left"; ctx.fillText("HP: ", 250, 58);
    ctx.fillStyle = "#7f8c8d"; ctx.fillRect(285, 47, 170, 14);
    ctx.fillStyle = health > 30 ? "#2ecc71" : "#e74c3c"; // Ít máu chuyển màu đỏ cảnh báo
    ctx.fillRect(285, 47, (health / 100) * 170, 14);

    // 3. VẼ HỆ THỐNG THÙNG RÁC CĂN ĐỀU 3D
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

    // 4. QUẢN LÝ ĐIỀU PHỐI SỐ LƯỢNG RÁC XUẤT HIỆN SONG SONG GIỮA CÁC VÒNG
    let maxItemsOnScreen = 1;
    if (currentLevel === 2) maxItemsOnScreen = 2;
    if (currentLevel === 3) maxItemsOnScreen = 2;
    if (currentLevel >= 4) maxItemsOnScreen = 3; // Cấp 4 và 5 rớt đồng thời 3 cái so le

    if (fallingItems.length < maxItemsOnScreen && Math.random() < 0.02) {
        spawnItem();
    }

    // VÒNG LẶP XỬ LÝ DI CHUYỂN VÀ VẼ TỪNG LOẠI RÁC ĐANG RƠI
    for (let i = fallingItems.length - 1; i >= 0; i--) {
        let item = fallingItems[i];

        if (draggingItem && draggingItem.id === item.id) {
            // Đang bị kéo thả thì cập nhật theo tọa độ tay người chơi
        } else {
            // Tốc độ rơi vật lý tịnh tiến
            let fallSpeed = 1.1 + (currentLevel * 0.7);
            if (currentLevel === 5) fallSpeed = 5.2;
            item.y += fallSpeed;

            // Quỹ đạo bay nâng cao
            if (currentLevel === 3 || currentLevel === 4) {
                item.angle += 0.05; item.x += Math.sin(item.angle) * 1.5;
            } else if (currentLevel === 5) {
                item.angle += 0.09; item.x += Math.sin(item.angle) * 3.0 + item.windShift;
            }

            if (item.x < 25) item.x = 25;
            if (item.x > V_WIDTH - 25) item.x = V_WIDTH - 25;

            // Để lọt rác chạm đất sẽ bị trừ một lượng máu nhất định
            if (item.y > 580) {
                decreaseHealth(15); // Hao 15% thanh máu
                playSound('wrong'); showFeedback("Lọt rác mất rồi! Hao máu 😟", "#e67e22");
                fallingItems.splice(i, 1); continue;
            }
        }

        // Thực hiện vẽ đồ họa rác (Phóng to kích cỡ lên 55px bắt mắt)
        ctx.save(); ctx.font = "55px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(item.text, item.x, item.y);
        
        // HIỂN THỊ CHỮ TÊN RÁC TRỰC QUAN XUYÊN SUỐT MỌI CẤP ĐỘ
        ctx.font = "bold 12px Arial"; ctx.fillStyle = "#ffffff"; // Đổi chữ màu trắng để nổi bật trên nền tối
        ctx.fillText(item.name, item.x, item.y - 36);
        ctx.restore();
    }

    // 5. HIỆU ỨNG HẠT PHÁO HOA NỔ NỀN
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.03;
        if (p.alpha <= 0) { particles.splice(i, 1); } 
        else {
            ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
    }

    // 6. CHỮ PHẢN HỒI NHANH VÀ LÊN CẤP
    if (feedbackTimer > 0) {
        ctx.fillStyle = feedbackColor; ctx.font = "bold 16px Arial"; ctx.textAlign = "center";
        ctx.fillText(feedbackText, V_WIDTH / 2, 135); feedbackTimer--;
    }

    if (levelUpTimer > 0) {
        ctx.fillStyle = "#f1c40f"; ctx.font = "bold 22px Arial"; ctx.textAlign = "center";
        ctx.fillText("🌟 VÒNG KHÓ CẤP " + currentLevel + " BẮT ĐẦU 🌟", V_WIDTH / 2, 320);
        levelUpTimer--;
    }

    requestAnimationFrame(gameLoop);
}

// --- THAO TÁC ĐIỀU KHIỂN CHUỘT / CẢM ỨNG DI ĐỘNG ---
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

    // Click ở màn hình hướng dẫn ban đầu
    if (showIntro) {
        if (pos.x >= 140 && pos.x <= 340 && pos.y >= 515 && pos.y <= 561) {
            showIntro = false; gameStarted = true; score = 0; lives = 3; health = 100; currentLevel = 1;
            rearrangeBins(); spawnItem();
        }
        return;
    }

    // Click chọn câu trả lời ở màn hình trắc nghiệm phụ
    if (inQuizMode && currentQuiz) {
        let chosen = null;
        if (pos.x >= 40 && pos.x <= 440) {
            if (pos.y >= 260 && pos.y <= 310) chosen = "a";
            if (pos.y >= 330 && pos.y <= 380) chosen = "b";
            if (pos.y >= 400 && pos.y <= 450) chosen = "c";
        }
        if (chosen) {
            if (chosen === currentQuiz.ans) {
                score += 50; playSound('correct'); showFeedback("Xuất sắc! Trả lời đúng +50 Điểm Thưởng 🎁", "#2ecc71");
            } else {
                playSound('wrong'); showFeedback("Chưa chính xác rồi em ơi! 😟", "#e74c3c");
            }
            // Kết thúc chế độ trắc nghiệm, quay lại chơi tiếp game chính
            inQuizMode = false; currentQuiz = null;
        }
        return;
    }

    // Click ở màn hình Game Over
    if (gameOver) {
        if (pos.x >= 160 && pos.x <= 320 && pos.y >= 370 && pos.y <= 416) {
            gameOver = false; score = 0; lives = 3; health = 100; currentLevel = 1; fallingItems = [];
            rearrangeBins(); spawnItem();
        }
        return;
    }

    // Tìm xem người dùng nhấn trúng vật phẩm rác nào trong danh sách đang rơi
    for (let i = fallingItems.length - 1; i >= 0; i--) {
        let item = fallingItems[i];
        const dist = Math.hypot(pos.x - item.x, pos.y - item.y);
        if (dist < 42) { // Vùng va chạm tương tác mở rộng theo rác to
            draggingItem = item;
            dragOffsetX = pos.x - item.x; dragOffsetY = pos.y - item.y;
            if (e.cancelable) e.preventDefault();
            break;
        }
    }
}

function handleMove(e) {
    if (!draggingItem) return;
    const pos = getMousePos(e);
    draggingItem.x = pos.x - dragOffsetX; draggingItem.y = pos.y - dragOffsetY;
    if (e.cancelable) e.preventDefault();
}

function handleEnd() {
    if (!draggingItem) return;
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
            createParticles(item.x, item.y, matchedBin.color1);
            showFeedback("Chính xác! +10 Điểm 🎉", "#2ecc71");
            
            // Xóa rác này khỏi mảng rơi
            fallingItems = fallingItems.filter(i => i.id !== item.id);
            checkLevelProgress();
            
            if (currentLevel === 5) {
                bins.sort(() => Math.random() - 0.5); rearrangeBins();
            }
        } else {
            decreaseHealth(15); // Bỏ sai thùng: Hao 15% thanh máu HP
            playSound('wrong'); showFeedback("Nhầm thùng rồi em ơi! 😟", "#e74c3c");
            fallingItems = fallingItems.filter(i => i.id !== item.id);
        }
    }
}

canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);
canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
window.addEventListener('touchend', handleEnd);

rearrangeBins();
requestAnimationFrame(gameLoop);
