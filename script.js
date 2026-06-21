// --- KHỞI TẠO ĐỐI TƯỢNG ĐỒ HỌA VÀ ĐIỀU CHỈNH RESPONSIVE ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('canvas-wrapper');

// Khai báo biến sấm sét toàn cục (sẽ gán phần tử khi người chơi click bắt đầu để tránh lỗi trắng màn hình)
let lightningEffect = null;

const V_WIDTH = 600;
const V_HEIGHT = 650;

function resizeCanvas() {
    const scaleX = wrapper.clientWidth / V_WIDTH;
    const scaleY = wrapper.clientHeight / V_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    
    canvas.width = V_WIDTH * scale;
    canvas.height = V_HEIGHT * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 100);

// --- HỆ THỐNG TRẠNG THÁI GAME & PHÂN CẤP ĐỘ ---
let score = 0;
let lives = 3;
let currentLevel = 1;
let gameOver = false;
let gameStarted = false;
let showIntro = true;
let levelUpTimer = 0;

// --- ĐỒ HỌA BỐI CẢNH ĐỘNG (Hiệu ứng mây trôi) ---
let clouds = [
    { x: 50, y: 100, speed: 0.3, size: 30 },
    { x: 300, y: 140, speed: 0.2, size: 45 },
    { x: 500, y: 80, speed: 0.4, size: 25 }
];

// --- HỆ THỐNG ÂM THANH TÍCH HỢP TRỰC TIẾP (Audio Synthesis) ---
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    try {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'correct') {
            // Âm thanh vui tươi khi phân loại đúng
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            osc.start(); osc.stop(audioCtx.currentTime + 0.2);
        } else if (type === 'wrong') {
            // Âm thanh trầm cảnh báo khi làm sai/lọt rác
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.25);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start(); osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'levelup') {
            // Âm thanh chúc mừng thăng cấp
            osc.type = 'triangle';
            let now = audioCtx.currentTime;
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(554.37, now + 0.1);
            osc.frequency.setValueAtTime(659.25, now + 0.2);
            osc.frequency.setValueAtTime(880, now + 0.3);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start(); osc.stop(now + 0.5);
        }
    } catch (e) { console.log(e); }
}

// --- DỮ LIỆU RÁC THẢI PHÂN LOẠI CHI TIẾT ---
const trashData = [
    { text: "🍏", name: "Rác hữu cơ (Táo)", type: "organic" },
    { text: "🍌", name: "Rác hữu cơ (Chuối)", type: "organic" },
    { text: "🪵", name: "Rác hữu cơ (Củi khô)", type: "organic" },
    { text: "📦", name: "Rác tái chế (Giấy vụn)", type: "recyclable" },
    { text: "🍾", name: "Rác tái chế (Chai thủy tinh)", type: "recyclable" },
    { text: "🥫", name: "Rác tái chế (Vỏ lon)", type: "recyclable" },
    { text: "🔋", name: "Rác còn lại (Pin hỏng)", type: "residual" },
    { text: "🚬", name: "Rác còn lại (Tàn thuốc)", type: "residual" },
    { text: "🪞", name: "Rác còn lại (Mảnh sành)", type: "residual" },
    // Rác y tế lây nhiễm dành cho Cấp độ 4 và 5
    { text: "💉", name: "Rác lây nhiễm (Kim tiêm)", type: "medical" },
    { text: "😷", name: "Rác lây nhiễm (Khẩu trang)", type: "medical" }
];

// --- TOÀN CỤC CẤU TRÚC VỊ TRÍ THÙNG RÁC ---
let bins = [
    { id: "organic", name: "HỮU CƠ", color: "#2e7d32", x: 20, y: 550, w: 120, h: 80 },
    { id: "recyclable", name: "TÁI CHẾ", color: "#1565c0", x: 160, y: 550, w: 120, h: 80 },
    { id: "residual", name: "CÒN LẠI", color: "#424242", x: 300, y: 550, w: 120, h: 80 },
    { id: "medical", name: "LÂY NHIỄM", color: "#f9a825", x: 440, y: 550, w: 120, h: 80 }
];

let currentItem = null;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Hiệu ứng hạt nổ pháo hoa
let particles = [];
function createParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 2,
            radius: Math.random() * 3 + 2,
            color: color,
            alpha: 1
        });
    }
}

// Chữ hiển thị phản hồi nhanh
let feedbackText = "";
let feedbackColor = "";
let feedbackTimer = 0;
function showFeedback(text, color) {
    feedbackText = text; feedbackColor = color; feedbackTimer = 45;
}

