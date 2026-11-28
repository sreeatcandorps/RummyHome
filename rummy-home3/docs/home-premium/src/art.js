// Patterns and small drawings, as SVG data URIs. Each is used once or twice per screen, never as wallpaper.
(() => {
  const uri = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}")`;

  /** A: jaali, the diamond lattice of a carved screen, a few percent visible on the felt. */
  const jaali = (stroke) => uri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <path d="M14 0 28 14 14 28 0 14Z" fill="none" stroke="${stroke}" stroke-width="1"/>
      <circle cx="14" cy="14" r="1.1" fill="${stroke}"/>
    </svg>`);

  /** C: a block-print border, one buti (four-petal flower) and one diamond, repeated in a single row. */
  const blockPrint = (ink, dot) => uri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="16" viewBox="0 0 40 16">
      <g fill="none" stroke="${ink}" stroke-width="1.1">
        <ellipse cx="10" cy="4.7" rx="1.7" ry="2.5"/><ellipse cx="10" cy="11.3" rx="1.7" ry="2.5"/>
        <ellipse cx="6.7" cy="8" rx="2.5" ry="1.7"/><ellipse cx="13.3" cy="8" rx="2.5" ry="1.7"/>
        <path d="M30 4.6 33.4 8 30 11.4 26.6 8Z"/>
      </g>
      <circle cx="10" cy="8" r="1.05" fill="${dot}"/>
      <circle cx="30" cy="8" r="0.95" fill="${ink}"/>
      <circle cx="20" cy="8" r="0.85" fill="${ink}"/><circle cx="0" cy="8" r="0.85" fill="${ink}"/><circle cx="40" cy="8" r="0.85" fill="${ink}"/>
    </svg>`);

  /** C: a rangoli roundel in one line weight: petals, the two crossed squares, a lotus, dots. */
  const rangoli = (ink, dot, weight = 1) => {
    const turn = (n, body) => Array.from({ length: n }, (_, k) => `<g transform="rotate(${(360 / n) * k})">${body}</g>`).join('');
    return uri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">
      <g fill="none" stroke="${ink}" stroke-width="${weight}" stroke-linejoin="round">
        <circle r="96"/><circle r="60"/><circle r="37"/>
        ${turn(16, '<path d="M0 -62 Q10 -74 0 -86 Q-10 -74 0 -62Z"/>')}
        <rect x="-39" y="-39" width="78" height="78"/><rect x="-39" y="-39" width="78" height="78" transform="rotate(45)"/>
        ${turn(8, '<path d="M0 -9 Q11 -22 0 -35 Q-11 -22 0 -9Z"/>')}
      </g>
      <g fill="${dot}">${turn(16, '<circle cx="0" cy="-91" r="1.7" transform="rotate(11.25)"/>')}${turn(8, '<circle cx="0" cy="-47" r="2.1" transform="rotate(22.5)"/>')}<circle r="4.2"/></g>
    </svg>`);
  };

  window.ART = { jaali, blockPrint, rangoli };
})();
