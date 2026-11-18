import { useEffect, useState } from 'react';

import { CUES } from '../../../lib/progress';
import ServedBowl from './ServedBowl';
import ServiceBell from './ServiceBell';
import StampedTicket from './StampedTicket';
import TicketPrinter from './TicketPrinter';
import WokFire from './WokFire';

const ART = {
  unpaid: TicketPrinter,
  pending: StampedTicket,
  preparing: WokFire,
  ready: ServiceBell,
  completed: ServedBowl,
};

export default function StageIllustration({ stage, live, ahead, queueLabel, onCue }) {
  const [taps, setTaps] = useState(0);
  const Art = ART[stage];

  useEffect(() => {
    if (!live) {
      return undefined;
    }
    const { sound, at } = CUES[stage].arrive;
    const timer = setTimeout(() => onCue(sound, 'arrive'), at);
    return () => clearTimeout(timer);
  }, [live, stage, onCue]);

  useEffect(() => {
    if (taps === 0) {
      return undefined;
    }
    const { sound, at } = CUES[stage].tap;
    const timer = setTimeout(() => onCue(sound, 'tap'), at);
    return () => clearTimeout(timer);
  }, [taps, stage, onCue]);

  return (
    <div onClick={() => setTaps((count) => count + 1)}>
      <Art live={live} taps={taps} ahead={ahead} queueLabel={queueLabel} />
    </div>
  );
}
