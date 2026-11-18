import { AnimatePresence, motion } from 'motion/react';
import { Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SWAP } from '../../../lib/motion';
import { VIBRATE_READY } from '../../../lib/progress';
import {
  playBell,
  playChime,
  playCoin,
  playFlare,
  playPop,
  playPrint,
  playStamp,
  startSizzle,
  stopSizzle,
  unlockSound,
} from '../../../lib/sound';
import { useUiStore } from '../../../store/uiStore';
import StageIllustration from './StageIllustration';

const SOUNDS = { bell: playBell, chime: playChime, coin: playCoin, flare: playFlare, print: playPrint, stamp: playStamp };

export default function OrderProgress({ stage, live = false, ahead = 0, queueLabel }) {
  const { t } = useTranslation();
  const sound = useUiStore((state) => state.sound);
  const setSound = useUiStore((state) => state.setSound);
  const [firstStage] = useState(stage);
  const [onScreen, setOnScreen] = useState(true);
  const frame = useRef(null);
  const entering = live || stage !== firstStage;

  const onCue = useCallback((name, kind) => {
    if (kind === 'arrive' && name === 'bell') {
      navigator.vibrate?.(VIBRATE_READY);
    }
    if (useUiStore.getState().sound) {
      SOUNDS[name]?.();
    }
  }, []);

  useEffect(() => {
    if (!sound || !onScreen || stage !== 'preparing') {
      return undefined;
    }
    startSizzle();
    return stopSizzle;
  }, [sound, onScreen, stage]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);

  function toggleSound() {
    if (!sound) {
      unlockSound();
      playPop();
    }
    setSound(!sound);
  }

  const title = stage === 'unpaid' ? t('progress.unpaid') : t(`status.${stage}`);
  const detail = stage === 'pending' && ahead > 0 ? t('progress.ahead', { count: ahead }) : t(`progress.detail.${stage}`);
  const soundLabel = t(sound ? 'progress.soundOff' : 'progress.soundOn');

  return (
    <section className="order-progress" ref={frame}>
      <div className={`order-progress-art${onScreen ? '' : ' illo-paused'}`} aria-hidden="true">
        <AnimatePresence initial={false} mode="wait">
          <motion.div key={stage} initial={SWAP.hidden} animate={SWAP.shown} exit={SWAP.hidden}>
            <StageIllustration stage={stage} live={entering} ahead={ahead} queueLabel={queueLabel} onCue={onCue} />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="order-progress-foot">
        <p className="order-progress-caption" aria-live="polite">
          {title}
          <span className="order-progress-detail">{detail}</span>
        </p>
        <button
          type="button"
          className="toggle-btn"
          aria-pressed={sound}
          aria-label={soundLabel}
          title={soundLabel}
          onClick={toggleSound}
        >
          {sound ? <Volume2 size={18} strokeWidth={1.75} /> : <VolumeX size={18} strokeWidth={1.75} />}
        </button>
      </div>
    </section>
  );
}