// Hàm khởi tạo vật phẩm rác rơi ngẫu nhiên
function spawnNewItem() {
    let availableItems = trashData;
    // Nếu ở Cấp 1, 2, 3: Chưa xuất hiện rác lây nhiễm nguy hiểm
    if (currentLevel < 4) {
        availableItems = trashData.filter(item => item.type !== 'medical');
    }

    let raw = availableItems[Math.floor(Math.random() * availableItems.length)];
    currentItem = {
        text: raw.text,
        name: raw.name,
        type: raw.type,
        x: Math.random() * (V_WIDTH - 160) + 80,
        y: -40,
        angle: Math.random() * 10,
        windShift: (Math.random() - 0.5) * 3.5 // Lực giật gió ngẫu nhiên cho cấp 5
    };
    isDragging = false;
}

// Thuật toán xáo trộn vị trí thùng rác phục vụ Cấp độ 5
function shuffleBins() {
    let currentBins = (currentLevel === 4 || currentLevel === 5) ? 4 : 3;
    let availableWidth = V_WIDTH - 40;
    let spacing = (availableWidth - (currentBins * 120)) / (currentBins - 1);
    
    // Đảo ngẫu nhiên thứ tự mảng bins
    bins.sort(() => Math.random() - 0.5);
    
    // Thiết lập lại tọa độ X dựa theo thứ tự mới đảo
    bins.forEach((bin, index) => {
        bin.x = 20 + index * (120 + spacing);
    });
}

// Hàm cập nhật cấp độ và kiểm tra điều kiện thăng cấp
function checkLevelProgress() {
    let newLevel = 1;
    if (score >= 250) newLevel = 5;
    else if (score >= 150) newLevel = 4;
    else if (score >= 90) newLevel = 3;
    else if (score >= 40) newLevel = 2;

    if (newLevel !== currentLevel) {
        currentLevel = newLevel;
        levelUpTimer = 90; // Kích hoạt chạy chữ thông báo vòng mới
        playSound('levelup');
        
        // Cấp 5 xáo trộn vị trí thùng ngay lập tức khi thăng cấp
        if (currentLevel === 5) {
            shuffleBins();
        }
    }
}

