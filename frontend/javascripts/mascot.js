// ─── PET HELPER MASCOT SYSTEM ────────────────────────────────────────────────
// Inject 1 lần qua staticHeader.js, hoạt động trên mọi trang
// Ảnh đặt tại: /images/mascots/cat-*.jpg và dog-*.jpg
// ─────────────────────────────────────────────────────────────────────────────

if (window.__mascotInitialized) {
    // đã load rồi, bỏ qua
} else {
window.__mascotInitialized = true;

(function () {

    // ── CONFIG ────────────────────────────────────────────────────────────────
    var STORAGE_KEY = 'ph_mascot_choice'; // 'cat' | 'dog' | null
    var BASE_PATH   = '/images/mascots/';

    // Pose map theo loại mascot
    var POSES = {
        cat: {
            idle:   'cat-idle.jpg',
            happy:  'cat-happy.jpg',
            like:   'cat-like.jpg',
        },
        dog: {
            idle:    'dog-idle.jpg',
            happy:   'dog-review.jpg',
            like:    'dog-cool.jpg',
            curious: 'dog-curious.jpg',
        }
    };

    // Bubble tips theo trang (pathname → array messages)
    var PAGE_BUBBLES = {
        '/':           ['Hôm nay bé cưng thế nào rồi? 🐾', 'Cần giúp gì không? Mình ở đây nè!', 'Bắt đầu từ đâu? Bấm vào mình nhé 👇'],
        '/shop':       ['Xem đồ cho bé nào! 🛒', 'Hàng mới về rồi đó~', 'Tìm quà cho bé cưng? Mình giúp!'],
        '/news':       ['Tin tức mới mỗi ngày 📰', 'Có bài hay lắm, đọc thử nha~'],
        '/news-detail':['Đọc xong nhớ like ủng hộ tác giả nhé 💚', 'Bình luận để chia sẻ cảm nghĩ nha!'],
        '/lost':       ['Mình giúp bạn tìm bé nhé 🔍', 'Đăng ảnh rõ sẽ dễ tìm hơn 👀', 'Mô tả màu lông, giống và khu vực nhé!'],
        '/found':      ['Cảm ơn bạn đã giúp đỡ! 🙏', 'Báo tin nhặt được bé ở đây nè', 'Bạn thật tốt bụng! 💚'],
        '/list':       ['Tìm bé lạc? Lọc theo khu vực sẽ nhanh hơn 🔍', 'Có ảnh khớp không? Mình đang xem cùng!'],
        '/adopt':      ['Bé này đang chờ một gia đình 🏠', 'Nhận nuôi là món quà tuyệt vời~', 'Bé nào hợp với bạn nhỉ? 🐾'],
        '/tip':        ['Mẹo hay đó, lưu lại nhé! 📌', 'Chăm bé tốt hơn mỗi ngày~'],
        '/booking':    ['Đặt lịch tiêm phòng cho bé nhé 💉', 'Nhớ giữ lịch nhé!', 'Bé khỏe là mình vui rồi 🐾'],
        '/profile':    ['Cập nhật thông tin của bạn nhé ✏️', 'Ảnh đẹp nha~'],
        '/my-favorites':['Những bé bạn yêu thích đây rồi 💚'],
        '/my-reports': ['Xem lại hoạt động của bạn 📋', 'Cảm ơn đã đóng góp cho cộng đồng!'],
    };

    // Pose dùng theo trang
    var PAGE_POSE = {
        '/shop':        'like',
        '/found':       'happy',
        '/booking':     'like',
        '/adopt':       'happy',
        '/my-favorites':'like',
        '/news-detail': 'curious',
        '/list':        'curious',
        '/tip':         'happy',
    };

    // ── SMART TRIGGERS ────────────────────────────────────────────────────────
    // Map trang → danh sách trigger. Mỗi trigger: { type, ... , msg, pose, duration? }
    var SMART_TRIGGERS = {
        // ── INDEX ──
        '/': [
            // User đứng lâu >20s không làm gì
            { type:'idle', delay:20000, msg:'Bạn đang tìm gì vậy? Bấm vào mình để mình giúp nha 🐾', pose:'curious' },
            // User scroll xuống >60%
            { type:'scroll', threshold:60, msg:'Cuộn xuống nữa để xem thêm tính năng nhé!', pose:'idle', once:true },
        ],
        // ── SHOP ──
        '/shop': [
            { type:'idle', delay:15000, msg:'Tìm sản phẩm gì vậy? Mình giúp lọc nha 🛒', pose:'curious' },
            { type:'scroll', threshold:80, msg:'Xuống cuối rồi đó! Thêm vào giỏ hàng nha 🛍️', pose:'like', once:true },
            { type:'cart_add', msg:'Thêm vào giỏ thành công! 🎉', pose:'happy', duration:3000 },
        ],
        // ── NEWS ──
        '/news': [
            { type:'idle', delay:18000, msg:'Có bài hay lắm! Lọc theo chủ đề bạn thích nha 📰', pose:'curious' },
        ],
        // ── NEWS-DETAIL ──
        '/news-detail': [
            { type:'scroll', threshold:80, msg:'Đọc xong rồi? Like ủng hộ tác giả nha! 💚', pose:'like', once:true },
            { type:'idle', delay:25000, msg:'Thích bài này không? Bình luận để chia sẻ nha~', pose:'curious' },
        ],
        // ── LOST / FOUND ──
        '/lost': [
            { type:'idle', delay:12000, msg:'Form thiếu ảnh sẽ khó tìm hơn đó 👀', pose:'curious' },
            { type:'form_no_image', msg:'Thêm ảnh vào sẽ tăng khả năng tìm thấy bé nhé! 📸', pose:'curious' },
        ],
        '/found': [
            { type:'idle', delay:12000, msg:'Điền địa điểm nhặt được bé giúp mình nha 📍', pose:'curious' },
        ],
        // ── LIST ──
        '/list': [
            { type:'idle', delay:15000, msg:'Lọc theo khu vực sẽ tìm nhanh hơn nhiều đó 🔍', pose:'curious' },
            { type:'scroll', threshold:90, msg:'Không thấy bé? Thử đổi bộ lọc xem nha~', pose:'idle', once:true },
        ],
        // ── ADOPT ──
        '/adopt': [
            { type:'idle', delay:20000, msg:'Bé nào làm bạn xúc động? Nhấn để xem thêm nha 🏠', pose:'curious' },
            { type:'scroll', threshold:70, msg:'Còn nhiều bé đang chờ lắm~ 🐾', pose:'happy', once:true },
        ],
        // ── BOOKING ──
        '/booking': [
            { type:'idle', delay:15000, msg:'Tiêm phòng định kỳ rất quan trọng đó bạn ơi 💉', pose:'curious' },
            { type:'form_submit_success', msg:'Đặt lịch thành công! Nhớ đi đúng giờ nha 🎉', pose:'happy', duration:4000 },
        ],
        // ── PROFILE ──
        '/profile': [
            { type:'idle', delay:20000, msg:'Cập nhật ảnh đại diện cho đẹp nha~ 📸', pose:'curious' },
        ],
    };

    // ── STYLES ────────────────────────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('__mascotStyles')) return;
        var s = document.createElement('style');
        s.id = '__mascotStyles';
        s.textContent = [
            // Picker button (góc dưới trái)
            '#__mascotTrigger{position:fixed;left:16px;bottom:20px;z-index:10000;width:50px;height:50px;border:none;border-radius:999px;background:#2d6a4f;color:#fff;font-size:24px;line-height:1;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.2);transition:transform 0.18s,background 0.18s;}',
            '#__mascotTrigger:hover{background:#40916c;transform:translateY(-2px) scale(1.04);}',
            // Picker: bên phải avatar, ngang đáy
            '#__mascotPickerPanel{position:fixed;bottom:20px;left:226px;background:#fff;border:1px solid #e0f0e8;border-radius:14px;padding:12px 14px;box-shadow:0 4px 18px rgba(0,0,0,0.13);min-width:175px;z-index:10000;opacity:0;transform:translateY(8px) scale(0.95);pointer-events:none;transition:opacity 0.22s,transform 0.22s;transform-origin:bottom left;}',
            '#__mascotPickerPanel.show{opacity:1;transform:translateY(0) scale(1);pointer-events:all;}',
            '#__mascotPickerPanel p{margin:0 0 10px;font-size:12px;color:#555;font-weight:600;}',
            '.mascot-choice-btn{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:9px;border:1.5px solid #e0e0e0;background:#fafafa;cursor:pointer;font-size:13px;font-weight:600;color:#333;transition:all 0.15s;margin-bottom:6px;}',
            '.mascot-choice-btn:last-child{margin-bottom:0;}',
            '.mascot-choice-btn:hover{background:#f0faf4;border-color:#a5d6a7;}',
            '.mascot-choice-btn.active{background:#e8f5e9;border-color:#4caf50;color:#2d6a4f;}',
            '.mascot-choice-preview{width:32px;height:32px;object-fit:contain;border-radius:6px;}',
            '#__mascotPickerPanel .dismiss-mascot{display:block;text-align:center;font-size:11px;color:#aaa;cursor:pointer;margin-top:6px;padding-top:6px;border-top:1px solid #f0f0f0;}',
            '#__mascotPickerPanel .dismiss-mascot:hover{color:#888;}',

            // Mascot companion (góc dưới TRÁI)
            // Avatar 200x200, bottom:20px → đỉnh ở bottom:220px
            // Bubble: left = 16+200+10 = 226px, bottom = 220+12 = 232px (phía trên đỉnh avatar)
            // Panel:  left = 226px, bottom = 20px (ngang đáy avatar, mở lên trên)
            '#__mascotWrap{position:fixed;bottom:20px;left:16px;z-index:9999;display:flex;flex-direction:row;align-items:flex-end;gap:8px;pointer-events:none;}',
            '#__mascotWrap.hidden{display:none;}',
            '#__mascotBubble{position:fixed;bottom:150px;left:200px;z-index:10001;background:#fff;border:1px solid #c8e6c9;border-radius:14px 14px 14px 4px;padding:9px 13px;font-size:12.5px;color:#1b4332;max-width:240px;box-shadow:0 2px 10px rgba(0,0,0,0.1);opacity:0;transform:translateY(6px);transition:opacity 0.3s,transform 0.3s;line-height:1.5;pointer-events:none;font-family:inherit;}',
            '#__mascotBubble.show{opacity:1;transform:translateY(0);}',
            '#__mascotAvatar{width:200px;height:200px;object-fit:contain;cursor:pointer;pointer-events:all;animation:mscFloat 3s ease-in-out infinite;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.15));transition:transform 0.15s;}',
            '#__mascotAvatar:hover{transform:scale(1.07);animation-play-state:paused;}',
            '#__mascotAvatar:active{transform:scale(0.95);}',
            '@keyframes mscFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}',

            // Quick panel bên PHẢI avatar, không đè lên avatar
            '#__mascotPanel{position:fixed;bottom:20px;left:226px;z-index:9999;background:#fff;border:1px solid #c8e6c9;border-radius:14px;padding:14px 12px 10px;width:215px;box-shadow:0 4px 18px rgba(0,0,0,0.13);opacity:0;transform:scale(0.9) translateY(12px);transform-origin:bottom left;pointer-events:none;transition:opacity 0.22s,transform 0.22s;}',
            '#__mascotPanel.show{opacity:1;transform:scale(1) translateY(0);pointer-events:all;}',
            '#__mascotPanel .qp-title{font-size:12px;font-weight:700;color:#2d6a4f;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e8f5e9;}',
            '.qp-item{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:8px;border:none;background:transparent;font-size:12.5px;color:#333;cursor:pointer;text-align:left;transition:background 0.15s;margin-bottom:2px;font-family:inherit;}',
            '.qp-item:hover{background:#f0faf4;}',
            '#__mascotPanel .qp-close{display:block;text-align:center;font-size:11px;color:#aaa;cursor:pointer;margin-top:6px;padding-top:6px;border-top:1px solid #f5f5f5;}',
            '#__mascotPanel .qp-close:hover{color:#888;}',

            // Mobile: avatar 120px, bubble và panel vẫn bên phải: left = 16+120+10 = 146px
            '@media(max-width:480px){#__mascotTrigger{width:44px;height:44px;font-size:20px;left:12px;bottom:16px;}#__mascotAvatar{width:120px;height:120px;}#__mascotBubble{left:146px;bottom:140px;max-width:170px;font-size:11.5px;}#__mascotPanel{left:146px;bottom:20px;width:175px;}#__mascotPickerPanel{left:146px;bottom:20px;}.__mascot-guide-nav{left:146px;}}',

            // Nút đổi mascot (hover)
            '#__mascotSwitchBtn{background:#fff;border:1px solid #c8e6c9;border-radius:20px;padding:5px 11px;font-size:11.5px;color:#2d6a4f;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.12);white-space:nowrap;pointer-events:all;transition:background 0.15s,transform 0.15s;align-self:flex-end;margin-bottom:6px;opacity:1 !important;}',
            '#__mascotSwitchBtn:hover{background:#f0faf4;transform:scale(1.05);}',
            '',
        ].join('');
        document.head.appendChild(s);
    }

    // ── STATE ─────────────────────────────────────────────────────────────────
    var choice    = null; // 'cat' | 'dog'
    var panelOpen = false;
    var bubbleTimer = null;

    function getChoice() {
        try { return localStorage.getItem(STORAGE_KEY); } catch(e) { return null; }
    }
    function saveChoice(v) {
        try { localStorage.setItem(STORAGE_KEY, v); } catch(e) {}
    }

    // ── BUBBLE ────────────────────────────────────────────────────────────────
    function showBubble(msg, duration) {
        var el = document.getElementById('__mascotBubble');
        if (!el) return;
        clearTimeout(bubbleTimer);
        el.textContent = msg;
        el.classList.add('show');
        if (duration) {
            bubbleTimer = setTimeout(function() {
                el.classList.remove('show');
            }, duration);
        }
    }

    function hideBubble() {
        var el = document.getElementById('__mascotBubble');
        if (el) el.classList.remove('show');
    }

    // ── POSE ──────────────────────────────────────────────────────────────────
    function setPose(poseName) {
        if (!choice) return;
        var map = POSES[choice];
        var file = map[poseName] || map['idle'];
        var avatar = document.getElementById('__mascotAvatar');
        if (avatar) avatar.src = BASE_PATH + file;
    }

    function getPagePose() {
        var path = window.location.pathname.replace(/\/$/, '') || '/';
        return PAGE_POSE[path] || 'idle';
    }

    function getPageBubbles() {
        var path = window.location.pathname.replace(/\/$/, '') || '/';
        // Khớp prefix (vd /adopt/... → /adopt)
        var keys = Object.keys(PAGE_BUBBLES);
        for (var i = 0; i < keys.length; i++) {
            if (path === keys[i] || path.startsWith(keys[i] + '/')) {
                return PAGE_BUBBLES[keys[i]];
            }
        }
        return ['Mình có thể giúp gì cho bạn? 🐾'];
    }

    // ── MASCOT AVATAR ─────────────────────────────────────────────────────────
    function buildMascotAvatar() {
        if (document.getElementById('__mascotWrap')) return;

        var wrap = document.createElement('div');
        wrap.id = '__mascotWrap';

        var bubble = document.createElement('div');
        bubble.id = '__mascotBubble';

        var img = document.createElement('img');
        img.id = '__mascotAvatar';
        img.alt = 'Mascot';
        img.onclick = function(e) {
            e.stopPropagation();
            // Nếu picker đang mở thì chỉ đóng picker, không mở quick panel
            var picker = document.getElementById('__mascotPickerPanel');
            if (picker && picker.classList.contains('show')) {
                picker.classList.remove('show');
                return;
            }
            if (!choice) {
                if (picker) picker.classList.add('show');
            } else {
                togglePanel();
            }
        };

        wrap.appendChild(img);
        document.body.appendChild(bubble); // bubble nằm ngoài wrap, fixed độc lập
        document.body.appendChild(wrap);
        document.body.appendChild(buildPanel());

        // Nút đổi mascot — nằm cạnh phải avatar trong wrap
        if (!document.getElementById('__mascotSwitchBtn')) {
            var wrap = document.getElementById('__mascotWrap');
            var switchBtn = document.createElement('button');
            switchBtn.id = '__mascotSwitchBtn';
            switchBtn.title = 'Đổi bạn đồng hành';
            switchBtn.textContent = '🔄';
            switchBtn.onclick = function(e) {
                e.stopPropagation();
                e.preventDefault();
                var picker = document.getElementById('__mascotPickerPanel');
                if (picker) picker.classList.toggle('show');
            };
            if (wrap) wrap.appendChild(switchBtn);
            else document.body.appendChild(switchBtn);
        }

        applyChoice(choice);
        scheduleIdleBubble();
    }

    function applyChoice(c) {
        choice = c;
        if (!c) return;
        var wrap = document.getElementById('__mascotWrap');
        if (wrap) wrap.classList.remove('hidden');
        setPose(getPagePose());

        // Update picker buttons active state
        document.querySelectorAll('.mascot-choice-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.pick === c);
        });
    }

    // ── QUICK PANEL ───────────────────────────────────────────────────────────
    function buildPanel() {
        var panel = document.createElement('div');
        panel.id = '__mascotPanel';

        var items = [
            { icon: '🐾', label: 'Tìm thú cưng',       href: '/adopt' },
            { icon: '📍', label: 'Báo thất lạc',        href: '/lost' },
            { icon: '🛒', label: 'Shop đồ cưng',         href: '/shop' },
            { icon: '💉', label: 'Đặt lịch tiêm',       href: '/booking' },
            { icon: '📰', label: 'Tin tức',              href: '/news' },
            { icon: '🗺️', label: 'Hướng dẫn trang này', guide: true },
        ];

        panel.innerHTML = '<div class="qp-title">Mình giúp gì cho bạn? 🐾</div>' +
            items.map(function(it) {
                if (it.guide) {
                    return '<button class="qp-item" onclick="window.__mascotClosePanel();window.__mascotGuide();">' +
                        '<span>' + it.icon + '</span>' + it.label + '</button>';
                }
                return '<button class="qp-item" onclick="window.location.href=\'' + it.href + '\'">' +
                    '<span>' + it.icon + '</span>' + it.label + '</button>';
            }).join('') +
            '<span class="qp-close" onclick="window.__mascotClosePanel()">Thôi, mình tự xem</span>';

        return panel;
    }

    window.__mascotClosePanel = function() {
        var panel = document.getElementById('__mascotPanel');
        if (panel) panel.classList.remove('show');
        panelOpen = false;
        setPose(getPagePose());
    };

    function togglePanel() {
        panelOpen = !panelOpen;
        var panel = document.getElementById('__mascotPanel');
        if (!panel) return;
        if (panelOpen) {
            panel.classList.add('show');
            hideBubble();
            setPose('like');
        } else {
            panel.classList.remove('show');
            setPose(getPagePose());
        }
    }

    // Đóng panel khi click ngoài
    document.addEventListener('click', function(e) {
        if (!panelOpen) return;
        var panel = document.getElementById('__mascotPanel');
        var avatar = document.getElementById('__mascotAvatar');
        if (panel && !panel.contains(e.target) && e.target !== avatar) {
            window.__mascotClosePanel();
        }
    });

    // ── IDLE BUBBLE ───────────────────────────────────────────────────────────
    function scheduleIdleBubble() {
        // Hiện bubble lần đầu sau 4 giây
        setTimeout(function() {
            if (panelOpen) return;
            var bubbles = getPageBubbles();
            var msg = bubbles[Math.floor(Math.random() * bubbles.length)];
            showBubble(msg, 5000);
        }, 4000);

        // Sau đó lặp mỗi 45 giây nếu user không tương tác
        setInterval(function() {
            if (panelOpen) return;
            var bubbles = getPageBubbles();
            var msg = bubbles[Math.floor(Math.random() * bubbles.length)];
            showBubble(msg, 5000);
        }, 45000);
    }


    // ── SMART TRIGGER ENGINE ─────────────────────────────────────────────────
    var _triggeredOnce = {}; // key = trang+type để track "once"
    var _idleTimer = null;
    var _lastActivity = Date.now();

    function getPageKey() {
        var p = window.location.pathname.replace(/\/$/, '') || '/';
        // Normalize: /news/123 → /news-detail, /list/... → /list, etc.
        if (/^\/news\/.+/.test(p)) return '/news-detail';
        if (/^\/lost/.test(p))   return '/lost';
        if (/^\/found/.test(p))  return '/found';
        if (/^\/list/.test(p))   return '/list';
        if (/^\/adopt/.test(p))  return '/adopt';
        if (/^\/tip/.test(p))    return '/tip';
        if (/^\/booking/.test(p))return '/booking';
        if (/^\/profile/.test(p))return '/profile';
        if (/^\/my-favorites/.test(p)) return '/my-favorites';
        if (/^\/my-reports/.test(p))   return '/my-reports';
        if (/^\/shop/.test(p))   return '/shop';
        if (/^\/news/.test(p))   return '/news';
        return p;
    }

    function triggerShow(trigger) {
        if (!choice) return; // chưa chọn mascot thì không trigger
        var key = getPageKey() + '_' + trigger.type;
        if (trigger.once && _triggeredOnce[key]) return;
        if (trigger.once) _triggeredOnce[key] = true;
        setExpression(trigger.pose || 'idle');
        showBubble(trigger.msg, trigger.duration || 5000);
        // Reset về idle sau khi hết bubble
        setTimeout(function() { setExpression('idle'); }, (trigger.duration || 5000) + 500);
    }

    function setExpression(pose) {
        if (!choice) return;
        var avatar = document.getElementById('__mascotAvatar');
        if (!avatar) return;
        var poses = POSES[choice] || {};
        var file = poses[pose] || poses['idle'];
        if (file) avatar.src = BASE_PATH + file;
    }

    function runSmartTriggers() {
        var pageKey = getPageKey();
        var triggers = SMART_TRIGGERS[pageKey];
        if (!triggers) return;

        triggers.forEach(function(trigger) {
            if (trigger.type === 'idle') {
                // Reset idle timer mỗi khi user tương tác
                setTimeout(function() {
                    var idleCheck = setInterval(function() {
                        if (!choice) return;
                        var elapsed = Date.now() - _lastActivity;
                        if (elapsed >= trigger.delay) {
                            clearInterval(idleCheck);
                            if (!panelOpen) triggerShow(trigger);
                        }
                    }, 3000);
                }, trigger.delay);
            }

            if (trigger.type === 'scroll') {
                window.addEventListener('scroll', function onScroll() {
                    var scrolled = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
                    if (scrolled >= trigger.threshold) {
                        window.removeEventListener('scroll', onScroll);
                        if (!panelOpen) triggerShow(trigger);
                    }
                }, { passive: true });
            }

            if (trigger.type === 'form_no_image') {
                // Check sau 8s nếu có form mà input[type=file] trống
                setTimeout(function() {
                    var fileInput = document.querySelector('input[type="file"]');
                    if (fileInput && !fileInput.files.length) {
                        triggerShow(trigger);
                    }
                }, 8000);
            }
        });

        // Track cart_add trigger qua localStorage event (shop.html gọi phCartUpdateUI)
        var cartTrigger = triggers.find(function(t){ return t.type === 'cart_add'; });
        if (cartTrigger) {
            window.addEventListener('storage', function(e) {
                if (e.key === 'ph_cart' && e.newValue && e.oldValue) {
                    try {
                        var oldCart = JSON.parse(e.oldValue || '[]');
                        var newCart = JSON.parse(e.newValue || '[]');
                        var oldCount = oldCart.reduce(function(s,i){ return s+(i.qty||1); }, 0);
                        var newCount = newCart.reduce(function(s,i){ return s+(i.qty||1); }, 0);
                        if (newCount > oldCount) triggerShow(cartTrigger);
                    } catch(e) {}
                }
            });
        }

        // Track user activity để reset idle
        ['mousemove','keydown','click','scroll','touchstart'].forEach(function(ev) {
            document.addEventListener(ev, function() { _lastActivity = Date.now(); }, { passive: true });
        });
    }

    // Public API: trang nào muốn trigger thủ công gọi window.__mascotTrigger(type, msg?, pose?)
    window.__mascotTrigger = function(type, msg, pose) {
        if (!choice) return;
        setExpression(pose || 'happy');
        if (msg) showBubble(msg, 4000);
        setTimeout(function() { setExpression('idle'); }, 4500);
    };

    // Expose setExpression để trang ngoài dùng
    window.__mascotSetExpression = setExpression;

    // ── PICKER (góc dưới trái) ────────────────────────────────────────────────
    function buildPicker() {
        if (document.getElementById('__mascotPickerPanel')) return;

        var panel = document.createElement('div');
        panel.id = '__mascotPickerPanel';
        panel.innerHTML = '<p>Chọn bạn đồng hành 🐾</p>' +
            '<button class="mascot-choice-btn" data-pick="cat" onclick="window.__mascotPick(\'cat\')">' +
            '  <img class="mascot-choice-preview" src="' + BASE_PATH + POSES.cat.idle + '" alt="Mèo">' +
            '  Mèo — chill &amp; cute' +
            '</button>' +
            '<button class="mascot-choice-btn" data-pick="dog" onclick="window.__mascotPick(\'dog\')">' +
            '  <img class="mascot-choice-preview" src="' + BASE_PATH + POSES.dog.idle + '" alt="Chó">' +
            '  Chó — vui &amp; năng động' +
            '</button>' +
            '<span class="dismiss-mascot" onclick="window.__mascotDismissPicker()">Không cần, cảm ơn</span>';

        // Button mở picker (icon 🐾)
        document.body.appendChild(panel);

        // Đóng khi click ngoài
        document.addEventListener('click', function(e) {
            if (!panel.classList.contains('show')) return;
            var _wrap = document.getElementById('__mascotWrap');
            var _trigger = document.getElementById('__mascotTrigger');
            var _switchBtn = document.getElementById('__mascotSwitchBtn');
            if (!panel.contains(e.target) && e.target !== _wrap && !(_wrap && _wrap.contains(e.target)) && e.target !== _trigger && e.target !== _switchBtn) {
                panel.classList.remove('show');
            }
        });

        // Nếu đã có lựa chọn từ trước → highlight
        if (choice) {
            document.querySelectorAll('.mascot-choice-btn').forEach(function(b) {
                b.classList.toggle('active', b.dataset.pick === choice);
            });
        }
    }

    function buildTrigger() {
        if (document.getElementById('__mascotTrigger')) return;

        var trigger = document.createElement('button');
        trigger.id = '__mascotTrigger';
        trigger.type = 'button';
        trigger.title = 'Chọn bạn đồng hành';
        trigger.setAttribute('aria-label', 'Chọn bạn đồng hành');
        trigger.textContent = '🐾';
        trigger.onclick = function(e) {
            e.stopPropagation();
            var panel = document.getElementById('__mascotPickerPanel');
            if (!panel) return;
            panel.classList.toggle('show');
        };

        document.body.appendChild(trigger);

        // Gợi ý mở picker cho lần đầu khi user chưa chọn mascot
        setTimeout(function() {
            var panel = document.getElementById('__mascotPickerPanel');
            if (panel && !choice) panel.classList.add('show');
        }, 450);
    }

    window.__mascotPick = function(type) {
        saveChoice(type);
        applyChoice(type);

        var trigger = document.getElementById('__mascotTrigger');
        if (trigger) trigger.remove();

        // Đóng picker panel
        var panel = document.getElementById('__mascotPickerPanel');
        if (panel) panel.classList.remove('show');

        // Hiện mascot nếu chưa build
        if (!document.getElementById('__mascotWrap')) {
            buildMascotAvatar();
        } else {
            applyChoice(type);
        }

        // Bubble chào
        setTimeout(function() {
            var greet = type === 'cat'
                ? 'Meow! Mình là Doongie, cần gì cứ bấm vào mình nha 🐱'
                : 'Gâu! Mình là Plugg luôn sẵn sàng giúp bạn 🐶';
            showBubble(greet, 4000);
        }, 300);
    };

    window.__mascotDismissPicker = function() {
        var panel = document.getElementById('__mascotPickerPanel');
        if (panel) panel.classList.remove('show');
        var trigger = document.getElementById('__mascotTrigger');
        if (trigger) trigger.remove();
        var wrap = document.getElementById('__mascotWrap');
        if (wrap) wrap.classList.add('hidden');
        // Lưu 'none' để không hỏi lại
        try { localStorage.setItem(STORAGE_KEY, 'none'); } catch(e) {}
    };

    // ── PUBLIC API (cho các trang gọi khi có event) ───────────────────────────
    // Ví dụ: window.mascotReact('success') khi đăng bài thành công
    window.mascotReact = function(event) {
        if (!choice) return;
        var reactions = {
            'success':  { pose: 'happy',  msg: 'Xong rồi! Tuyệt vời lắm ✨', duration: 5000 },
            'found':    { pose: 'happy',  msg: 'Bé về nhà rồi! Yayyy 🎉',     duration: 5000 },
            'error':    { pose: 'curious',msg: 'Ồ, có gì đó sai sai 🤔',      duration: 4000 },
            'empty':    { pose: 'curious',msg: 'Có ảnh sẽ dễ tìm hơn đó 👀',  duration: 4000 },
        };
        var r = reactions[event];
        if (!r) return;
        setPose(r.pose);
        showBubble(r.msg, r.duration);
        // Về pose mặc định sau
        setTimeout(function() { setPose(getPagePose()); }, (r.duration || 4000) + 500);
    };

    // ── INIT ──────────────────────────────────────────────────────────────────
    function init() {
        injectStyles();
        choice = getChoice();

        // 'none' = user đã từ chối → không hiện gì
        if (choice === 'none') return;

        buildPicker();

        if (choice) {
            buildMascotAvatar();
            // Áp dụng pose theo trang ngay khi load
            var pageKey = getPageKey();
            if (PAGE_POSE[pageKey]) {
                setTimeout(function() { setExpression(PAGE_POSE[pageKey]); }, 1500);
            }
        } else {
            // Chưa chọn → hiện trigger button để user mở picker
            buildTrigger();
        }

        // Chạy smart triggers
        runSmartTriggers();
    }


    // ══════════════════════════════════════════════════════════════════════════
    // GUIDE MODE — dẫn user qua nhiều bước, highlight + scroll + bubble
    // ══════════════════════════════════════════════════════════════════════════

    // CSS inject cho highlight
    (function() {
        if (document.getElementById('__mascotGuideStyle')) return;
        var s = document.createElement('style');
        s.id = '__mascotGuideStyle';
        s.textContent = [
            '.__mascot-highlight {',
            '  outline: 3px solid #f9c74f !important;',
            '  outline-offset: 6px;',
            '  border-radius: 8px;',
            '  box-shadow: 0 0 0 8px rgba(249,199,79,0.35), 0 0 20px 4px rgba(249,199,79,0.55) !important;',
            '  transition: outline 0.25s, box-shadow 0.25s;',
            '  position: relative;',
            '  z-index: 9999 !important;',
            '  animation: mascotPulse 1.2s ease-in-out infinite;',
            '}',
            '@keyframes mascotPulse {',
            '  0%,100% { box-shadow: 0 0 0 8px rgba(249,199,79,0.35), 0 0 20px 4px rgba(249,199,79,0.45); }',
            '  50%     { box-shadow: 0 0 0 12px rgba(249,199,79,0.15), 0 0 32px 8px rgba(249,199,79,0.6); }',
            '}',
            '.__mascot-guide-overlay {',
            '  position: fixed; inset: 0; z-index: 998;',
            '  background: rgba(0,0,0,0.25);',
            '  pointer-events: none;',
            '  opacity: 0; transition: opacity 0.3s;',
            '}',
            '.__mascot-guide-overlay.show { opacity: 1; }',
            '.__mascot-guide-nav {',
            '  position: fixed; bottom: 24px; left: 226px; z-index: 10002;',
            '  display: flex; gap: 8px; align-items: center;',
            '}',
            '.__mascot-guide-btn {',
            '  background: #2d6a4f; color: #fff; border: none;',
            '  border-radius: 20px; padding: 6px 14px;',
            '  font-size: 12px; font-weight: 700; cursor: pointer;',
            '  box-shadow: 0 2px 8px rgba(0,0,0,0.15);',
            '  transition: background 0.2s;',
            '}',
            '.__mascot-guide-btn:hover { background: #40916c; }',
            '.__mascot-guide-btn.skip { background: #aaa; }',
            '.__mascot-guide-btn.skip:hover { background: #888; }',
            '.__mascot-guide-step-label {',
            '  font-size: 11px; color: #fff; background: rgba(0,0,0,0.45);',
            '  border-radius: 12px; padding: 3px 10px; font-weight: 600;',
            '}',
        ].join('');
        document.head.appendChild(s);
    })();

    // ── Flow definitions theo từng trang ─────────────────────────────────────
    var GUIDE_FLOWS = {

        '/booking': [
            { selector: '.form-group-page:nth-child(1)', msg: 'Bước 1: Nhập tên chủ nuôi của bạn nhé 📝', pose: 'curious' },
            { selector: 'input[type="date"]',             msg: 'Bước 2: Chọn ngày bạn muốn hẹn 📅', pose: 'curious' },
            { selector: 'select.form-select-page:last-of-type', msg: 'Bước 3: Chọn dịch vụ cần đăng ký 💉', pose: 'curious' },
            { selector: '.booking-submit-btn',            msg: 'Xong rồi! Nhấn đặt lịch thôi nào 🎉', pose: 'happy' },
        ],

        '/adopt': [
            { selector: '#speciesFilter',     msg: 'Bước 1: Lọc theo loài — mèo hay chó? 🐾', pose: 'curious' },
            { selector: '#searchInput',        msg: 'Bước 2: Tìm theo tên bé nếu bạn đã biết 🔍', pose: 'curious' },
            { selector: '#petsListContainer',  msg: 'Bước 3: Đây là danh sách bé đang chờ gia đình 🏠', pose: 'happy' },
        ],

        '/adopt-detail': [
            { selector: '.pet-image-section',  msg: 'Đây là ảnh của bé — nhìn cute không? 🥺', pose: 'happy' },
            { selector: '#petDetailApiLoading', fallback: '.pet-info, main', msg: 'Xem thông tin chi tiết của bé nhé 📋', pose: 'curious' },
            { selector: '.btn-adopt, button[onclick*="adopt"], .adopt-btn', fallback: 'main', msg: 'Muốn nhận nuôi? Nhấn nút để liên hệ nha! 💚', pose: 'happy' },
        ],

        '/news': [
            { selector: '#featuredSection',   msg: 'Đây là bài nổi bật hôm nay 📰', pose: 'happy' },
            { selector: '#newsGrid',           msg: 'Cuộn xuống để xem thêm tin tức nhé~', pose: 'curious' },
            { selector: '#btnDangTin',         msg: 'Muốn đăng bài? Bấm vào đây nha! ✍️', pose: 'like', skipIfHidden: true },
        ],

        '/news-detail': [
            { selector: '#articleTitle',       msg: 'Đây là tiêu đề bài viết 📖', pose: 'idle' },
            { selector: '#btnLike',            msg: 'Thích bài này? Nhấn tim ủng hộ tác giả nhé! 💚', pose: 'like' },
            { selector: '#commentInputArea',   msg: 'Bình luận để chia sẻ cảm nghĩ của bạn nha 💬', pose: 'curious' },
        ],

        '/': [
            { selector: '.bulletin-featured, #homeFeaturedCard', msg: 'Đây là tin nổi bật mới nhất 📰', pose: 'happy' },
            { selector: 'nav.main-nav, .main-nav',               msg: 'Dùng menu để khám phá các tính năng nha 🗺️', pose: 'curious' },
            { selector: '#cart-count-display',                   msg: 'Giỏ hàng của bạn ở đây — mua đồ cho bé thôi! 🛒', pose: 'like' },
        ],

        '/shop': [
            { selector: '.shop-filter-pills', msg: 'Bước 1: Lọc theo loại sản phẩm ở đây nha 🔍', pose: 'curious' },
            { selector: '#searchInput',        msg: 'Bước 2: Hoặc tìm theo tên sản phẩm cụ thể 🔎', pose: 'curious' },
            { selector: '#shopGrid',           msg: 'Bước 3: Đây là danh sách sản phẩm — nhấn để xem chi tiết và thêm vào giỏ nha! 🛒', pose: 'like' },
            { selector: '#cart-count-display', msg: 'Bước 4: Giỏ hàng của bạn — nhấn vào đây để xem và thanh toán 💳', pose: 'happy' },
        ],
    };

    // ── Guide engine ──────────────────────────────────────────────────────────
    var _guideActive = false;
    var _guideStep   = 0;
    var _guideFlow   = [];
    var _guideOverlay = null;
    var _guideNav    = null;

    function findEl(step) {
        var el = document.querySelector(step.selector);
        if (!el && step.fallback) el = document.querySelector(step.fallback);
        if (el && step.skipIfHidden && el.offsetParent === null) return null;
        return el;
    }

    function guideHighlight(el) {
        document.querySelectorAll('.__mascot-highlight').forEach(function(e) {
            e.classList.remove('__mascot-highlight');
        });
        if (el) {
            el.classList.add('__mascot-highlight');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function guideShowStep(idx) {
        if (idx >= _guideFlow.length) { guideEnd(); return; }
        var step = _guideFlow[idx];
        var el   = findEl(step);

        // Nếu không tìm thấy element → skip sang bước tiếp
        if (!el) { guideShowStep(idx + 1); return; }

        _guideStep = idx;
        guideHighlight(el);
        setExpression(step.pose || 'curious');
        showBubble(step.msg, 0); // duration=0 → không tự ẩn, chờ user bấm Next

        // Cập nhật nav
        if (_guideNav) {
            var label = _guideNav.querySelector('.__mascot-guide-step-label');
            var nextBtn = _guideNav.querySelector('.__mascot-guide-btn:not(.skip)');
            if (label) label.textContent = (idx + 1) + ' / ' + _guideFlow.length;
            if (nextBtn) nextBtn.textContent = idx === _guideFlow.length - 1 ? 'Xong ✓' : 'Tiếp →';
        }
    }

    function guideEnd() {
        _guideActive = false;
        document.querySelectorAll('.__mascot-highlight').forEach(function(e) {
            e.classList.remove('__mascot-highlight');
        });
        if (_guideOverlay) { _guideOverlay.classList.remove('show'); }
        if (_guideNav) { _guideNav.remove(); _guideNav = null; }
        hideBubble();
        setExpression('happy');
        setTimeout(function() {
            showBubble('Hướng dẫn xong rồi! Bắt đầu thôi nào 🎉', 3500);
            setTimeout(function() { setExpression('idle'); }, 4000);
        }, 300);
    }

    function guideStart(pageKey) {
        var flow = GUIDE_FLOWS[pageKey];
        if (!flow || !flow.length || _guideActive) return;
        _guideActive = true;
        _guideFlow   = flow;
        _guideStep   = 0;

        // Overlay
        if (!_guideOverlay) {
            _guideOverlay = document.createElement('div');
            _guideOverlay.className = '__mascot-guide-overlay';
            document.body.appendChild(_guideOverlay);
        }
        _guideOverlay.classList.add('show');

        // Nav buttons
        if (_guideNav) _guideNav.remove();
        _guideNav = document.createElement('div');
        _guideNav.className = '__mascot-guide-nav';
        _guideNav.innerHTML =
            '<span class="__mascot-guide-step-label">1 / ' + flow.length + '</span>' +
            '<button class="__mascot-guide-btn skip">Bỏ qua</button>' +
            '<button class="__mascot-guide-btn">Tiếp →</button>';
        _guideNav.querySelector('.__mascot-guide-btn.skip').onclick = guideEnd;
        _guideNav.querySelector('.__mascot-guide-btn:not(.skip)').onclick = function() {
            guideShowStep(_guideStep + 1);
        };
        document.body.appendChild(_guideNav);

        guideShowStep(0);
    }

    // Public API — Quick Action Panel gọi, trang ngoài cũng có thể gọi
    window.__mascotGuide = function(pageKey) {
        var key = pageKey || getPageKey();
        if (!GUIDE_FLOWS[key]) {
            showBubble('Chưa có hướng dẫn cho trang này, mình sẽ cập nhật sớm nhé! 🐾', 3000);
            return;
        }
        guideStart(key);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
} // end guard
// ─────────────────────────────────────────────────────────────────────────────
