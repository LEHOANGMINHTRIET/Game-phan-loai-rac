// --- CẤU HÌNH HỆ THỐNG ĐỒ HỌA MÀN HÌNH ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('canvas-wrapper');
let lightningEffect = null;

// Tọa độ ảo cố định để tính toán logic độc lập với độ phân giải màn hình
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
let currentLevel = 1;
let gameOver = false;
let gameStarted = false;
let showIntro = true;
let levelUpTimer = 0;

// Mây trôi nền trời
let clouds = [
    { x: 40, y: 80, speed: 0.25, size: 25 },
    { x: 220, y: 120, speed: 0.15, size: 35 },
    { x: 400, y: 70, speed: 0.3, size: 20 }
];

// --- 🎵 TỔ HỢP ÂM THANH & NHẠC NỀN XUYÊN SUỐT (Web Audio API) ---
let audioCtx = null;
let bgmNode = null; // Node quản lý nhạc nền chạy liên tục

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        startBackgroundMusic(); // Bật nhạc nền ngay khi có tương tác đầu tiên
    }
}

// Hàm phát nhạc nền lặp vô tận
function startBackgroundMusic() {
    try {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        
        // Tạo chuỗi giai điệu vui tươi, êm dịu lặp đi lặp lại
        let notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63]; // Đô - Mi - Sol - Đố
        let noteIdx = 0;
        
        osc.type = 'triangle'; // Tiếng êm ái như nhạc sáo cổ điển
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime); // Âm lượng nhỏ vừa phải làm nền
        
        setInterval(() => {
            if (audioCtx && gameStarted && !gameOver) {
                // Tăng nhịp điệu dồn dập hơn ở Cấp độ 5
                let speedFactor = currentLevel === 5 ? 0.25 : 0.45;
                let now = audioCtx.currentTime;
                
                // Đổi tần số nốt nhạc tiếp theo
                let freq = notes[noteIdx % notes.length];
                if (currentLevel === 5) freq *= 1.2; // Đẩy tông cao hơn ở màn giông bão
                
                osc.frequency.setValueAtTime(freq, now);
                noteIdx++;
            }
        }, 450);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
    } catch(e) { console.log("BGM Error: ", e); }
}

// Hiệu ứng âm thanh ngắn (Đúng / Sai / Lên cấp)
function playSound(type) {
    if (!audioCtx) return;
    try {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'correct') {
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc.start(); osc.stop(audioCtx.currentTime + 0.15);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(160, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(70, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            osc.start(); osc.stop(audioCtx.currentTime + 0.2);
        } else if (type === 'levelup') {
            osc.type = 'square';
            let now = audioCtx.currentTime;
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.setValueAtTime(698.46, now + 0.08);
            osc.frequency.setValueAtTime(880, now + 0.16);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(); osc.stop(now + 0.4);
        }
    } catch (e) { console.log(e); }
}

// --- 📦 KHO DỮ LIỆU RÁC THẢI PHONG PHÚ (Đã lược bớt chữ phân loại rườm rà) ---
const trashData = [
    // Hữu cơ
    { text: "🍏", name: "Quả táo ăn dở", type: "organic" },
    { text: "🍌", name: "Vỏ chuối chín", type: "organic" },
    { text: "🍉", name: "Vỏ dưa hấu", type: "organic" },
    { text: "🪵", name: "Cành củi khô", type: "organic" },
    { text: "🥀", name: "Hoa hồng héo", type: "organic" },
    { text: "🍃", name: "Lá cây rụng", type: "organic" },
    { text: "🥚", name: "Vỏ trứng gà", type: "organic" },
    // Tái chế
    { text: "📦", name: "Thùng giấy Carton", type: "recyclable" },
    { text: "🍾", name: "Chai thủy tinh", type: "recyclable" },
    { text: "🥫", name: "Vỏ lon nước ngọt", type: "recyclable" },
    { text: "🥤", name: "Cốc nhựa trà sữa", type: "recyclable" },
    { text: "📰", name: "Tờ báo cũ", type: "recyclable" },
    { text: "✏️", name: "Thước kẻ nhựa hỏng", type: "recyclable" },
    // Vô cơ
    { text: "🛍️", name: "Túi nilon cũ", type: "residual" },
    { text: "🚬", name: "Tàn thuốc lá", type: "residual" },
    { text: "🪞", name: "Mảnh gương vỡ", type: "residual" },
    { text: "🥣", name: "Bát sành sứt mẻ", type: "residual" },
    { text: "👟", name: "Giày rách hỏng", type: "residual" },
    { text: "🧻", name: "Giấy vệ sinh đã dùng", type: "residual" },
    // Độc hại (Xuất hiện ở Cấp 4 và Cấp 5)
    { text: "🔋", name: "Cục Pin hỏng", type: "medical" },
    { text: "💉", name: "Kim tiêm y tế", type: "medical" },
    { text: "😷", name: "Khẩu trang đã dùng", type: "medical" },
    { text: "🌡️", name: "Nhiệt kế thủy ngân", type: "medical" },
    { text: "🧪", name: "Lọ hóa chất cũ", type: "medical" },
    { text: "💡", name: "Bóng đèn sợi đốt hỏng", type: "medical" }
];

// --- 🎨 HỆ THỐNG THÙNG RÁC THỜI TRANG 3D & TỰ ĐỘNG CĂN ĐỀU MÀN HÌNH ---
let bins = [
    { id: "organic", name: "HỮU CƠ", color1: "#2ecc71", color2: "#27ae60", x: 0, y: 590, w: 92, h: 85 },
    { id: "recyclable", name: "TÁI CHẾ", color1: "#3498db", color2: "#2980b9", x: 0, y: 590, w: 92, h: 85 },
    { id: "residual", name: "VÔ CƠ", color1: "#95a5a6", color2: "#7f8c8d", x: 0, y: 590, w: 92, h: 85 },
    { id: "medical", name: "ĐỘC HẠI", color1: "#e67e22", color2: "#d35400", x: 0, y: 590, w: 92, h: 85 }
];

let currentItem = null;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let particles = [];

function createParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5 - 2,
            radius: Math.random() * 3 + 1.5, color: color, alpha: 1
        });
    }
}

