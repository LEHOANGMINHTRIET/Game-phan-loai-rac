const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const lightningEffect = document.getElementById('lightningEffect');

// --- HỆ THỐNG TRẠNG THÁI GAME & PHÂN CẤP ĐỘ ---
let score = 0;
let lives = 3;
let currentLevel = 1;
let gameOver = false;
let gameStarted = false;
let levelUpTimer = 0; // Bộ đếm thời gian hiển thị chữ Thắng Cấp
// --- ĐỒ HỌA BỐI CẢNH ĐỘNG (Hiệu ứng mây trôi) ---
let clouds = [
    { x: 50, y: 100, speed: 0.3, size: 30 },
    { x: 300, y: 140, speed: 0.2, size: 45 },
    { x: 500, y: 80, speed: 0.4, size: 25 }
];

// --- HỆ THỐNG HIỆU ỨNG HẠT NỔ (Particle System) ---
let particles = [];
function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8, // Vận tốc bay ngang ngẫu nhiên
            vy: (Math.random() - 0.5) * 8, // Vận tốc bay dọc ngẫu nhiên
            radius: Math.random() * 4 + 2,
            alpha: 1, // Độ đậm nhạt giảm dần theo thời gian
            color: color
        });
    }
}

// --- HỆ THỐNG ÂM THANH LẬP TRÌNH THUẦN (Web Audio API) ---
// Tự động tạo âm thanh từ tần số sóng, không cần tải file mp3 bên ngoài bên ngoài
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // Nốt Đô
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); // Lên nốt La vui tươi
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'wrong') {
        osc.type = 'sawtooth'; // Tiếng rè rè báo lỗi
        osc.frequency.setValueAtTime(180, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(90, audioCtx.currentTime + 0.25);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start(); osc.stop(audioCtx.currentTime + 0.25);
    } else if (type === 'levelup') {
        // Chuỗi âm thanh chúc mừng thắng cấp
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    }
}

// --- DỮ LIỆU THÙNG RÁC VÀ ĐỐI TƯỢNG RÁC ---
const bins = [
    { id: 'organic', name: 'HỮU CƠ', color: '#2ecc71', x: 30, y: 500, w: 150, h: 80 },
    { id: 'recyclable', name: 'TÁI CHẾ', color: '#3498db', x: 225, y: 500, w: 150, h: 80 },
    { id: 'hazardous', name: 'NGUY HẠI', color: '#e74c3c', x: 420, y: 500, w: 150, h: 80 }
];

const itemPool = [
    { text: '🍏', type: 'organic', name: 'Táo thừa' },
    { text: '🍌', type: 'organic', name: 'Vỏ chuối' },
    { text: '🍂', type: 'organic', name: 'Lá cây khô' },
    { text: '🥤', type: 'recyclable', name: 'Chai nhựa' },
    { text: '📦', type: 'recyclable', name: 'Hộp giấy' },
    { text: '🥫', type: 'recyclable', name: 'Lon nước' },
    { text: '🔋', type: 'hazardous', name: 'Pin cũ' },
    { text: '💡', type: 'hazardous', name: 'Bóng đèn hỏng' },
    { text: '😷', type: 'hazardous', name: 'Khẩu trang bẩn' }
];

let currentItem = null;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let feedbackText = ""; let feedbackColor = ""; let feedbackTimer = 0;

function showFeedback(text, color) {
    feedbackText = text; feedbackColor = color; feedbackTimer = 40;
}

function spawnNewItem() {
    const template = itemPool[Math.floor(Math.random() * itemPool.length)];
    currentItem = {
        text: template.text,
        type: template.type,
        name: template.name,
        x: Math.random() * 340 + 130,
        y: 70,
        angle: Math.random() * 100 // Phục vụ hiệu ứng lượn sóng ở cấp độ khó
    };
}

// --- THUẬT TOÁN ĐIỀU KHIỂN CẤP ĐỘ KHÓ TRÒ CHƠI ---
function checkLevelUp() {
    let targetLevel = 1;
    if (score >= 120) targetLevel = 3;      // Đạt trên 120 điểm sang Cấp 3 (Siêu khó)
    else if (score >= 50) targetLevel = 2;  // Đạt trên 50 điểm sang Cấp 2 (Trung bình)

    if (targetLevel !== currentLevel) {
        currentLevel = targetLevel;
        levelUpTimer = 90; // Kích hoạt hiển thị màn hình chúc mừng trong 90 khung hình
        playSound('levelup');
    }
}

