// Decorative only: follow real circle positions instead of fixed viewport pixels.
export function connectTaskRoute(grid) {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.classList.add('task-route');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  grid.prepend(svg);
  const cards = [...grid.querySelectorAll('.level-card')];
  let frame;

  function draw() {
    frame = null;
    const bounds = grid.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    const nodes = cards.map(card => {
      const circle = card.querySelector('.node-circle').getBoundingClientRect();
      const label = card.querySelector('.node-label').getBoundingClientRect();
      const component = card.getBoundingClientRect();
      return {
        x:circle.left + circle.width / 2 - bounds.left,
        y:circle.top + circle.height / 2 - bounds.top,
        r:circle.width / 2,
        labelBottom:label.bottom - bounds.top,
        cardBottom:component.bottom - bounds.top,
      };
    });
    const paths = [];
    for (let index = 0; index < nodes.length - 1; index++) {
      const a = nodes[index], b = nodes[index + 1];
      let d;
      if (b.x > a.x + 8) {
        // Two circles on one row: a gentle curve, clear of labels and card tops.
        const start = a.x + a.r + 10, end = b.x - b.r - 10;
        const mid = (start + end) / 2;
        d = `M ${start} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${end} ${b.y}`;
      } else if (Math.abs(b.x - a.x) <= 8) {
        // Mobile timeline leaves a gap for the status label.
        const startY = Math.max(a.y + a.r + 10, a.labelBottom + 10);
        d = `M ${a.x} ${startY} L ${b.x} ${b.y - b.r - 10}`;
      } else {
        // At a responsive row wrap, route through the outer gutters and row gap.
        let first = index;
        while (first > 0 && nodes[first].x > nodes[first - 1].x + 8) first--;
        const rowBottom = Math.max(...nodes.slice(first, index + 1).map(n => n.cardBottom));
        const turnY = rowBottom + 12;
        const right = bounds.width - 14, left = 14, bend = 6;
        d = `M ${a.x + a.r + 10} ${a.y} H ${right - bend} Q ${right} ${a.y}, ${right} ${a.y + bend}` +
          ` V ${turnY - bend} Q ${right} ${turnY}, ${right - bend} ${turnY}` +
          ` H ${left + bend} Q ${left} ${turnY}, ${left} ${turnY + bend}` +
          ` V ${b.y - bend} Q ${left} ${b.y}, ${left + bend} ${b.y} H ${b.x - b.r - 10}`;
      }
      const path = document.createElementNS(namespace, 'path');
      path.setAttribute('d', d);
      path.classList.add('route-dashes');
      const edge = path.cloneNode(); edge.setAttribute('class','route-edge');
      const bed = path.cloneNode(); bed.setAttribute('class','route-bed');
      paths.push(edge, bed, path);
    }
    svg.replaceChildren(...paths);
  }
  const schedule = () => { if (frame == null) frame = requestAnimationFrame(draw); };
  const observer = new ResizeObserver(schedule);
  observer.observe(grid);
  cards.forEach(card => observer.observe(card));
  window.addEventListener('resize', schedule, {passive:true});
  document.fonts?.ready.then(schedule);
  schedule();
}