let feedbackText = ""; let feedbackColor = ""; let feedbackTimer = 0;
function showFeedback(text, color) {
    feedbackText = text; feedbackColor = color; feedbackTimer = 40;
}

function spawnNewItem() {
    let availableItems = trashData;
    if (currentLevel < 4) {
        availableItems = trashData.filter(item => item.type !== 'medical');
    }
    let raw = availableItems[Math.floor(Math.random() * availableItems.length)];
    currentItem = {
        text: raw.text, name: raw.name, type: raw.type,
        x: Math.random() * (V_WIDTH - 140) + 70, y: -40,
        angle: Math.random() * 5, windShift: (Math.random() - 0.5) * 3
    };
    isDragging = false;
}

// 📐 THUẬT TOÁN ĐỈNH CAO: Tự động tính toán vị trí, dàn đều khoảng cách bất kể 3 hay 4 thùng
function rearrangeBins() {
    let activeCount = (currentLevel >= 4) ? 4 : 3;
    let totalWidthOfBins = activeCount * 92;
    let remainingSpace = V_WIDTH - totalWidthOfBins;
    let padding = remainingSpace / (activeCount + 1); // Khoảng trống lề và giữa các thùng bằng nhau chẵn chặn

    let activeBins = (currentLevel >= 4) ? bins : bins.filter(b => b.id !== 'medical');
    
    activeBins.forEach((bin, idx) => {
        bin.x = padding + idx * (92 + padding);
    });
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
        rearrangeBins(); // Cập nhật lại số lượng và căn đều lại vị trí thùng
    }
}

