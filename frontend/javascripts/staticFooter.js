function fallbackPetImage(img, id) {
  img.onerror = null;
  img.src = "/images/the_logo.webp";
}

function isImageBackgroundValue(val) {
  return !!val && !/^(#|rgb\(|rgba\(|hsl\(|hsla\(|transparent$|inherit$|initial$|unset$)/i.test(val);
}

// ── Apply User Background ──────────────────────────────────
window.applyUserBackground = function (val) {
  var styleId = "__user_bg_style";
  var el = document.getElementById(styleId);
  if (!el) {
    el = document.createElement("style");
    el.id = styleId;
    document.head.appendChild(el);
  }
  if (!val) {
    el.textContent = "";
    return;
  }
  var bgRule = isImageBackgroundValue(val)
    ? 'background-image:url("' +
      val +
      '")!important;background-size:cover!important;background-attachment:fixed!important;background-repeat:no-repeat!important;background-position:center!important;background-color:transparent!important;'
    : "background-color:" + val + "!important;background-image:none!important;";

  // Transparent toàn bộ wrapper phổ biến để lộ body bg
  el.textContent = [
    "body{" + bgRule + "}",
    "main,#main,.main,.profile-page,.page-wrapper,.page-body,.content-wrapper,.container-fluid,.app-content,.site-content,.page-content,.adopt-page,.pets-section,.reports-page,.favorites-page,.admin-page{background:transparent!important;}",
  ].join("");
};

// Auto-apply sau khi toàn bộ CSS load xong
window.addEventListener("load", function () {
  fetch("/api/v1/auth/me", { credentials: "include" })
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (data) {
      if (
        data &&
        data.success &&
        data.data &&
        data.data.user &&
        data.data.user.bg_preference
      ) {
        window.applyUserBackground(data.data.user.bg_preference);
      }
    })
    .catch(function () {});
});

// ── Zalo Chat Button ───────────────────────────────────────
(function () {
  var style = document.createElement("style");
  style.textContent = [
    ".zalo-chat-btn {",
    "    position: fixed;",
    "    bottom: 24px;",
    "    right: 24px;",
    "    width: 56px;",
    "    height: 56px;",
    "    background: #0068ff;",
    "    border-radius: 50%;",
    "    display: flex;",
    "    align-items: center;",
    "    justify-content: center;",
    "    cursor: pointer;",
    "    box-shadow: 0 4px 16px rgba(0,104,255,0.4);",
    "    z-index: 9999;",
    "    transition: transform 0.2s, box-shadow 0.2s;",
    "    text-decoration: none;",
    "}",
    ".zalo-chat-btn:hover {",
    "    transform: scale(1.1);",
    "    box-shadow: 0 6px 24px rgba(0,104,255,0.5);",
    "}",
    ".zalo-chat-btn img { width: 36px; height: 36px; }",
    ".zalo-chat-tooltip {",
    "    position: fixed;",
    "    bottom: 90px;",
    "    right: 24px;",
    "    background: #fff;",
    "    color: #333;",
    "    font-size: 13px;",
    "    font-weight: 600;",
    "    padding: 8px 14px;",
    "    border-radius: 20px;",
    "    box-shadow: 0 4px 16px rgba(0,0,0,0.12);",
    "    white-space: nowrap;",
    "    opacity: 0;",
    "    pointer-events: none;",
    "    transition: opacity 0.2s;",
    "    z-index: 9998;",
    "}",
    ".zalo-chat-btn:hover + .zalo-chat-tooltip { opacity: 1; }",
  ].join("");
  document.head.appendChild(style);

  var btn = document.createElement("a");
  btn.className = "zalo-chat-btn";
  btn.href = "https://zalo.me/0969667746";
  btn.target = "_blank";
  btn.rel = "noopener noreferrer";
  btn.title = "Chat Zalo với Pet Helper";
  btn.innerHTML =
    '<img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg" alt="Zalo">';

  var tooltip = document.createElement("div");
  tooltip.className = "zalo-chat-tooltip";
  tooltip.textContent = "💬 Chat Zalo với chúng tôi";

  document.body.appendChild(btn);
  document.body.appendChild(tooltip);
})();
