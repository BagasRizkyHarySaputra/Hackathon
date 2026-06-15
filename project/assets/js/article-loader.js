document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    document.querySelector('.article-card__title').textContent = 'No Article Selected';
    document.getElementById('article-summary').textContent = 'Please select an article from the main page.';
    return;
  }

  try {
    const res = await fetch('/assets/data/articles.json');
    const articles = await res.json();
    const article = articles.find(a => a.id === id);

    if (!article) {
        document.querySelector('.article-card__title').textContent = 'Article Not Found';
        document.getElementById('article-summary').textContent = \`The article with ID "\${id}" could not be found.\`;
        return;
    }

    const titleEl = document.querySelector('.article-card__title');
    const summaryEl = document.getElementById('article-summary');
    const sectionsContainerEl = document.getElementById('article-sections');
    const tipsContainerEl = document.getElementById('article-tips-list');
    const imgEl = document.getElementById('article-image');

    if (titleEl) titleEl.textContent = article.title;
    if (imgEl && article.image) imgEl.src = article.image;

    /** Populate Summary Text */
    if (summaryEl) summaryEl.textContent = article.content;

    /** Populate Sections */
    if (sectionsContainerEl && article.sections && article.sections.length > 0) {
      let sectionsHtml = '';
      article.sections.forEach(section => {
        sectionsHtml += \`
          <div class="article-card__section">
            <h3 class="article-card__section-title">\${section.heading}</h3>
            <p class="article-card__text">\${section.text}</p>
          </div>
        \`;
      });
      sectionsContainerEl.innerHTML = sectionsHtml;
    } else {
        sectionsContainerEl.style.display = 'none';
    }

    /** Populate Tips List */
    if (tipsContainerEl && article.tips && article.tips.length > 0) {
      let tipsHtml = \`
        <div class="article-card__section">
          <h3 class="article-card__section-title">Key Tips</h3>
          <ul class="article-card__list">\`;
      article.tips.forEach(tip => {
        tipsHtml += \`<li>\${tip}</li>\`;
      });
      tipsHtml += \`</ul></div>\`;
      tipsContainerEl.innerHTML = tipsHtml;
    } else {
        tipsContainerEl.style.display = 'none';
    }

  } catch (err) {
    console.error('Error loading article:', err);
    document.querySelector('.article-card__title').textContent = 'Loading Error';
    document.getElementById('article-summary').textContent = 'Could not load article data. Check console for details.';
  }
});