// --- VÒNG LẶP ĐỒ HỌA GAME LOOP ---
function gameLoop() {
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

    // 1. QUẢN LÝ ĐỒ HỌA BỐI CẢNH THEO VÒNG CHƠI
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
        if (lightningEffect && Math.random() < 0.005) { 
            lightningEffect.classList.remove('lightning-active');
            void lightningEffect.offsetWidth; // Mẹo ép trình duyệt tải lại CSS Animation
            lightningEffect.classList.add('lightning-active');
        }
    }
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // Xử lý vẽ đám mây động trôi
    ctx.fillStyle = currentLevel === 5 ? "rgba(100, 110, 120, 0.8)" : "rgba(255, 255, 255, 0.9)";
    clouds.forEach(cloud => {
        cloud.x += cloud.speed * (currentLevel * 1.2);
        if (cloud.x - 50 > V_WIDTH) cloud.x = -50;
        ctx.beginPath(); ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size*0.6, cloud.y - cloud.size*0.4, cloud.size*0.8, 0, Math.PI * 2);
        ctx.fill();
    });

    // Thảm cỏ đáy nền
    ctx.fillStyle = currentLevel === 5 ? "#1e824c" : "#27ae60"; 
    ctx.fillRect(0, 520, V_WIDTH, 130);

    // MÀN HÌNH CHÚ THÍCH HƯỚNG DẪN BAN ĐẦU
    if (showIntro) {
        ctx.fillStyle = "#1b5e20"; ctx.font = "bold 23px Arial"; ctx.textAlign = "center";
        ctx.fillText("HÀNH TRÌNH XANH LÂM ĐỒNG - BẢN 5.0", V_WIDTH / 2, 110);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.92)"; ctx.fillRect(35, 150, 530, 340);
        ctx.lineWidth = 2; ctx.strokeStyle = "#27ae60"; ctx.strokeRect(35, 150, 530, 340);

        ctx.fillStyle = "#2c3e50"; ctx.font = "14px Arial"; ctx.textAlign = "left";
        let lines = [
            "🎮 Luật chơi: Kéo thả rác đang rơi vào đúng thùng phân loại.",
            "🎵 Tính năng mới: Tích hợp hiệu ứng âm thanh sống động.",
            "📊 Thử thách nâng cấp 5 Vòng Chơi Chuyên Sâu:",
            "• Cấp 1 (0đ+): Rác rơi chậm, hiện chữ hướng dẫn.",
            "• Cấp 2 (40đ+): Tốc độ rơi tăng thêm 50%.",
            "• Cấp 3 (90đ+): Gió thổi lượn sóng, ẩn hoàn toàn tên chữ gợi ý.",
            "• Cấp 4 (150đ+): Xuất hiện thêm THÙNG RÁC LÂY NHIỄM (Màu Vàng).",
            "• Cấp 5 (250đ+): ĐÊM GIÔNG BÃO - Thùng rác xáo trộn vị trí ngẫu nhiên!"
        ];
        lines.forEach((line, idx) => ctx.fillText(line, 50, 185 + idx * 28));

        ctx.fillStyle = "#2ecc71"; ctx.fillRect(200, 515, 200, 50);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center";
        ctx.fillText("BẮT ĐẦU THỬ THÁCH", V_WIDTH / 2, 546);
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

    // 2. HIỂN THỊ CHỈ SỐ HUD
    ctx.fillStyle = currentLevel === 5 ? "#ffffff" : "#2c3e50"; 
    ctx.font = "bold 16px Arial"; ctx.textAlign = "left";
    ctx.fillText("🏆 ĐIỂM: " + score, 25, 40);
    ctx.fillText("⚡ CẤP ĐỘ: " + currentLevel + (currentLevel === 5 ? " (SIÊU CẤP ☠️)" : ""), 25, 65);
    ctx.textAlign = "right"; ctx.fillText("MẠNG: " + "❤️".repeat(lives), V_WIDTH - 25, 40);

    // 3. VẼ CÁC THÙNG RÁC (Chỉ hiện 3 thùng ở Cấp 1,2,3; Hiện 4 thùng ở Cấp 4,5)
    let visibleBinsCount = (currentLevel === 4 || currentLevel === 5) ? 4 : 3;
    let activeBins = bins.slice(0, visibleBinsCount);

    activeBins.forEach(bin => {
        ctx.fillStyle = bin.color; ctx.fillRect(bin.x, bin.y, bin.w, bin.h);
        ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(bin.x, bin.y, bin.w, 15);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 13px Arial"; ctx.textAlign = "center";
        ctx.fillText(bin.name, bin.x + bin.w / 2, bin.y + bin.h / 2 + 5);
    });

    // 4. XỬ LÝ LOGIC VẬT PHẨM RÁC RƠI
    if (currentItem) {
        if (!isDragging) {
            let baseSpeed = 1.3 + (currentLevel * 0.9);
            if (currentLevel === 5) baseSpeed = 6.2; 
            currentItem.y += baseSpeed;

            // Xử lý quỹ đạo bay lượn phức tạp theo độ khó
            if (currentLevel === 3 || currentLevel === 4) {
                currentItem.angle += 0.06; currentItem.x += Math.sin(currentItem.angle) * 1.8;
            } else if (currentLevel === 5) {
                currentItem.angle += 0.12; 
                currentItem.x += Math.sin(currentItem.angle) * 3.5 + currentItem.windShift;
            }

            // Giới hạn biên màn hình Canvas
            if (currentItem.x < 30) currentItem.x = 30;
            if (currentItem.x > V_WIDTH - 30) currentItem.x = V_WIDTH - 30;

            // Trừ mạng nếu để rác rơi chạm đất
            if (currentItem.y > 540) {
                lives--; playSound('wrong'); showFeedback("Lọt rác mất rồi! -1 Mạng 😟", "#e67e22");
                if (lives <= 0) gameOver = true; else spawnNewItem();
            }
        }

        ctx.save(); ctx.font = "44px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(currentItem.text, currentItem.x, currentItem.y);
        
        // Chỉ hiện tên gợi ý tiếng Việt ở Cấp 1 và Cấp 2
        if (currentLevel <= 2) {
            ctx.font = "bold 11px Arial"; ctx.fillStyle = "#34495e";
            ctx.fillText(currentItem.name, currentItem.x, currentItem.y - 32);
        }
        ctx.restore();
    } else {
        spawnNewItem();
    }

    // 5. HIỆU ỨNG VẬT LÝ HẠT PHÁO HOA NỔ
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.alpha -= 0.025;
        if (p.alpha <= 0) { particles.splice(i, 1); } 
        else {
            ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
    }

    // 6. HIỂN THỊ CHỮ PHẢN HỒI NHANH VÀ CHỮ LÊN CẤP
    if (feedbackTimer > 0) {
        ctx.fillStyle = feedbackColor; ctx.font = "bold 18px Arial"; ctx.textAlign = "center";
        ctx.fillText(feedbackText, V_WIDTH / 2, 130); feedbackTimer--;
    }

    if (levelUpTimer > 0) {
        ctx.fillStyle = currentLevel === 5 ? "rgba(241, 196, 15, " + Math.min(1, levelUpTimer / 30) + ")" : "rgba(27, 94, 32, " + Math.min(1, levelUpTimer / 30) + ")";
        ctx.font = "bold 26px Arial"; ctx.textAlign = "center";
        ctx.fillText("🌟 VÒNG KHÓ CẤP " + currentLevel + " BẮT ĐẦU 🌟", V_WIDTH / 2, 320);
        ctx.font = "bold 14px Arial";
        if (currentLevel === 3) ctx.fillText("Hiệu ứng Gió lượn xuất hiện & Ẩn chữ hướng dẫn!", V_WIDTH / 2, 355);
        if (currentLevel === 4) ctx.fillText("Nguy hiểm: Mở khóa Thùng rác Lây nhiễm màu Vàng!", V_WIDTH / 2, 355);
        if (currentLevel === 5) ctx.fillText("CẢNH BÁO: Tốc độ tối đa! Vị trí các thùng rác xáo trộn liên tục khi đúng rác!", V_WIDTH / 2, 355);
        levelUpTimer--;
    }

    requestAnimationFrame(gameLoop);
}