// --- LẮP ĐẶT HỆ THỐNG SỰ KIỆN CHUỘT & CẢM ỨNG ---
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
        return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function handleStart(e) {
    initAudio(); // Kích hoạt hệ thống âm thanh khi người dùng chạm tay vào màn hình lần đầu
    if (gameOver || !gameStarted) return;
    const pos = getMousePos(e);
    if (currentItem) {
        const dist = Math.hypot(pos.x - currentItem.x, pos.y - currentItem.y);
        if (dist < 40) {
            isDragging = true;
            dragOffsetX = pos.x - currentItem.x;
            dragOffsetY = pos.y - currentItem.y;
            if (e.cancelable) e.preventDefault();
        }
    }
}

function handleMove(e) {
    if (!isDragging || !currentItem) return;
    const pos = getMousePos(e);
    currentItem.x = pos.x - dragOffsetX;
    currentItem.y = pos.y - dragOffsetY;
    if (e.cancelable) e.preventDefault();
}

function handleRelease() {
    if (!isDragging) return;
    isDragging = false;
    let isSorted = false;

    for (let bin of bins) {
        if (currentItem.x > bin.x && currentItem.x < bin.x + bin.w &&
            currentItem.y > bin.y && currentItem.y < bin.y + bin.h) {
            
            if (currentItem.type === bin.id) {
                score += 10;
                createExplosion(currentItem.x, currentItem.y, bin.color); // Pháo hoa hạt màu bung nổ
                playSound('correct');
                showFeedback("+10 Chính Xác! 🎉", "#2ecc71");
                checkLevelUp();
            } else {
                score = Math.max(0, score - 5);
                lives--;
                playSound('wrong');
                showFeedback("-5 Nhầm Thùng Rồi! ❌", "#e74c3c");
            }
            isSorted = true;
            break;
        }
    }

    if (isSorted) {
        if (lives <= 0) gameOver = true;
        else spawnNewItem();
    }
}

canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('mouseup', handleRelease);
canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
canvas.addEventListener('touchend', handleRelease);

canvas.addEventListener('click', (e) => {
    const pos = getMousePos(e);
    if (!gameStarted) {
        if (pos.x >= 220 && pos.x <= 380 && pos.y >= 340 && pos.y <= 390) {
            gameStarted = true; score = 0; lives = 3; currentLevel = 1; gameOver = false; spawnNewItem();
        }
    } else if (gameOver) {
        if (pos.x >= 220 && pos.x <= 380 && pos.y >= 370 && pos.y <= 420) {
            gameOver = false; score = 0; lives = 3; currentLevel = 1; spawnNewItem();
        }
    }
});

