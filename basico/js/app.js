// src/lp/behavior.ts
function initPage(root) {
  const cleanups = [];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollBehavior = reduce ? "instant" : "smooth";
  const on = (el, ev, fn, opt) => {
    el.addEventListener(ev, fn, opt);
    cleanups.push(() => el.removeEventListener(ev, fn, opt));
  };
  const rails = Array.from(root.querySelectorAll(".rail"));
  const step = (rail) => rail.firstElementChild.getBoundingClientRect().width + (parseFloat(getComputedStyle(rail).columnGap) || 0);
  root.querySelectorAll("[data-rail]").forEach((button) => {
    button.type = "button";
    on(button, "click", () => {
      const rail = document.getElementById(button.dataset["rail"]);
      rail?.scrollBy({ left: Number(button.dataset["dir"]) * step(rail), behavior: scrollBehavior });
    });
  });
  rails.forEach((rail) => {
    rail.setAttribute("role", "region");
    rail.setAttribute("aria-roledescription", "carrossel");
    rail.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight Home End");
    rail.setAttribute("aria-label", `${rail.getAttribute("aria-label") || "Conteúdo"}. Use as setas para navegar.`);
    const items = Array.from(rail.children);
    items.forEach((item, index) => {
      item.setAttribute("aria-roledescription", "item");
      item.setAttribute("aria-label", `${index + 1} de ${items.length}`);
    });
    const buttons = Array.from(root.querySelectorAll(`[data-rail="${rail.id}"]`));
    const counter = rail.id === "modules" ? rail.parentElement.querySelector(".railfoot .tiny") : null;
    const foot = rail.nextElementSibling;
    const dots = document.createElement("div");
    dots.className = "rail-dots";
    dots.setAttribute("aria-hidden", "true");
    items.forEach(() => dots.appendChild(document.createElement("i")));
    foot?.appendChild(dots);
    cleanups.push(() => dots.remove());
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth - 2;
      buttons.forEach((button) => {
        button.disabled = button.dataset["dir"] === "-1" ? rail.scrollLeft <= 2 : rail.scrollLeft >= max;
      });
      const index = Math.min(items.length - 1, Math.round(rail.scrollLeft / step(rail)));
      const visible = Math.max(1, Math.round(rail.clientWidth / step(rail)));
      if (counter) {
        counter.textContent = `${String(Math.min(items.length, index + visible)).padStart(2, "0")} — ${String(items.length).padStart(2, "0")}`;
      }
      Array.from(dots.children).forEach((dot, dotIndex) => dot.classList.toggle("on", dotIndex === index));
    };
    on(rail, "scroll", update, { passive: true });
    on(window, "resize", update);
    update();
    on(rail, "keydown", (event) => {
      let target = null;
      if (event.key === "ArrowLeft")
        target = rail.scrollLeft - step(rail);
      if (event.key === "ArrowRight")
        target = rail.scrollLeft + step(rail);
      if (event.key === "Home")
        target = 0;
      if (event.key === "End")
        target = rail.scrollWidth - rail.clientWidth;
      if (target === null)
        return;
      event.preventDefault();
      rail.scrollTo({ left: target, behavior: scrollBehavior });
    });
    let down = false;
    let startX = 0;
    let startLeft = 0;
    let moved = false;
    on(rail, "pointerdown", (event) => {
      if (event.pointerType !== "mouse")
        return;
      down = true;
      moved = false;
      startX = event.clientX;
      startLeft = rail.scrollLeft;
    });
    on(window, "pointermove", (event) => {
      if (!down)
        return;
      const delta = event.clientX - startX;
      if (Math.abs(delta) > 4) {
        moved = true;
        rail.classList.add("dragging");
      }
      rail.scrollLeft = startLeft - delta;
    });
    on(window, "pointerup", () => {
      if (!down)
        return;
      down = false;
      if (moved) {
        rail.classList.remove("dragging");
        const index = Math.round(rail.scrollLeft / step(rail));
        rail.scrollTo({ left: index * step(rail), behavior: scrollBehavior });
      }
    });
    on(rail, "click", (event) => {
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
        moved = false;
      }
    }, { capture: true });
  });
  const stage = root.querySelector(".screen-stage");
  const source = stage?.querySelector(".laptop img");
  if (stage && source) {
    const phone = document.createElement("div");
    phone.className = "phone";
    phone.setAttribute("aria-hidden", "true");
    const image = source.cloneNode(false);
    image.alt = "";
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.loading = "lazy";
    phone.appendChild(image);
    stage.appendChild(phone);
    cleanups.push(() => phone.remove());
  }
  const certificate = root.querySelector(".cert-image img");
  certificate?.removeAttribute("srcset");
  certificate?.removeAttribute("sizes");
  if ("IntersectionObserver" in window && !reduce) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.08 });
    root.querySelectorAll(".reveal").forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.top < innerHeight)
        element.classList.add("visible");
      observer.observe(element);
    });
    document.documentElement.classList.add("animate");
    cleanups.push(() => {
      observer.disconnect();
      document.documentElement.classList.remove("animate");
    });
  }
  const details = Array.from(root.querySelectorAll("details"));
  details.forEach((element) => on(element, "toggle", () => {
    if (element.open)
      details.forEach((other) => {
        if (other !== element)
          other.open = false;
      });
  }));
  const bar = root.querySelector(".mobilebar");
  const heroButton = root.querySelector(".hero .btn.checkout");
  const hide = [root.querySelector("#oferta"), root.querySelector(".footer")].filter(Boolean);
  if (bar && heroButton && "IntersectionObserver" in window) {
    const state = new Map;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => state.set(entry.target, entry.isIntersecting));
      const heroVisible = state.get(heroButton) ?? true;
      const aboveHero = heroButton.getBoundingClientRect().top > innerHeight;
      const blocked = hide.some((element) => state.get(element));
      bar.classList.toggle("show", !heroVisible && !aboveHero && !blocked);
    });
    [heroButton, ...hide].forEach((element) => observer.observe(element));
    cleanups.push(() => observer.disconnect());
  } else {
    bar?.classList.add("show");
  }
  return () => cleanups.forEach((cleanup) => cleanup());
}