// --- HỆ THỐNG XỬ LÝ TOẠ ĐỘ CHUỘT VÀ CẢM ỨNG ĐA ĐIỂM ---
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const scaleX = V_WIDTH / rect.width;
    const scaleY = V_HEIGHT / rect.height;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function handleStart(e) {
    // Sửa lỗi trắng màn hình: Kích hoạt lấy đối tượng DOM sấm sét ngay khi nhấn chuột
    if (!lightningEffect) {
        lightningEffect = document.getElementById('lightningEffect');
    }

    initAudio(); // Trình duyệt bắt buộc tương tác để chạy âm thanh sinh động
    const pos = getMousePos(e);

    if (showIntro) {
        // Khớp toạ độ nút bấm Bắt đầu
        if (pos.x >= 200 && pos.x <= 400 && pos.y >= 515 && pos.y <= 565) {
            showIntro = false; gameStarted = true; score = 0; lives = 3; currentLevel = 1; spawnNewItem();
        }
        return;
    }

    if (gameOver) {
        // Khớp toạ độ nút bấm Chơi lại
        if (pos.x >= 220 && pos.x <= 380 && pos.y >= 380 && pos.y <= 430) {
            gameOver = false; score = 0; lives = 3; currentLevel = 1; spawnNewItem();
        }
        return;
    }

    if (currentItem) {
        const dist = Math.hypot(pos.x - currentItem.x, pos.y - currentItem.y);
        if (dist < 45) {
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

function handleEnd() {
    if (!isDragging || !currentItem) return;
    isDragging = false;

    let visibleBinsCount = (currentLevel === 4 || currentLevel === 5) ? 4 : 3;
    let activeBins = bins.slice(0, visibleBinsCount);
    let matchedBin = null;

    // Kiểm tra va chạm xem rác được thả vào đúng thùng nào
    activeBins.forEach(bin => {
        if (currentItem.x >= bin.x && currentItem.x <= bin.x + bin.w &&
            currentItem.y >= bin.y && currentItem.y <= bin.y + bin.h) {
            matchedBin = bin;
        }
    });

    if (matchedBin) {
        if (currentItem.type === matchedBin.id) {
            // Đúng loại rác: Cộng điểm, tạo hiệu ứng pháo hoa, đổi vị trí thùng nếu là cấp 5
            score += 10;
            playSound('correct');
            createParticles(currentItem.x, currentItem.y, matchedBin.color);
            showFeedback("Chính xác! +10 Điểm 🎉", "#27ae60");
            checkLevelProgress();
            
            if (currentLevel === 5) {
                shuffleBins(); // Cấp 5 đổi vị trí thùng liên tục để tăng độ thử thách
            }
            spawnNewItem();
        } else {
            // Sai loại rác: Trừ mạng
            lives--;
            playSound('wrong');
            showFeedback("Sai thùng rồi! Em chọn lại nhé 😟", "#c0392b");
            if (lives <= 0) gameOver = true; else spawnNewItem();
        }
    }
}

// Đăng ký toàn bộ sự kiện cho cả PC và Thiết bị di động (Vuốt màn hình)
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
window.addEventListener('touchend', handleEnd);

// Khởi chạy hệ thống đồ họa vòng lặp chính
requestAnimationFrame(gameLoop);
