(() => {
  const O = globalThis.OxyCamp;

  O.getVideoInfo = function getVideoInfo() {
    const iframes = [
      ...document.querySelectorAll("app-player-travado iframe"),
      ...document.querySelectorAll('iframe[src*="youtube"]'),
    ];
    let youtubeId = null;
    let embedUrl = null;
    for (const iframe of iframes) {
      const src = iframe.src || iframe.getAttribute("src") || "";
      const m = src.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{6,})/i);
      if (m) {
        youtubeId = m[1];
        embedUrl = src;
        break;
      }
    }
    // Fallback: data attributes / page text near player
    if (!youtubeId) {
      const host = document.querySelector("app-player-travado");
      const raw = host?.innerHTML || "";
      const m2 = raw.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{6,})/i);
      if (m2) youtubeId = m2[1];
    }
    const watchUrl = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null;
    const embedClean = youtubeId ? `https://www.youtube-nocookie.com/embed/${youtubeId}` : null;
    return {
      youtubeId,
      watchUrl,
      embedUrl: embedUrl || embedClean,
      title: O.textOf(document.querySelector("h2.po-page-header-title, .po-page-header-title")) || "",
    };
  };
})();
