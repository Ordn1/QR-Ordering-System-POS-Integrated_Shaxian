import { DURATION, EASE_OUT, FLY, OFFSET, cssEase, prefersReducedMotion } from './motion';

const TARGET = '[data-fly-target="cart"]';

function bump(target) {
  target.querySelector('svg')?.animate(
    [
      { transform: 'scale(1)' },
      { transform: `scale(${FLY.bumpScale})` },
      { transform: 'scale(1)' },
    ],
    { duration: DURATION.move * 1000, easing: cssEase(EASE_OUT) },
  );
}

export function flyToCart(sourceImage) {
  const target = document.querySelector(TARGET);
  if (!target) {
    return;
  }

  navigator.vibrate?.(FLY.hapticMs);

  const from = sourceImage?.getBoundingClientRect();
  if (!from || from.width === 0 || prefersReducedMotion()) {
    bump(target);
    return;
  }

  const icon = (target.querySelector('svg') ?? target).getBoundingClientRect();
  const dx = icon.left + icon.width / 2 - (from.left + from.width / 2);
  const dy = icon.top + icon.height / 2 - (from.top + from.height / 2);
  const scale = FLY.landedSize / Math.max(from.width, from.height);
  const duration = DURATION.fly * 1000;

  const outer = document.createElement('div');
  outer.className = 'menu-fly';
  Object.assign(outer.style, {
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
  });
  const inner = outer.appendChild(document.createElement('div'));
  inner.className = 'menu-fly-photo';
  inner.style.backgroundImage = `url("${sourceImage.currentSrc || sourceImage.src}")`;
  document.body.appendChild(outer);

  outer.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], {
    duration,
    easing: cssEase(EASE_OUT),
    fill: 'forwards',
  });
  const fall = inner.animate(
    [
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      {
        transform: `translateY(${-OFFSET.rise}px) scale(${(1 + scale) / 2})`,
        opacity: 1,
        offset: 0.3,
      },
      { transform: `translateY(${dy}px) scale(${scale})`, opacity: 0.4 },
    ],
    { duration, easing: cssEase(FLY.fallEase), fill: 'forwards' },
  );

  fall.onfinish = () => {
    outer.remove();
    bump(target);
  };
}