// --- VÒNG LẶP ĐỒ HỌA CHÍNH GAME LOOP ---
function gameLoop() {
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

    // 1. VẼ NỀN THEO TỪNG CẤP ĐỘ KHÁC NHÀU
    let skyGrad = ctx.createLinearGradient(0, 0, 0, V_HEIGHT);
    if (currentLevel === 1) { skyGrad.addColorStop(0, '#e0f7fa'); skyGrad.addColorStop(1, '#ffffff'); }
    else if (currentLevel === 2) { skyGrad.addColorStop(0, '#b2ebf2'); skyGrad.addColorStop(1, '#ffffff'); }
    else if (currentLevel === 3) { skyGrad.addColorStop(0, '#fff9c4'); skyGrad.addColorStop(1, '#ffffff'); }
    else if (currentLevel === 4) { skyGrad.addColorStop(0, '#ffe0b2'); skyGrad.addColorStop(1, '#ffffff'); }
    else { 
        // Đêm giông bão Cấp 5
        skyGrad.addColorStop(0, '#2c3e50'); skyGrad.addColorStop(1, '#1a252f'); 
        if (lightningEffect && Math.random() < 0.006) { 
            lightningEffect.classList.remove('lightning-active');
            void lightningEffect.offsetWidth;
            lightningEffect.classList.add('lightning-active');
        }
    }
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // Vẽ mây trôi bầu trời
    ctx.fillStyle = currentLevel === 5 ? "rgba(90, 100, 110, 0.7)" : "rgba(255, 255, 255, 0.85)";
    clouds.forEach(c => {
        c.x += c.speed * (currentLevel * 1.1); if (c.x - 40 > V_WIDTH) c.x = -40;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
        ctx.arc(c.x + c.size * 0.6, c.y - c.size * 0.4, c.size * 0.75, 0, Math.PI * 2); ctx.fill();
    });

    // Thảm cỏ đáy nền
    ctx.fillStyle = currentLevel === 5 ? "#1b5e20" : "#2ecc71"; ctx.fillRect(0, 570, V_WIDTH, 130);

    // MÀN HÌNH CHÚ THÍCH HƯỚNG DẪN BAN ĐẦU
    if (showIntro) {
        ctx.fillStyle = "#1b5e20"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
        ctx.fillText("HÀNH TRÌNH XANH LÂM ĐỒNG", V_WIDTH / 2, 100);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)"; ctx.fillRect(25, 140, 430, 360);
        ctx.lineWidth = 3; ctx.strokeStyle = "#2ecc71"; ctx.strokeRect(25, 140, 430, 360);

        ctx.fillStyle = "#34495e"; ctx.font = "13px Arial"; ctx.textAlign = "left";
        let lines = [
            "🎮 Cách chơi: Kéo và thả rác rơi vào đúng thùng phân loại.",
            "🎵 Điểm mới: Nhạc nền sinh động, thiết kế thùng rác tối ưu.",
            "📊 Thử thách phân cấp bậc siêu hấp dẫn:",
            "• Cấp 1 (0đ+): Rác rơi thong thả, hiện tên rác rõ ràng.",
            "• Cấp 2 (40đ+): Tốc độ rơi tăng tốc thử thách phản xạ.",
            "• Cấp 3 (90đ+): Gió thổi bay lượn sóng, ẩn tên gợi ý chữ.",
            "• Cấp 4 (150đ+): Mở khóa Thùng rác ĐỘC HẠI nguy hiểm (Cam).",
            "• Cấp 5 (250đ+): SIÊU CẤP ĐÊM GIÔNG BÃO - Thùng rác xáo trộn!"
        ];
        lines.forEach((line, idx) => ctx.fillText(line, 40, 180 + idx * 30));

        // Nút bắt đầu thiết kế bo góc đẹp mắt
        ctx.fillStyle = "#2ecc71"; ctx.fillRect(140, 520, 200, 48);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "center";
        ctx.fillText("BẮT ĐẦU THỬ THÁCH", V_WIDTH / 2, 549);
        requestAnimationFrame(gameLoop); return;
    }

    // MÀN HÌNH GAME OVER
    if (gameOver) {
        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 30px Arial"; ctx.textAlign = "center";
        ctx.fillText("TRÒ CHƠI KẾT THÚC", V_WIDTH / 2, 250);
        ctx.fillStyle = "#34495e"; ctx.font = "bold 18px Arial";
        ctx.fillText("Tổng điểm đạt được: " + score + " Điểm", V_WIDTH / 2, 300);
        ctx.fillStyle = "#3498db"; ctx.fillRect(160, 370, 160, 46);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 15px Arial"; ctx.fillText("CHƠI LẠI", V_WIDTH / 2, 398);
        requestAnimationFrame(gameLoop); return;
    }

    // 2. VẼ ĐỒ HỌA CHỈ SỐ HUD
    ctx.fillStyle = currentLevel === 5 ? "#ffffff" : "#2c3e50"; ctx.font = "bold 15px Arial"; ctx.textAlign = "left";
    ctx.fillText("🏆 ĐIỂM: " + score, 20, 40);
    ctx.fillText("⚡ CẤP ĐỘ: " + currentLevel, 20, 65);
    ctx.textAlign = "right"; ctx.fillText("MẠNG: " + "❤️".repeat(lives), V_WIDTH - 20, 40);

    // 3. VẼ CÁC THÙNG RÁC ĐÃ ĐƯỢC TỐI ƯU CĂN ĐỀU, PHỐI MÀU 3D ĐẸP
    let activeCount = (currentLevel >= 4) ? 4 : 3;
    let activeBins = bins.slice(0, activeCount);

    activeBins.forEach(bin => {
        // Hiệu ứng đổ bóng 3D cho thùng rác bắt mắt hơn
        let grad = ctx.createLinearGradient(bin.x, bin.y, bin.x, bin.y + bin.h);
        grad.addColorStop(0, bin.color1); grad.addColorStop(1, bin.color2);
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        // Bo góc cạnh trên thùng rác
        ctx.roundRect(bin.x, bin.y, bin.w, bin.h, 8);
        ctx.fill();

        // Nắp thùng rác đậm màu tạo điểm nhấn thẩm mỹ
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(bin.x, bin.y, bin.w, 15);
        
        // Chữ nhãn thùng rác thanh lịch
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center";
        ctx.fillText(bin.name, bin.x + bin.w / 2, bin.y + bin.h / 2 + 6);
    });

    // 4. XỬ LÝ LOGIC VẬT PHẨM RÁC RƠI
    if (currentItem) {
        if (!isDragging) {
            let fallSpeed = 1.2 + (currentLevel * 0.85);
            if (currentLevel === 5) fallSpeed = 5.8; 
            currentItem.y += fallSpeed;

            if (currentLevel === 3 || currentLevel === 4) {
                currentItem.angle += 0.05; currentItem.x += Math.sin(currentItem.angle) * 1.6;
            } else if (currentLevel === 5) {
                currentItem.angle += 0.1; currentItem.x += Math.sin(currentItem.angle) * 3.2 + currentItem.windShift;
            }

            if (currentItem.x < 25) currentItem.x = 25;
            if (currentItem.x > V_WIDTH - 25) currentItem.x = V_WIDTH - 25;

            if (currentItem.y > 580) {
                lives--; playSound('wrong'); showFeedback("Lọt rác mất rồi! -1 Mạng 😟", "#e67e22");
                if (lives <= 0) gameOver = true; else spawnNewItem();
            }
        }

        ctx.save(); ctx.font = "40px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(currentItem.text, currentItem.x, currentItem.y);
        
        // Chỉ hiện tên nhãn rác chữ thường gọn gàng ở Cấp 1, Cấp 2
        if (currentLevel <= 2) {
            ctx.font = "bold 11px Arial"; ctx.fillStyle = "#34495e";
            ctx.fillText(currentItem.name, currentItem.x, currentItem.y - 30);
        }
        ctx.restore();
    } else {
        spawnNewItem();
    }

    // 5. HIỆU ỨNG HẠT PHÁO HOA NỔ
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.03;
        if (p.alpha <= 0) { particles.splice(i, 1); } 
        else {
            ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
    }

    // 6. CHỮ THÔNG BÁO FEEDBACK VÀ LÊN CẤP
    if (feedbackTimer > 0) {
        ctx.fillStyle = feedbackColor; ctx.font = "bold 16px Arial"; ctx.textAlign = "center";
        ctx.fillText(feedbackText, V_WIDTH / 2, 145); feedbackTimer--;
    }

    if (levelUpTimer > 0) {
        ctx.fillStyle = currentLevel === 5 ? "#f1c40f" : "#27ae60"; ctx.font = "bold 22px Arial"; ctx.textAlign = "center";
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

    if (showIntro) {
        if (pos.x >= 140 && pos.x <= 340 && pos.y >= 520 && pos.y <= 568) {
            showIntro = false; gameStarted = true; score = 0; lives = 3; currentLevel = 1;
            rearrangeBins(); spawnNewItem();
        }
        return;
    }
    if (gameOver) {
        if (pos.x >= 160 && pos.x <= 320 && pos.y >= 370 && pos.y <= 416) {
            gameOver = false; score = 0; lives = 3; currentLevel = 1;
            rearrangeBins(); spawnNewItem();
        }
        return;
    }
    if (currentItem) {
        const dist = Math.hypot(pos.x - currentItem.x, pos.y - currentItem.y);
        if (dist < 40) {
            isDragging = true;
            dragOffsetX = pos.x - currentItem.x; dragOffsetY = pos.y - currentItem.y;
            if (e.cancelable) e.preventDefault();
        }
    }
}

