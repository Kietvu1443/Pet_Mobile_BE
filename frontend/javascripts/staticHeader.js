// handleLogout, mobile nav, scroll FX defined OUTSIDE guard below
if (window.__staticHeaderInitialized) {
  // Đã load rồi, không chạy lại
} else {
  window.__staticHeaderInitialized = true;

  (function () {
    if (document.querySelector('link[rel~="icon"]')) return;
    var favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = "/images/favicon.png";
    document.head.appendChild(favicon);
  })();

  if (!window.applyUserBackground) {
    function isImageBackgroundValue(bg) {
      return (
        !!bg &&
        !/^(#|rgb\(|rgba\(|hsl\(|hsla\(|transparent$|inherit$|initial$|unset$)/i.test(
          bg,
        )
      );
    }

    window.applyUserBackground = function (bg) {
      if (!bg) {
        document.body.style.backgroundColor = "";
        document.body.style.backgroundImage = "";
        return;
      }
      if (isImageBackgroundValue(bg)) {
        document.body.style.backgroundImage = "url(" + bg + ")";
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundPosition = "center";
        document.body.style.backgroundAttachment = "fixed";
        document.body.style.backgroundColor = "";
      } else {
        document.body.style.backgroundColor = bg;
        document.body.style.backgroundImage = "";
      }
    };
  }

  const userDropdownBtn = document.getElementById("userDropdownBtn");
  const userDropdown =
    document.getElementById("headerUserDropdown") ||
    document.querySelector(".user-dropdown");
  const nativeFetch =
    window.__petHelperNativeFetch || window.fetch.bind(window);

  if (!window.__petHelperNativeFetch) {
    window.__petHelperNativeFetch = nativeFetch;
  }

  if (userDropdownBtn && userDropdown) {
    userDropdownBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isActive = userDropdown.classList.contains("active");

      document.querySelectorAll(".user-dropdown.active").forEach((dropdown) => {
        dropdown.classList.remove("active");
      });

      if (!isActive) {
        userDropdown.classList.add("active");
      }
    });

    const dropdownMenu = userDropdown.querySelector(".user-dropdown-menu");

    if (dropdownMenu) {
      dropdownMenu.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }

    document.addEventListener("click", () => {
      userDropdown.classList.remove("active");
    });
  }

  (function () {
    const authUserState = document.getElementById("headerAuthUserState");
    const authGuestState = document.getElementById("headerAuthGuestState");

    if (!authUserState || !authGuestState) {
      return;
    }

    // ── BƯỚC 1: Inject dropdown chuẩn TRƯỚC — đồng bộ tất cả trang ──────
    (function () {
      const menu = document.getElementById("userDropdownMenu");
      if (!menu) return;
      menu.innerHTML = [
        '<div class="dropdown-header">',
        '<strong id="headerDropdownDisplayName">Tài khoản</strong>',
        '<span class="user-role" id="headerUserRole">&#128100; User</span>',
        "</div>",
        '<div class="dropdown-divider"></div>',
        '<a href="/profile" class="dropdown-item">&#128100; Tài khoản</a>',
        '<a href="/my-favorites" class="dropdown-item">&#10084;&#65039; Thú cưng đã yêu thích</a>',
        '<a href="/my-reports" class="dropdown-item">&#128203; Hoạt động của tôi</a>',
        '<a href="/adopt/admin/add" class="dropdown-item role-staff-only is-auth-hidden">&#128062; Thêm thú cưng</a>',
        '<a href="/admin/reports" class="dropdown-item role-staff-only is-auth-hidden">&#128450;&#65039; Duyệt báo cáo</a>',

        '<a href="/admin" class="dropdown-item role-staff-only is-auth-hidden">&#9881;&#65039; Quản trị</a>',
        '<a href="/admin-shop" class="dropdown-item role-staff-only is-auth-hidden">&#128722; Quản lý cửa hàng</a>',
        '<div class="dropdown-divider"></div>',
        '<a href="javascript:void(0)" onclick="window.handleLogout(event)" class="dropdown-item">&#x1F6AA; Đăng xuất</a>',
      ].join("");
    })();
    // ─────────────────────────────────────────────────────────────────────

    // ── BƯỚC 2: Query elements SAU khi inject ────────────────────────────
    const displayNameText = document.getElementById("headerDisplayNameText");
    const dropdownDisplayName = document.getElementById(
      "headerDropdownDisplayName",
    );
    const userRoleText = document.getElementById("headerUserRole");
    // ─────────────────────────────────────────────────────────────────────

    const roleLabel = (role) => {
      if (role === 0) return "&#128081; Admin";
      if (role === 1) return "&#128296; Staff";
      return "&#128100; User";
    };

    const hideRoleLinks = () => {
      document.querySelectorAll(".role-staff-only").forEach((link) => {
        link.classList.add("is-auth-hidden");
        link.classList.remove("is-auth-visible");
      });
      document.querySelectorAll(".role-admin-only").forEach((link) => {
        link.classList.add("is-auth-hidden");
        link.classList.remove("is-auth-visible");
      });
    };

    const showRoleLinksForRole = (role) => {
      hideRoleLinks();
      if (role === 0 || role === 1) {
        document.querySelectorAll(".role-staff-only").forEach((link) => {
          link.classList.remove("is-auth-hidden");
          link.classList.add("is-auth-visible");
        });
      }
      if (role === 0) {
        document.querySelectorAll(".role-admin-only").forEach((link) => {
          link.classList.remove("is-auth-hidden");
          link.classList.add("is-auth-visible");
        });
      }
    };

    const showGuest = () => {
      authUserState.classList.add("is-auth-hidden");
      authUserState.classList.remove("is-auth-visible");
      authGuestState.classList.remove("is-auth-hidden");
      authGuestState.classList.add("is-auth-visible");
      hideRoleLinks();
      if (userDropdown) {
        userDropdown.classList.remove("active");
      }
    };

    const showUser = (user) => {
      const safeName =
        user && user.display_name ? user.display_name : "Tài khoản";
      const safeRoleValue =
        user && typeof user.role === "number" ? user.role : 2;
      const safeRole = roleLabel(safeRoleValue);

      if (displayNameText) {
        // Nếu có avatar thì hiện ảnh nhỏ kèm tên
        if (user && user.avatar) {
          displayNameText.innerHTML =
            '<img src="' +
            user.avatar +
            '" style="display:inline-block;width:28px;height:28px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:6px;border:2px solid rgba(255,255,255,0.6)">' +
            safeName;
        } else {
          displayNameText.textContent = safeName;
        }
      }
      if (dropdownDisplayName) {
        dropdownDisplayName.textContent = safeName;
      }
      if (userRoleText) {
        userRoleText.innerHTML = safeRole;
      }

      authUserState.classList.remove("is-auth-hidden");
      authUserState.classList.add("is-auth-visible");
      authGuestState.classList.add("is-auth-hidden");
      authGuestState.classList.remove("is-auth-visible");
      showRoleLinksForRole(safeRoleValue);

      // Bắt đầu ca mới nếu là admin hoặc staff
      if (safeRoleValue === 0 || safeRoleValue === 1) {
        fetch("/api/orders/admin/session/start", {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
      }

      // Apply background nếu user có preference
      if (user && user.bg_preference) {
        window.applyUserBackground(user.bg_preference);
      }
    };

    // Cho phép profile.html gọi để update avatar real-time
    window.applyHeaderAvatar = function (avatarSrc) {
      if (displayNameText && avatarSrc) {
        const name = displayNameText.textContent || "Tài khoản";
        displayNameText.innerHTML =
          '<img src="' +
          avatarSrc +
          '" style="display:inline-block;width:28px;height:28px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:6px;border:2px solid rgba(255,255,255,0.6)">' +
          name;
      }
    };

    const normalizeAuthTab = (tab) => {
      return tab === "register" ? "register" : "login";
    };

    if (!window.__pendingAuthOverlayTab) {
      window.__pendingAuthOverlayTab = "login";
    }

    const openAuthOverlaySafely = (tab = "login") => {
      const targetTab = normalizeAuthTab(tab || window.__pendingAuthOverlayTab);
      window.__pendingAuthOverlayTab = targetTab;

      if (window.__authOverlayOpenRequested) {
        if (typeof window.overlayActivateTab === "function") {
          window.overlayActivateTab(targetTab);
        }
        return;
      }

      const tryOpenOverlay = () => {
        const overlay = document.getElementById("auth-overlay");
        if (
          !overlay ||
          typeof window.openOverlay !== "function" ||
          window.openOverlay.__petHelperOverlayStub
        ) {
          return false;
        }

        if (!overlay.classList.contains("active")) {
          window.openOverlay("auth-overlay");
        }
        if (typeof window.overlayActivateTab === "function") {
          window.overlayActivateTab(targetTab);
        }

        window.__authOverlayOpenRequested = true;
        return true;
      };

      if (!tryOpenOverlay()) {
        window.__pendingAuthOverlayOpen = true;
      }
    };

    const openLoginOverlaySafely = () => {
      openAuthOverlaySafely("login");
    };

    const resetOverlayOpenGuard = () => {
      window.__authOverlayOpenRequested = false;
    };

    const handleOverlayReady = () => {
      if (!window.__pendingAuthOverlayOpen) {
        return;
      }
      window.__pendingAuthOverlayOpen = false;
      openAuthOverlaySafely(window.__pendingAuthOverlayTab || "login");
    };

    if (!window.__authOverlayReadyListenerAttached) {
      window.__authOverlayReadyListenerAttached = true;
      window.addEventListener("auth-overlay:ready", handleOverlayReady);
      document.addEventListener("auth-overlay:ready", handleOverlayReady);
    }

    if (!window.__petHelperUnauthorizedErrorClass) {
      window.__petHelperUnauthorizedErrorClass = class UnauthorizedApiError extends (
        Error
      ) {
        constructor(message) {
          super(message || "Vui lòng đăng nhập tài khoản");
          this.name = "UnauthorizedApiError";
          this.code = 401;
        }
      };
    }

    const getRequestPath = (input) => {
      try {
        if (typeof input === "string") {
          return new URL(input, window.location.origin).pathname;
        }
        if (input && typeof input.url === "string") {
          return new URL(input.url, window.location.origin).pathname;
        }
      } catch (error) {
        return "";
      }
      return "";
    };

    const shouldHandleUnauthorized = (input, init) => {
      if (init && init.__skipUnauthorizedHandler) {
        return false;
      }
      const requestPath = getRequestPath(input);
      if (!requestPath.startsWith("/api/v1/")) {
        return false;
      }
      if (
        requestPath === "/api/v1/auth/login" ||
        requestPath === "/api/v1/auth/register" ||
        requestPath === "/api/v1/auth/me" ||
        requestPath === "/api/v1/auth/logout"
      ) {
        return false;
      }
      return true;
    };

    const rejectUnauthorized = async (response, fallbackMessage) => {
      let message = fallbackMessage || "Vui lòng đăng nhập tài khoản";
      try {
        const payload = await response.clone().json();
        if (payload && (payload.message || payload.error)) {
          message = payload.message || payload.error;
        }
      } catch (error) {
        // Keep fallback message when payload cannot be parsed.
      }
      showGuest();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      openLoginOverlaySafely();
      throw new window.__petHelperUnauthorizedErrorClass(message);
    };

    if (!window.__petHelperUnauthorizedHandler) {
      window.__petHelperUnauthorizedHandler = rejectUnauthorized;
    }

    if (!window.openLoginOverlaySafely) {
      window.openLoginOverlaySafely = openLoginOverlaySafely;
    }

    if (!window.openAuthOverlaySafely) {
      window.openAuthOverlaySafely = openAuthOverlaySafely;
    }

    if (typeof window.openOverlay !== "function") {
      const openOverlayStub = (id) => {
        if (id === "auth-overlay") {
          window.__pendingAuthOverlayOpen = true;
        }
      };
      openOverlayStub.__petHelperOverlayStub = true;
      window.openOverlay = openOverlayStub;
    }

    if (typeof window.overlayActivateTab !== "function") {
      window.overlayActivateTab = (tabName) => {
        window.__pendingAuthOverlayTab = normalizeAuthTab(tabName);
      };
    }

    if (!window.resetLoginOverlayGuard) {
      window.resetLoginOverlayGuard = resetOverlayOpenGuard;
    }

    if (!window.apiFetch) {
      window.apiFetch = async (input, init = {}) => {
        const fetchOptions = {
          credentials: "include",
          ...init,
        };
        const response = await nativeFetch(input, fetchOptions);
        if (
          response.status === 401 &&
          shouldHandleUnauthorized(input, fetchOptions)
        ) {
          await rejectUnauthorized(response);
        }
        return response;
      };
    }

    if (!window.__authFetchInterceptorInitialized) {
      window.__authFetchInterceptorInitialized = true;
      window.fetch = async (input, init = {}) => {
        const finalInit = {
          credentials: "include",
          ...init,
        };

        let response;

        try {
          response = await nativeFetch(input, finalInit);
        } catch (err) {
          return Promise.reject(err);
        }

        const url =
          typeof input === "string" ? input : (input && input.url) || "";

        // KHÔNG auto logout với auth/me
        if (response.status === 401 && !url.includes("/api/v1/auth/me")) {
          await rejectUnauthorized(response);
        }

        return response;
      };
    }

    window.applyHeaderGuestState = showGuest;
    window.applyHeaderUserState = showUser;

    nativeFetch("/api/v1/auth/me", {
      method: "GET",
      credentials: "include",
    })
      .then(async (response) => {
        // Không ép guest nếu request lỗi
        if (!response.ok) {
          return;
        }

        let payload = null;

        try {
          payload = await response.json();
        } catch (error) {
          return;
        }

        if (payload && payload.success && payload.data && payload.data.user) {
          showUser(payload.data.user);
        }
      })
      .catch(() => {
        // Keep default guest/auth state on network error.
      });
  })();
} // end __staticHeaderInitialized guard

// ── HANDLELOGOUT — ngoài guard để luôn available dù file load nhiều lần ──────
if (!window.handleLogout) {
  window.handleLogout = async function handleLogout(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();

    if (window.__logoutInFlight) return;
    window.__logoutInFlight = true;

    const authUserState = document.getElementById("headerAuthUserState");
    const authGuestState = document.getElementById("headerAuthGuestState");
    const _userDropdown =
      document.getElementById("headerUserDropdown") ||
      document.querySelector(".user-dropdown");

    const applyLoggedOutUiState = () => {
      if (authUserState) {
        authUserState.classList.add("is-auth-hidden");
        authUserState.classList.remove("is-auth-visible");
      }
      if (authGuestState) {
        authGuestState.classList.remove("is-auth-hidden");
        authGuestState.classList.add("is-auth-visible");
      }
      if (_userDropdown) {
        _userDropdown.classList.remove("active");
      }
    };

    applyLoggedOutUiState();
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    const _nativeFetch =
      window.__petHelperNativeFetch || window.fetch.bind(window);

    try {
      await fetch("/api/orders/admin/session/end", {
        method: "POST",
        credentials: "include",
        __skipUnauthorizedHandler: true,
      }).catch(() => {});

      await _nativeFetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
        __skipUnauthorizedHandler: true,
      });
    } catch (apiError) {
      // Always continue logout flow for UI consistency.
    }

    window.__logoutInFlight = false;

    if (window.location.pathname !== "/") {
      window.location.href = "/";
      return;
    }

    window.location.reload();
  };
}
// ─────────────────────────────────────────────────────────────────────────────

