const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  await page.goto('http://localhost:8083/pages/artikel/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => {
    const cards = document.querySelectorAll('.artikel-card');
    const sidebar = document.querySelector('#sidebar-root');
    const header = document.querySelector('.article-header');
    const tags = document.querySelector('#artikel-tags');
    const grid = document.querySelector('#artikel-grid');

    return {
      cardCount: cards.length,
      sidebarHTML: sidebar ? sidebar.innerHTML.substring(0, 100) : 'EMPTY',
      headerVisible: header ? getComputedStyle(header).display : 'N/A',
      tagsVisible: tags ? getComputedStyle(tags).display : 'N/A',
      gridDisplay: grid ? getComputedStyle(grid).display : 'N/A',
      gridColumns: grid ? getComputedStyle(grid).gridTemplateColumns : 'N/A',
      cards: Array.from(cards).map((c, i) => {
        const layout = [...c.classList].find(x => x.startsWith('artikel-card--')) || 'none';
        const title = c.querySelector('.artikel-card__title');
        const excerpt = c.querySelector('.artikel-card__excerpt');
        const img = c.querySelector('.artikel-card__img');
        return {
          index: i,
          layout: layout,
          titleText: title ? title.textContent.substring(0, 50) : 'MISSING',
          titleVisible: title ? getComputedStyle(title).display !== 'none' : false,
          excerptText: excerpt ? excerpt.textContent.substring(0, 50) : 'MISSING',
          excerptVisible: excerpt ? getComputedStyle(excerpt).display !== 'none' : false,
          imgSrc: img ? img.getAttribute('src') : 'MISSING',
        };
      })
    };
  });

  console.log('=== CURRENT STATE ===');
  console.log('Cards:', info.cardCount);
  console.log('Sidebar:', info.sidebarHTML);
  console.log('Header:', info.headerVisible);
  console.log('Tags:', info.tagsVisible);
  console.log('Grid display:', info.gridDisplay);
  console.log('Grid columns:', info.gridColumns);
  info.cards.forEach(c => {
    console.log(`  #${c.index} [${c.layout}] title="${c.titleText}" visible=${c.titleVisible} excerpt="${c.excerptText}" visible=${c.excerptVisible}`);
  });

  await page.screenshot({ path: '/tmp/current-state.png', fullPage: false });
  console.log('\nScreenshot: /tmp/current-state.png');
  await browser.close();
})().catch(e => console.error('ERROR:', e.message));