function handleMove(e) {
    if (!isDragging || !currentItem) return;
    const pos = getMousePos(e);
    currentItem.x = pos.x - dragOffsetX; currentItem.y = pos.y - dragOffsetY;
    if (e.cancelable) e.preventDefault();
}

function handleEnd() {
    if (!isDragging || !currentItem) return; isDragging = false;

    let activeCount = (currentLevel >= 4) ? 4 : 3;
    let activeBins = bins.slice(0, activeCount);
    let matchedBin = null;

    activeBins.forEach(bin => {
        if (currentItem.x >= bin.x && currentItem.x <= bin.x + bin.w &&
            currentItem.y >= bin.y && currentItem.y <= bin.y + bin.h) {
            matchedBin = bin;
        }
    });

    if (matchedBin) {
        if (currentItem.type === matchedBin.id) {
            score += 10; playSound('correct');
            createParticles(currentItem.x, currentItem.y, binColor(matchedBin.id));
            showFeedback("Chính xác! +10 Điểm 🎉", "#27ae60");
            checkLevelProgress();
            
            if (currentLevel === 5) {
                // Đảo ngẫu nhiên mảng bins để xáo vị trí
                bins.sort(() => Math.random() - 0.5);
                rearrangeBins();
            }
            spawnNewItem();
        } else {
            lives--; playSound('wrong');
            showFeedback("Nhầm thùng rồi em ơi! 😟", "#c0392b");
            if (lives <= 0) gameOver = true; else spawnNewItem();
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

// Khởi tạo tính toán vị trí ban đầu
rearrangeBins();
requestAnimationFrame(gameLoop);