// ../tmp/basico75off-export/analytics-export.ts
function initAnalytics() {
  const config = { gtm: "GTM-P4ZW69XG", ga4: "G-1F7CCHFC4P", meta: "1638099598110770", directGA: true, directMeta: true, enableGTM: false };
  const live = /^https?:$/.test(location.protocol) && !["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(location.hostname);
  const trackingEnabled = live && !/(^|\.)lovable(project)?\.(app|com|dev)$/.test(location.hostname);
  const key = "uniteke_tracking_consent_v1";
  let allowed = false, started = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function() {
    window.dataLayer.push(arguments);
  };
  window.gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  function load(src) {
    const s = document.createElement("script");
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }
  function update(yes) {
    allowed = yes && trackingEnabled;
    if (!trackingEnabled)
      return;
    const status = yes ? "granted" : "denied";
    window.gtag("consent", "update", { analytics_storage: status, ad_storage: status, ad_user_data: status, ad_personalization: status });
    if (typeof window.fbq === "function")
      window.fbq("consent", yes ? "grant" : "revoke");
    if (!yes || started)
      return;
    started = true;
    if (config.enableGTM) {
      window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      load("https://www.googletagmanager.com/gtm.js?id=" + config.gtm);
    }
    if (config.directGA) {
      window.gtag("js", new Date);
      window.gtag("config", config.ga4);
      load("https://www.googletagmanager.com/gtag/js?id=" + config.ga4);
    }
    if (config.directMeta) {
      if (!window.fbq) {
        const n = window.fbq = function() {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        window._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = "2.0";
        n.queue = [];
        load("https://connect.facebook.net/en_US/fbevents.js");
      }
      window.fbq("consent", "grant");
      window.fbq("init", config.meta);
      window.fbq("track", "PageView");
    }
  }
  function store(value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }
  function read() {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function showConsent(focus) {
    if (document.getElementById("uniteke-consent"))
      return;
    const box = document.createElement("aside");
    box.id = "uniteke-consent";
    box.setAttribute("aria-label", "Preferências de privacidade");
    box.style.cssText = "position:fixed;bottom:18px;left:18px;z-index:9999;width:min(440px,calc(100% - 36px));background:#fff;color:#142c4d;border:1px solid #c9dbea;border-radius:14px;padding:17px;box-shadow:0 10px 35px #10284e24;font:14px/1.4 system-ui,sans-serif";
    if (matchMedia("(max-width:700px)").matches)
      box.style.bottom = "100px";
    box.innerHTML = '<strong>Preferências de privacidade</strong><p style="margin:7px 0 13px;color:#52657b">Podemos usar cookies de análise e publicidade (Google e Meta) para medir visitas e campanhas? Você pode recusar ou alterar sua escolha a qualquer momento.</p><div style="display:flex;flex-wrap:wrap;gap:8px"><button type="button" data-choice="yes" style="background:#173b6b;color:white;border:1px solid #173b6b;border-radius:7px;padding:9px 13px">Aceitar</button><button type="button" data-choice="no" style="background:white;color:#173b6b;border:1px solid #9db6d0;border-radius:7px;padding:9px 13px">Recusar</button></div>';
    box.addEventListener("click", function(e) {
      const b = e.target.closest("[data-choice]");
      if (!b)
        return;
      const v = b.dataset.choice;
      const wasStarted = started;
      store(v);
      update(v === "yes");
      box.remove();
      if (v === "no" && wasStarted)
        location.reload();
    });
    document.body.appendChild(box);
    const first = box.querySelector("button");
    if (focus && first)
      first.focus();
  }
  (function() {
    const saved = read();
    if (saved === "yes")
      update(true);
    else if (saved !== "no")
      showConsent();
    const footer = document.querySelector(".foot-bottom") || document.querySelector("footer");
    if (footer) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Preferências de privacidade";
      b.style.cssText = "background:none;border:0;padding:0;color:inherit;font:inherit;text-decoration:underline;text-underline-offset:3px;text-align:left";
      b.addEventListener("click", function() {
        showConsent(true);
      });
      footer.appendChild(b);
    }
    document.addEventListener("click", function(e) {
      const a = e.target.closest("a.checkout");
      if (!allowed || !a)
        return;
      const data = { course: "basico_em_teologia", value: 300, currency: "BRL" };
      if (config.directGA)
        window.gtag("event", "checkout_click", data);
      else
        window.dataLayer.push({ event: "checkout_click", ...data });
      if (config.directMeta && typeof window.fbq === "function")
        window.fbq("trackCustom", "CheckoutClick", data);
    });
  })();
}

// ../tmp/basico75off-export/entry.ts
function start() {
  const root = document.querySelector(".lp-v16");
  if (root instanceof HTMLElement)
    initPage(root);
  initAnalytics();
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
