const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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

// --- VÒNG LẶP HỌA SĨ TRỰC QUAN (MAIN GAME LOOP) ---
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. VẼ BỐI CẢNH NỀN ĐỘNG (Bầu trời dải màu + Mây trôi)
    let skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (currentLevel === 1) {
        skyGradient.addColorStop(0, '#e0f7fa'); skyGradient.addColorStop(1, '#ffffff'); // Bầu trời xanh dịu cấp 1
    } else if (currentLevel === 2) {
        skyGradient.addColorStop(0, '#fff9c4'); skyGradient.addColorStop(1, '#ffffff'); // Bầu trời nắng ấm cấp 2
    } else {
        skyGradient.addColorStop(0, '#ffcc80'); skyGradient.addColorStop(1, '#ffe082'); // Bầu trời hoàng hôn rực lửa cấp 3
    }
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Xử lý chuyển động thuật toán của các đám mây
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    clouds.forEach(cloud => {
        cloud.x += cloud.speed * (currentLevel * 0.8); // Mây bay nhanh hơn khi lên cấp cao
        if (cloud.x - 60 > canvas.width) cloud.x = -60;
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size * 0.6, cloud.y - cloud.size * 0.4, cloud.size * 0.8, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size * 1.2, cloud.y, cloud.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
    });

    // Vẽ thảm cỏ xanh mượt ở đáy màn hình nền
    ctx.fillStyle = "#81c784";
    ctx.fillRect(0, 480, canvas.width, 120);

    // MÀN HÌNH CHỜ BẮT ĐẦU
    if (!gameStarted) {
        ctx.fillStyle = "#1b5e20"; ctx.font = "bold 26px Arial"; ctx.textAlign = "center";
        ctx.fillText("HÀNH TRÌNH XANH LÂM ĐỒNG", canvas.width / 2, 220);
        ctx.fillStyle = "#455a64"; ctx.font = "15px Arial";
        ctx.fillText("Trò chơi phân loại bảo vệ môi trường thế hệ mới", canvas.width / 2, 260);
        
        ctx.fillStyle = "#2ecc71"; ctx.fillRect(220, 340, 160, 50);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px Arial"; ctx.fillText("BẮT ĐẦU CHƠI", canvas.width / 2, 372);
        requestAnimationFrame(gameLoop); return;
    }

    // MÀN HÌNH GAME OVER
    if (gameOver) {
        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 38px Arial"; ctx.textAlign = "center";
        ctx.fillText("TRÒ CHƠI KẾT THÚC", canvas.width / 2, 220);
        ctx.fillStyle = "#2c3e50"; ctx.font = "bold 22px Arial";
        ctx.fillText("Điểm số của em đạt được: " + score, canvas.width / 2, 280);
        
        ctx.fillStyle = "#3498db"; ctx.fillRect(220, 370, 160, 50);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px Arial"; ctx.fillText("CHƠI LẠI", canvas.width / 2, 402);
        requestAnimationFrame(gameLoop); return;
    }

    // 2. VẼ GIAO DIỆN CHỈ SỐ (HUD) & CẤP ĐỘ
    ctx.fillStyle = "#2c3e50"; ctx.font = "bold 16px Arial"; ctx.textAlign = "left";
    ctx.fillText("🏆 ĐIỂM: " + score, 25, 40);
    ctx.fillText("⚡ CẤP ĐỘ: " + currentLevel, 25, 65);
    ctx.textAlign = "right";
    ctx.fillText("MẠNG: " + "❤️".repeat(lives), canvas.width - 25, 40);

    // 3. VẼ CÁC THÙNG RÁC ĐỒ HỌA SẮC NÉT
    bins.forEach(bin => {
        ctx.fillStyle = bin.color; ctx.fillRect(bin.x, bin.y, bin.w, bin.h);
        ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(bin.x, bin.y, bin.w, 15); // Tạo đổ bóng cho nắp thùng
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center";
        ctx.fillText(bin.name, bin.x + bin.w / 2, bin.y + bin.h / 2 + 6);
    });

    // 4. XỬ LÝ VẬT PHẨM RÁC ĐANG RƠI (ÁP DỤNG THUẬT TOÁN THEO CẤP ĐỘ)
    if (currentItem) {
        if (!isDragging) {
            // Tốc độ cơ bản nhân với cấp độ chơi hiện tại
            let baseSpeed = 1.4 + (currentLevel * 0.7);
            currentItem.y += baseSpeed;

            // HIỆU ỨNG CẤP ĐỘ 3: Gió thổi lượn sóng bằng hàm Toán học lượng giác Math.sin
            if (currentLevel === 3) {
                currentItem.angle += 0.05;
                currentItem.x += Math.sin(currentItem.angle) * 1.5;
            }

            // Xử lý chạm đáy mất mạng
            if (currentItem.y > 510) {
                lives--;
                playSound('wrong');
                showFeedback("Lọt rác mất rồi! -1 Mạng 😟", "#e67e22");
                if (lives <= 0) gameOver = true;
                else spawnNewItem();
            }
        }

        // Tiến hành vẽ quả rác (Emoji) lên Canvas
        ctx.save();
        ctx.font = "42px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(currentItem.text, currentItem.x, currentItem.y);
        
        // Ẩn chữ gợi ý ở Cấp độ 3 để tăng tối đa độ thách thức tư duy của học sinh
        if (currentLevel < 3) {
            ctx.font = "bold 11px Arial"; ctx.fillStyle = "#455a64";
            ctx.fillText(currentItem.name, currentItem.x, currentItem.y - 30);
        }
        ctx.restore();
    } else {
        spawnNewItem();
    }

    // 5. CẬP NHẬT VÀ VẼ HỆ THỐNG PHÁO HOA HẠT NỔ (PARTICLES)
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // Thêm gia tốc trọng lực khiến hạt rơi cong xuống rất đẹp mắt
        p.alpha -= 0.02; // Mờ dần
        if (p.alpha <= 0) {
            particles.splice(i, 1);
        } else {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // 6. HIỂN THỊ CHỮ PHẢN HỒI ĐIỂM SỐ VÀ HIỆU ỨNG THẮNG CẤP
    if (feedbackTimer > 0) {
        ctx.fillStyle = feedbackColor; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
        ctx.fillText(feedbackText, canvas.width / 2, 110);
        feedbackTimer--;
    }

    if (levelUpTimer > 0) {
        ctx.fillStyle = "rgba(27, 94, 32, " + Math.min(1, levelUpTimer / 30) + ")";
        ctx.font = "bold 32px Arial"; ctx.textAlign = "center";
        ctx.fillText("🌟 THẮNG CẤP ĐỘ " + currentLevel + " 🌟", canvas.width / 2, 300);
        ctx.font = "16px Arial";
        ctx.fillText(currentLevel === 2 ? "Tốc độ tăng lên! Hãy cẩn thận!" : "Chế độ Siêu Khó: Hiệu ứng Gió thổi xuất hiện!", canvas.width / 2, 340);
        levelUpTimer--;
    }

    requestAnimationFrame(gameLoop);
}

// Bật chạy vòng lặp game
gameLoop();