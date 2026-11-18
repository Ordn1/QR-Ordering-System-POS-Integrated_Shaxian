import { AnimatePresence, motion } from 'motion/react';

import { LEAVE, MOVE } from '../../../lib/motion';

const TICKET = 'M-30 4H30V90l-5 4-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4-5-4V4Z';
const SMALL_TICKET = 'M-20 4H20V62l-5 4-5-4-5 4-5-4-5 4-5-4-5 4-5-4V4Z';
const MAX_AHEAD = 3;
const RAIL_Y = 40;
const SLOT = { center: 100, shift: 17, gap: 48, step: 34, enter: 24, leave: 36 };

const ownX = (shown) => SLOT.center + SLOT.shift * shown;
const aheadX = (shown, index) => ownX(shown) - SLOT.gap - SLOT.step * index;

function Clip({ width }) {
  return (
    <>
      <rect className="illo-steel" x={-width / 2} y="-5" width={width} height="12" rx="2" />
      <rect className="illo-shine" x={-width / 2 + 2} y="-3" width="3" height="8" rx="1.5" />
    </>
  );
}

function AheadTicket({ phase }) {
  return (
    <g className="illo-hang illo-top" style={{ '--phase': phase }}>
      <path className="illo-shade" transform="translate(3 3)" d={SMALL_TICKET} />
      <path className="illo-paper" d={SMALL_TICKET} />
      <rect className="illo-faint" x="-12" y="14" width="24" height="4" rx="2" />
      <rect className="illo-faint" x="-12" y="25" width="18" height="3" rx="1.5" />
      <rect className="illo-faint" x="-12" y="32" width="22" height="3" rx="1.5" />
      <rect className="illo-faint" x="-12" y="39" width="14" height="3" rx="1.5" />
      <Clip width={12} />
    </g>
  );
}

export default function StampedTicket({ live, taps, ahead = 0, queueLabel }) {
  const shown = Math.min(ahead, MAX_AHEAD);
  const stamping = live || taps > 0;

  return (
    <svg className="illo" viewBox="0 0 200 160">
      <rect className="illo-steel" x="8" y={RAIL_Y - 6} width="184" height="7" rx="3.5" />
      <rect className="illo-shine" x="14" y={RAIL_Y - 4.5} width="172" height="1.8" rx="0.9" />
      <circle className="illo-iron-light" cx="12" cy={RAIL_Y - 2.5} r="5" />
      <circle className="illo-iron-light" cx="188" cy={RAIL_Y - 2.5} r="5" />
      <g transform={`translate(0 ${RAIL_Y})`}>
        <AnimatePresence initial={false}>
          {Array.from({ length: shown }, (_, index) => (
            <motion.g
              key={index}
              initial={{ opacity: 0, x: aheadX(shown, index) - SLOT.enter }}
              animate={{ opacity: 1, x: aheadX(shown, index), rotate: 0 }}
              exit={{ opacity: 0, x: aheadX(shown, index) - SLOT.leave, rotate: -14, transition: LEAVE }}
              transition={MOVE}
            >
              <AheadTicket phase={0.3 + index * 0.27} />
            </motion.g>
          ))}
        </AnimatePresence>
        <motion.g initial={false} animate={{ x: ownX(shown) }} transition={MOVE}>
          <g className="illo-hang illo-top">
            <g key={taps} className={stamping ? 'illo-hit illo-top' : undefined}>
              <path className="illo-shade" transform="translate(3 3)" d={TICKET} />
              <path className="illo-paper" d={TICKET} />
              <rect className="illo-red" x="-30" y="4" width="60" height="5" />
              <text className="illo-label" y="29">
                {queueLabel}
              </text>
              <rect className="illo-faint" x="-20" y="38" width="40" height="3" rx="1.5" />
              <rect className="illo-faint" x="-20" y="45" width="30" height="3" rx="1.5" />
              <rect className="illo-faint" x="-20" y="52" width="35" height="3" rx="1.5" />
              <rect className="illo-faint" x="-20" y="66" width="16" height="3" rx="1.5" />
              <rect className="illo-faint" x="-20" y="73" width="12" height="3" rx="1.5" />
              <g transform="translate(14 72)">
                <g className={stamping ? 'illo-seal illo-center' : undefined}>
                  <g transform="rotate(-8)">
                    <rect className="illo-red" x="-11" y="-11" width="22" height="22" />
                    <rect className="illo-line-paper" x="-7.5" y="-7.5" width="15" height="15" strokeWidth="1.6" />
                    <rect className="illo-paper" x="-3" y="-3" width="6" height="6" />
                  </g>
                </g>
                {stamping ? (
                  <rect
                    className="illo-line-red illo-ink-ring illo-center"
                    x="-12"
                    y="-12"
                    width="24"
                    height="24"
                    strokeWidth="2"
                  />
                ) : null}
              </g>
              <Clip width={14} />
            </g>
          </g>
          {stamping ? (
            <g key={`stamp-${taps}`} transform="translate(14 84)">
              <g className="illo-stamp illo-base">
                <rect className="illo-red-deep" x="-13" y="-7" width="26" height="7" rx="1" />
                <rect className="illo-wood" x="-15" y="-17" width="30" height="11" rx="2.5" />
                <rect className="illo-shade" x="4" y="-17" width="11" height="11" rx="2.5" />
                <rect className="illo-wood" x="-4.5" y="-31" width="9" height="15" />
                <rect className="illo-shade" x="1" y="-31" width="3.5" height="15" />
                <ellipse className="illo-red" cx="0" cy="-36" rx="11" ry="8" />
                <path className="illo-red-deep" d="M5-42.5C9.5-40.5 11-38 11-36C11-31.6 6.1-28 0-28C5-31 7-36 5-42.5Z" />
                <ellipse className="illo-shine" cx="-4.5" cy="-39.5" rx="4" ry="2.2" />
              </g>
            </g>
          ) : null}
        </motion.g>
      </g>
    </svg>
  );
}
