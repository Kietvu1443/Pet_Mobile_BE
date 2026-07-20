(function () {
  if (window.__authOverlayLoaderInitialized) {
    return;
  }
  window.__authOverlayLoaderInitialized = true;
  
  // Tải SimpleWebAuthn Browser SDK động nếu chưa có
  if (!window.SimpleWebAuthnBrowser) {
    if (!document.querySelector('script[src*="@simplewebauthn/browser"]')) {
      var swaScript = document.createElement("script");
      swaScript.src = "https://cdn.jsdelivr.net/npm/@simplewebauthn/browser/dist/bundle/index.umd.min.js";
      swaScript.async = true;
      document.head.appendChild(swaScript);
    }
  }

  // ─── Tải cấu hình và tích hợp SDK Google & Facebook động ───
  fetch("/api/v1/auth/config")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data && data.success && data.data) {
        window.GOOGLE_CLIENT_ID = data.data.googleClientId;
        window.FACEBOOK_APP_ID = data.data.facebookAppId;

        // Tải Google Client SDK động nếu có GOOGLE_CLIENT_ID hợp lệ
        if (window.GOOGLE_CLIENT_ID && !window.GOOGLE_CLIENT_ID.includes("YOUR_")) {
          if (!document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
            var gScript = document.createElement("script");
            gScript.src = "https://accounts.google.com/gsi/client";
            gScript.async = true;
            gScript.defer = true;
            document.head.appendChild(gScript);
          }
        }

        // Tải Facebook Client SDK động nếu có FACEBOOK_APP_ID hợp lệ
        if (window.FACEBOOK_APP_ID && !window.FACEBOOK_APP_ID.includes("YOUR_")) {
          if (!document.querySelector('script[src*="connect.facebook.net"]')) {
            (function (d, s, id) {
              var js, fjs = d.getElementsByTagName(s)[0];
              if (d.getElementById(id)) return;
              js = d.createElement(s); js.id = id;
              js.src = "https://connect.facebook.net/vi_VN/sdk.js";
              fjs.parentNode.insertBefore(js, fjs);
            }(document, "script", "facebook-jssdk"));

            window.fbAsyncInit = function () {
              FB.init({
                appId: window.FACEBOOK_APP_ID,
                cookie: true,
                xfbml: true,
                version: "v18.0"
              });
            };
          }
        }
      }
    })
    .catch(function (err) {
      console.error("[Auth Overlay Loader] Failed to load config:", err);
    });

  var mount = document.getElementById("auth-overlay-mount") || document.body;
  if (!mount) {
    return;
  }

  var loadOverlay = async function () {
    try {
      if (document.getElementById("auth-overlay")) {
        return;
      }

      var response = await fetch("/components/auth-overlay.html", {
        method: "GET",
        credentials: "same-origin",
      });

      if (!response.ok) {
        return;
      }

      var html = await response.text();
      var template = document.createElement("template");
      template.innerHTML = html;

      var fragment = template.content.cloneNode(true);
      var scripts = Array.from(fragment.querySelectorAll("script"));
      scripts.forEach(function (script) {
        script.remove();
      });

      mount.appendChild(fragment);

      scripts.forEach(function (oldScript) {
        var script = document.createElement("script");
        if (oldScript.src) {
          script.src = oldScript.src;
        } else {
          script.textContent = oldScript.textContent;
        }
        document.body.appendChild(script);
      });

      window.__authOverlayLoaded = true;
      var readyEvent = new Event("auth-overlay:ready");
      window.dispatchEvent(readyEvent);
      document.dispatchEvent(readyEvent);
    } catch (error) {
      console.error("[Auth Overlay Loader] Failed to load overlay:", error);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadOverlay);
  } else {
    loadOverlay();
  }
})();