// --- VÒNG LẶP ĐỒ HỌA GAME LOOP ---
function gameLoop() {
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

    // 1. QUẢN LÝ ĐỒ HỌA BỐI CẢNH THEO 5 CẤP ĐỘ KHÁC NHAU
    let skyGrad = ctx.createLinearGradient(0, 0, 0, V_HEIGHT);
    if (currentLevel === 1) { skyGrad.addColorStop(0, '#dff9fb'); skyGrad.addColorStop(1, '#ffffff'); }
    else if (currentLevel === 2) { skyGrad.addColorStop(0, '#e0f7fa'); skyGrad.addColorStop(1, '#ffffff'); }
    else if (currentLevel === 3) { skyGrad.addColorStop(0, '#fff9c4'); skyGrad.addColorStop(1, '#ffffff'); }
    else if (currentLevel === 4) { skyGrad.addColorStop(0, '#fdebd0'); skyGrad.addColorStop(1, '#ffffff'); }
    else { 
        // ⛈️ BỐI CẢNH CẤP 5: ĐÊM GIÔNG BÃO CAO NGUYÊN
        skyGrad.addColorStop(0, '#34495e'); 
        skyGrad.addColorStop(1, '#2c3e50'); 

        // ⚡ HIỆU ỨNG KÍCH HOẠT CHỚP SÉT NGẪU NHIÊN CHUYÊN NGHIỆP
        if (Math.random() < 0.004) { 
            lightningEffect.classList.remove('lightning-active');
            void lightningEffect.offsetWidth; // Mẹo ép trình duyệt tải lại (reset) CSS Animation
            lightningEffect.classList.add('lightning-active');
        }
    }
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // Xử lý vẽ đám mây trôi (Cấp 5 mây chuyển sang màu giông bão xám xịt và bay siêu tốc)
    ctx.fillStyle = currentLevel === 5 ? "rgba(100, 110, 120, 0.8)" : "rgba(255, 255, 255, 0.9)";
    clouds.forEach(cloud => {
        cloud.x += cloud.speed * (currentLevel * 1.2);
        if (cloud.x - 50 > V_WIDTH) cloud.x = -50;
        ctx.beginPath(); ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size*0.6, cloud.y - cloud.size*0.4, cloud.size*0.8, 0, Math.PI * 2);
        ctx.fill();
    });

    // Thảm cỏ đáy (Cấp 5 thảm cỏ chuyển sang màu úa tối cho hợp bối cảnh)
    ctx.fillStyle = currentLevel === 5 ? "#1e824c" : "#27ae60"; 
    ctx.fillRect(0, 520, V_WIDTH, 130);

    // MÀN HÌNH MENU CHÚ THÍCH 5 CẤP ĐỘ
    if (showIntro) {
        ctx.fillStyle = "#1b5e20"; ctx.font = "bold 23px Arial"; ctx.textAlign = "center";
        ctx.fillText("HÀNH TRÌNH XANH LÂM ĐỒNG - BẢN 5.0", V_WIDTH / 2, 110);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.88)"; ctx.fillRect(35, 150, 530, 340);
        ctx.lineWidth = 2; ctx.strokeStyle = "#27ae60"; ctx.strokeRect(35, 150, 530, 340);

        ctx.fillStyle = "#2c3e50"; ctx.font = "14px Arial"; ctx.textAlign = "left";
        let lines = [
            "🎮 Luật chơi: Kéo thả rác đang rơi vào đúng thùng phân loại.",
            "🎵 Tính năng mới: Tích hợp âm thanh và nhạc nền sống động trực tiếp.",
            "📊 Thử thách nâng cấp 5 Vòng Chơi Chuyên Sâu:",
            "• Cấp 1 (0đ+): rác rơi chậm, hiện chữ hướng dẫn và nhạc nền nhẹ.",
            "• Cấp 2 (40đ+): Tốc độ rơi tăng 50%, kiểm tra phản xạ nhanh.",
            "• Cấp 3 (90đ+): Ẩn chữ hướng dẫn, rác rơi lượn sóng do gió thổi.",
            "• Cấp 4 (150đ+): Xuất hiện THÙNG RÁC LÂY NHIỄM (Vàng y tế).",
            "• Cấp 5 (250đ+): VÒNG SIÊU CẤP - ĐÊM GIÔNG BÃO ĐỔI VỊ TRÍ THÙNG & NHẠC DỒN DẬP!"
        ];
        lines.forEach((line, idx) => ctx.fillText(line, 50, 185 + idx * 28));

        ctx.fillStyle = "#2ecc71"; ctx.fillRect(200, 520, 200, 50);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center";
        ctx.fillText("BẮT ĐẦU THỬ THÁCH", V_WIDTH / 2, 552);
        requestAnimationFrame(gameLoop); return;
    }

    // MÀN HÌNH GAME OVER
    if (gameOver) {
        ctx.fillStyle = currentLevel === 5 ? "#ffffff" : "#e74c3c"; 
        ctx.font = "bold 34px Arial"; ctx.textAlign = "center";
        ctx.fillText("TRÒ CHƠI KẾT THÚC", V_WIDTH / 2, 240);
        ctx.fillStyle = currentLevel === 5 ? "#bdc3c7" : "#2c3e50"; ctx.font = "bold 20px Arial";
        ctx.fillText("Điểm số của em: " + score + " Điểm", V_WIDTH / 2, 300);
        
        ctx.fillStyle = "#3498db"; ctx.fillRect(220, 380, 160, 50);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px Arial"; ctx.fillText("CHƠI LẠI", V_WIDTH / 2, 412);
        requestAnimationFrame(gameLoop); return;
    }

    // 2. HIỂN THỊ CHỈ SỐ (HUD)
    ctx.fillStyle = currentLevel === 5 ? "#ffffff" : "#2c3e50"; 
    ctx.font = "bold 16px Arial"; ctx.textAlign = "left";
    ctx.fillText("🏆 ĐIỂM: " + score, 25, 40);
    ctx.fillText("⚡ CẤP ĐỘ: " + currentLevel + (currentLevel === 5 ? " (SIÊU CẤP ☠️)" : ""), 25, 65);
    ctx.textAlign = "right"; ctx.fillText("MẠNG: " + "❤️".repeat(lives), V_WIDTH - 25, 40);

    // 3. VẼ CÁC THÙNG RÁC THEO MẢNG THUẬT TOÁN ĐÃ ĐƯỢC ĐIỀU CHỈNH
    bins.forEach(bin => {
        ctx.fillStyle = bin.color; ctx.fillRect(bin.x, bin.y, bin.w, bin.h);
        ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(bin.x, bin.y, bin.w, 15);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 13px Arial"; ctx.textAlign = "center";
        ctx.fillText(bin.name, bin.x + bin.w / 2, bin.y + bin.h / 2 + 5);
    });

    // 4. XỬ LÝ ĐIỀU KHIỂN LOGIC VẬT PHẨM RÁC ĐANG RƠI
    if (currentItem) {
        if (!isDragging) {
            // Tốc độ lũy tiến theo cấp độ khó
            let baseSpeed = 1.3 + (currentLevel * 0.9);
            if (currentLevel === 5) baseSpeed = 6.5; // Tốc độ rơi cực nhanh ở vòng cuối
            currentItem.y += baseSpeed;

            // XỬ LÝ QUỸ ĐẠO RƠI PHỨC TẠP CỦA CÁC CẤP ĐỘ KHÓ
            if (currentLevel === 3 || currentLevel === 4) {
                currentItem.angle += 0.06; currentItem.x += Math.sin(currentItem.angle) * 1.8;
            } else if (currentLevel === 5) {
                // Thuật toán cấp 5: Kết hợp dao động hình sin + lực giật gió đổi hướng ngẫu nhiên liên tục
                currentItem.angle += 0.12; 
                currentItem.x += Math.sin(currentItem.angle) * 3.5 + currentItem.windShift;
            }

            // Giới hạn không cho rác lượn ra ngoài rìa khung hình Canvas
            if (currentItem.x < 30) currentItem.x = 30;
            if (currentItem.x > V_WIDTH - 30) currentItem.x = V_WIDTH - 30;

            if (currentItem.y > 540) {
                lives--; playSound('wrong'); showFeedback("Lọt rác mất rồi! -1 Mạng 😟", "#e67e22");
                if (lives <= 0) gameOver = true; else spawnNewItem();
            }
        }

        ctx.save(); ctx.font = "44px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(currentItem.text, currentItem.x, currentItem.y);
        
        // Chỉ hiện tên gợi ý chữ Tiếng Việt ở Cấp 1 và Cấp 2
        if (currentLevel <= 2) {
            ctx.font = "bold 11px Arial"; ctx.fillStyle = "#34495e";
            ctx.fillText(currentItem.name, currentItem.x, currentItem.y - 32);
        }
        ctx.restore();
    } else {
        spawnNewItem();
    }

    // 5. HIỆU ỨNG VẬT LÝ PHÁO HOA HẠT NỔ (PARTICLE SYSTEM)
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.alpha -= 0.025;
        if (p.alpha <= 0) { particles.splice(i, 1); } 
        else {
            ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
    }

    // 6. HIỂN THỊ CHỮ PHẢN HỒI VÀ THÔNG BÁO LÊN CẤP MỚI
    if (feedbackTimer > 0) {
        ctx.fillStyle = feedbackColor; ctx.font = "bold 18px Arial"; ctx.textAlign = "center";
        ctx.fillText(feedbackText, V_WIDTH / 2, 110); feedbackTimer--;
    }

    if (levelUpTimer > 0) {
        ctx.fillStyle = currentLevel === 5 ? "rgba(241, 196, 15, " + Math.min(1, levelUpTimer / 30) + ")" : "rgba(27, 94, 32, " + Math.min(1, levelUpTimer / 30) + ")";
        ctx.font = "bold 28px Arial"; ctx.textAlign = "center";
        ctx.fillText("🌟 VÒNG KHÓ CẤP " + currentLevel + " BẮT ĐẦU 🌟", V_WIDTH / 2, 320);
        ctx.font = "bold 14px Arial";
        if (currentLevel === 3) ctx.fillText("Hiệu ứng Gió lượn xuất hiện & Ẩn hoàn toàn tên rác!", V_WIDTH / 2, 355);
        if (currentLevel === 4) ctx.fillText("Nguy hiểm: Mở khóa Thùng rác Lây nhiễm màu Vàng!", V_WIDTH / 2, 355);
        if (currentLevel === 5) ctx.fillText("CẢNH BÁO: Tốc độ tối đa! Nhạc nền dồn dập & Thùng rác xáo trộn liên tục!", V_WIDTH / 2, 355);
        levelUpTimer--;
    }

    requestAnimationFrame(gameLoop);
}

// Bật chạy vòng lặp game
gameLoop();
