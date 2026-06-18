const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1024 }
  });
  const page = await context.newPage();

  // Mock getUserMedia to return a fake video stream
  await page.addInitScript(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFE0E0';
    ctx.fillRect(0, 0, 320, 240);
    ctx.fillStyle = '#FF0000';
    ctx.font = '20px Arial';
    ctx.fillText('Camera Mock', 10, 120);
    const stream = canvas.captureStream(30);
    navigator.mediaDevices.getUserMedia = async (constraints) => stream;
  });

  await page.goto('http://localhost:8083/pages/scan-page/index.html', {
    waitUntil: 'networkidle',
    timeout: 15000
  });

  await page.waitForTimeout(3000);

  // Take BEFORE-capture screenshot
  await page.screenshot({ path: '/tmp/scan-before-capture.png', fullPage: false });
  console.log('BEFORE capture saved');

  // Try accessing Alpine component data via _x_dataStack
  const result = await page.evaluate(() => {
    try {
      const el = document.querySelector('.scan-card-wrap');
      if (!el) return 'No element found';

      // Alpine 3 stores data differently
      // Try _x_dataStack
      const stack = el._x_dataStack;
      if (!stack || !stack[0]) {
        // Try Alpine.$data
        if (typeof Alpine !== 'undefined' && Alpine.$data) {
          const data = Alpine.$data(el);
          if (data) {
            return 'Alpine.$data works, methods: ' + Object.keys(data).join(', ');
          }
        }
        return 'No _x_dataStack[0], el keys: ' + Object.keys(el).filter(k => k.startsWith('_')).join(', ');
      }

      const data = stack[0];

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFE0E0';
      ctx.fillRect(0, 0, 320, 240);

      data.capturedImage = canvas.toDataURL('image/png');
      data.showPopup = true;
      data.analysis = {
        stats: [
          { label: 'Dark Spot', value: '10%' },
          { label: 'Pustules', value: '7%' },
          { label: 'Papules', value: '18%' },
        ],
        markers: [
          { id: 1, x: 35, y: 38, label: 'Dark Spot 10%' },
          { id: 2, x: 62, y: 55, label: 'Pustules 7%' },
          { id: 3, x: 45, y: 68, label: 'Papules 18%' },
        ],
      };
      data.product = {
        name: 'Facial Treatment Gentle Cleanser',
        description: 'A nourishing facial cleanser that gently cleanses while maintaining the skin\'s natural moisture balance.',
      };

      return 'SUCCESS using _x_dataStack';
    } catch (e) {
      return 'Error: ' + e.message + ' | ' + e.stack?.substring(0, 200);
    }
  });
  console.log('Trigger result:', result);

  await page.waitForTimeout(1500);

  // Take AFTER-capture screenshot
  await page.screenshot({ path: '/tmp/scan-after-capture.png', fullPage: false });
  console.log('AFTER capture saved');

  await browser.close();
  console.log('Done!');
})().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
