const { chromium } = require(process.env.TEMP + '/pwtest/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  const url = 'file:///' + 'd:/Code/Github/Wrisp/tmp-caption-test.html'.replace(/\\/g, '/');
  await page.goto(url);
  const result = await page.evaluate(() => {
    const cap = document.querySelector('.image-caption');
    const fig = document.querySelector('.image-figure');
    const holder = document.querySelector('.image-node__holder');
    const cs = getComputedStyle(cap);
    const fr = fig.getBoundingClientRect();
    const cr = cap.getBoundingClientRect();
    const hr = holder.getBoundingClientRect();
    const img = document.querySelector('.image-node__img').getBoundingClientRect();
    return {
      captionDisplay: cs.display,
      captionSideOfFig: getComputedStyle(fig).captionSide,
      captionSideOfCaption: cs.captionSide,
      figureRect: { x: fr.x, y: fr.y, w: fr.width, h: fr.height },
      holderRect: { x: hr.x, y: hr.y, w: hr.width, h: hr.height },
      captionRect: { x: cr.x, y: cr.y, w: cr.width, h: cr.height },
      imgRect: { x: img.x, y: img.y, w: img.width, h: img.height },
      captionVisible: cr.width > 0 && cr.height > 0,
      captionBelowImage: cr.y >= img.y + img.height,
    };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();