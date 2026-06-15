document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (link && link.href.startsWith(window.location.origin) && !link.href.includes('#')) {
      e.preventDefault();
      let url = link.href;
      if (url.endsWith('/')) url += 'index.html';
      
      document.body.style.transition = 'opacity 0.2s';
      document.body.style.opacity = '0';
      setTimeout(() => {
        window.location.href = url;
      }, 200);
    }
  });
});
