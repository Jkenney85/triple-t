// Applies the saved theme before first paint to avoid a light/dark flash.
(function () {
  try {
    var pref = localStorage.getItem('ttt-theme') || 'system';
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
