(() => {
  const btn = document.querySelector('.metric-group__add');
  const group = document.querySelector('.metric-group');
  if (!btn || !group) return JSON.stringify({ found: !!btn, group: !!group, hash: location.hash });
  const cards = group.querySelectorAll('.metric-card-wrap');
  const last = cards[cards.length - 1];
  if (!last) return JSON.stringify({ found: true, cardCount: 0, display: getComputedStyle(btn).display });
  const b = btn.getBoundingClientRect();
  const l = last.getBoundingClientRect();
  return JSON.stringify({
    hash: location.hash,
    cardCount: cards.length,
    display: getComputedStyle(btn).display,
    btnRect: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width) },
    lastCardRect: { x: Math.round(l.x), y: Math.round(l.y), w: Math.round(l.width), h: Math.round(l.height) },
    afterLastCard: b.x >= l.x + l.width,
    verticallyCentered: Math.abs((b.y + b.height / 2) - (l.y + l.height / 2)) < 3
  });
})()