// ── MOBILE NAV — ngoài guard, tự có guard riêng ──────────────────────────────
(function () {
  if (window.__mobileNavInitialized) return;
  window.__mobileNavInitialized = true;

  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const mainNav = document.getElementById("mainNav");
  const overlay = document.getElementById("mobileNavOverlay");
  const closeBtn = document.getElementById("mobileNavClose");

  if (!mainNav || !overlay) return;

  function openMenu() {
    mainNav.classList.add("mobile-open");
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeMenu() {
    mainNav.classList.remove("mobile-open");
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  if (hamburgerBtn) hamburgerBtn.addEventListener("click", openMenu);
  overlay.addEventListener("click", closeMenu);
  if (closeBtn) closeBtn.addEventListener("click", closeMenu);

  document.querySelectorAll(".main-nav .has-dropdown").forEach((link) => {
    link.addEventListener("click", function (e) {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        const dropdown = this.nextElementSibling;
        if (dropdown && dropdown.classList.contains("nav-dropdown")) {
          dropdown.classList.toggle("mobile-show");
          document
            .querySelectorAll(".nav-dropdown.mobile-show")
            .forEach((shown) => {
              if (shown !== dropdown) shown.classList.remove("mobile-show");
            });
        }
      }
    });
  });
})();
// ─────────────────────────────────────────────────────────────────────────────

// ── SCROLL FX — ngoài guard, tự có guard riêng ───────────────────────────────
(function () {
  if (window.__headerScrollFxInitialized) return;
  window.__headerScrollFxInitialized = true;

  const headerEl = document.querySelector("header.header");
  if (!headerEl) return;

  const updateScrolledState = () => {
    headerEl.classList.toggle("header-scrolled", window.scrollY > 20);
  };

  window.addEventListener("scroll", updateScrolledState, { passive: true });
  updateScrolledState();
})();
// ─────────────────────────────────────────────────────────────────────────────

// ── GLOBAL CART SYSTEM (chạy mọi trang có header) ───────────────────────────
(function () {
  if (window.__phCartInitialized) return;
  window.__phCartInitialized = true;

  const CART_KEY = "ph_cart";

  // ── 1. Inject CSS cart sidebar (chỉ 1 lần) ───────────────────────────────
  if (!document.getElementById("__phCartStyle")) {
    var style = document.createElement("style");
    style.id = "__phCartStyle";
    style.textContent = [
      ".ph-cart-overlay-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:4100;}",
      ".ph-cart-overlay-bg.open{display:block;}",
      ".ph-cart-sidebar{position:fixed;top:0;right:-440px;width:420px;max-width:100vw;height:100%;background:#fff;z-index:4200;transition:right 0.28s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;box-shadow:-4px 0 24px rgba(0,0,0,0.12);}",
      ".ph-cart-sidebar.open{right:0;}",
      ".ph-cart-head{background:#2d6a4f;color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}",
      ".ph-cart-head h3{font-size:1.05rem;font-weight:800;margin:0;}",
      ".ph-cart-close{background:rgba(255,255,255,0.2);border:none;color:#fff;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s;}",
      ".ph-cart-close:hover{background:#e74c3c;}",
      ".ph-cart-items{flex:1;overflow-y:auto;padding:12px;}",
      ".ph-cart-empty{text-align:center;color:#aaa;padding:40px 20px;font-size:0.95rem;}",
      ".ph-cart-row{display:flex;align-items:center;gap:10px;padding:10px 8px;border-bottom:1px solid #f0f0f0;}",
      ".ph-cart-img{width:52px;height:52px;object-fit:cover;border-radius:8px;background:#eee;flex-shrink:0;}",
      ".ph-cart-info{flex:1;min-width:0;}",
      ".ph-cart-name{font-weight:700;font-size:0.88rem;color:#1b4332;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".ph-cart-price{font-size:0.82rem;color:#c0392b;font-weight:700;}",
      ".ph-cart-qty{display:flex;align-items:center;gap:6px;flex-shrink:0;}",
      ".ph-qty-btn{width:26px;height:26px;border:1px solid #c8e6c9;background:#f8fcf9;border-radius:6px;cursor:pointer;font-size:1rem;font-weight:700;color:#2d6a4f;display:flex;align-items:center;justify-content:center;transition:background 0.15s;}",
      ".ph-qty-btn:hover{background:#b7e4c7;}",
      ".ph-qty-num{font-weight:700;font-size:0.9rem;min-width:20px;text-align:center;}",
      ".ph-cart-footer{border-top:1px solid #eee;padding:16px 18px;flex-shrink:0;}",
      ".ph-cart-total-row{display:flex;justify-content:space-between;font-weight:800;font-size:1.05rem;margin-bottom:14px;}",
      ".ph-cart-total-price{color:#c0392b;}",
      ".ph-cart-checkout-btn{width:100%;padding:12px;background:#2d6a4f;color:#fff;border:none;border-radius:9px;font-weight:800;font-size:1rem;cursor:pointer;transition:background 0.15s;}",
      ".ph-cart-checkout-btn:hover{background:#1b4332;}",
      ".ph-cart-checkout-btn:disabled{opacity:0.5;cursor:not-allowed;}",
      "@media(max-width:480px){.ph-cart-sidebar{width:100vw;}}",
    ].join("");
    document.head.appendChild(style);
  }

  // ── 2. Inject HTML sidebar (chỉ 1 lần, sau DOMContentLoaded) ─────────────
  function injectCartHTML() {
    if (document.getElementById("__phCartSidebar")) return;

    // Không inject nếu trang đã có cart sidebar riêng (index, shop)
    if (
      document.getElementById("cartSidebar") ||
      document.getElementById("cart-sidebar")
    )
      return;

    var bg = document.createElement("div");
    bg.className = "ph-cart-overlay-bg";
    bg.id = "__phCartBg";
    bg.onclick = function () {
      window.phCloseCart();
    };

    var sidebar = document.createElement("div");
    sidebar.className = "ph-cart-sidebar";
    sidebar.id = "__phCartSidebar";
    sidebar.innerHTML = [
      '<div class="ph-cart-head">',
      "  <h3>🛒 Giỏ hàng</h3>",
      '  <button class="ph-cart-close" onclick="window.phCloseCart()">✕</button>',
      "</div>",
      '<div class="ph-cart-items" id="__phCartItems"><div class="ph-cart-empty">🛒 Giỏ hàng trống</div></div>',
      '<div class="ph-cart-footer">',
      '  <div class="ph-cart-total-row"><span>Tổng cộng:</span><span class="ph-cart-total-price" id="__phCartTotal">0đ</span></div>',
      '  <button class="ph-cart-checkout-btn" id="__phCartCheckout" onclick="window.location.href=\'/shop?checkout=1\'" disabled>Thanh toán</button>',
      "</div>",
    ].join("");

    document.body.appendChild(bg);
    document.body.appendChild(sidebar);
  }

  // ── 3. Helpers ────────────────────────────────────────────────────────────
  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCart();
    updateBadges();
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── 4. Render sidebar ─────────────────────────────────────────────────────
  function renderCart() {
    // Nếu trang có cart riêng (index) thì dùng hàm của nó
    if (typeof window.indexUpdateCartUI === "function") {
      window.indexUpdateCartUI();
      return;
    }

    var wrap = document.getElementById("__phCartItems");
    var totalEl = document.getElementById("__phCartTotal");
    var checkoutBtn = document.getElementById("__phCartCheckout");
    if (!wrap) return;

    var cart = getCart();
    var total = cart.reduce(function (s, i) {
      return s + i.price * i.qty;
    }, 0);
    var count = cart.reduce(function (s, i) {
      return s + i.qty;
    }, 0);

    if (totalEl) totalEl.textContent = total.toLocaleString("vi-VN") + "đ";
    if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;

    if (cart.length === 0) {
      wrap.innerHTML = '<div class="ph-cart-empty">🛒 Giỏ hàng trống</div>';
      return;
    }

    wrap.innerHTML = cart
      .map(function (item) {
        return (
          '<div class="ph-cart-row">' +
          '<img class="ph-cart-img" src="' +
          esc(item.image || "") +
          '" alt="' +
          esc(item.name) +
          '" onerror="this.src=\'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=100&q=80\'">' +
          '<div class="ph-cart-info">' +
          '  <div class="ph-cart-name">' +
          esc(item.name) +
          "</div>" +
          '  <div class="ph-cart-price">' +
          (item.price * item.qty).toLocaleString("vi-VN") +
          "đ</div>" +
          "</div>" +
          '<div class="ph-cart-qty">' +
          '  <button class="ph-qty-btn" onclick="window.phChangeQty(' +
          item.id +
          ',-1)">−</button>' +
          '  <span class="ph-qty-num">' +
          item.qty +
          "</span>" +
          '  <button class="ph-qty-btn" onclick="window.phChangeQty(' +
          item.id +
          ',1)">+</button>' +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  // ── 5. Badge sync ─────────────────────────────────────────────────────────
  function updateBadges() {
    var cart = getCart();
    var count = cart.reduce(function (s, i) {
      return s + (i.qty || 0);
    }, 0);

    var badgeDisplay = document.getElementById("cart-count-display");
    if (badgeDisplay) badgeDisplay.textContent = "(" + count + ")";

    var badgeShop = document.getElementById("cartBadge");
    if (badgeShop) badgeShop.textContent = count;
  }

  // ── 6. Open / Close ───────────────────────────────────────────────────────
  window.phOpenCart = function () {
    // Nếu trang có cart riêng (index) dùng hàm của nó
    if (typeof window.openCart === "function") {
      window.openCart();
      return;
    }

    var bg = document.getElementById("__phCartBg");
    var sidebar = document.getElementById("__phCartSidebar");
    if (!bg || !sidebar) return;
    renderCart();
    bg.classList.add("open");
    sidebar.classList.add("open");
    document.body.style.overflow = "hidden";
  };

  window.phCloseCart = function () {
    if (typeof window.closeCart === "function") {
      window.closeCart();
      return;
    }

    var bg = document.getElementById("__phCartBg");
    var sidebar = document.getElementById("__phCartSidebar");
    if (bg) bg.classList.remove("open");
    if (sidebar) sidebar.classList.remove("open");
    document.body.style.overflow = "";
  };

  window.phChangeQty = function (id, delta) {
    var cart = getCart();
    var item = cart.find(function (i) {
      return i.id === id;
    });
    if (!item) return;
    item.qty += delta;
    saveCart(
      item.qty <= 0
        ? cart.filter(function (i) {
            return i.id !== id;
          })
        : cart,
    );
  };

  // Expose để shop.html gọi sau saveCart()
  window.phCartUpdateUI = function () {
    updateBadges();
    renderCart();
  };

  // ── 7. Gắn onclick vào badge "Giỏ hàng" header ───────────────────────────
  function attachCartBadgeClick() {
    var badge = document.getElementById("cart-count-display");
    if (!badge) return;
    var cartSpan = badge.parentElement;
    if (
      cartSpan &&
      cartSpan.tagName === "SPAN" &&
      !cartSpan.__phCartClickAttached
    ) {
      cartSpan.__phCartClickAttached = true;
      cartSpan.style.cursor = "pointer";
      cartSpan.addEventListener("click", function () {
        window.phOpenCart();
      });
    }
  }

  // ── 8. Lắng nghe storage (tab khác thay đổi giỏ) ─────────────────────────
  window.addEventListener("storage", function (e) {
    if (e.key === CART_KEY) {
      updateBadges();
      renderCart();
    }
  });

  // ── 9. Init sau DOM ready ─────────────────────────────────────────────────
  function init() {
    injectCartHTML();
    updateBadges();
    attachCartBadgeClick();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
// ─────────────────────────────────────────────────────────────────────────────
// ── MASCOT SYSTEM ─────────────────────────────────────────────────────────────
(function () {
  if (document.getElementById("__mascotScript")) return;
  var s = document.createElement("script");
  s.id = "__mascotScript";
  s.src = "/javascripts/mascot.js";
  document.head.appendChild(s);
})();
// ─────────────────────────────────────────────────────────────────────────────
