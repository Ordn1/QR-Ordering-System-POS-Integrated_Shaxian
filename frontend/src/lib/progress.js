export const CUES = {
  unpaid: { arrive: { sound: 'print', at: 0 }, tap: { sound: 'coin', at: 0 } },
  pending: { arrive: { sound: 'stamp', at: 420 }, tap: { sound: 'stamp', at: 420 } },
  preparing: { arrive: { sound: 'flare', at: 0 }, tap: { sound: 'flare', at: 0 } },
  ready: { arrive: { sound: 'bell', at: 60 }, tap: { sound: 'bell', at: 60 } },
  completed: { arrive: { sound: 'chime', at: 250 }, tap: { sound: 'chime', at: 0 } },
};

export const STAR = 'M0-6Q1-1 6 0Q1 1 0 6Q-1 1-6 0Q-1-1 0-6Z';

export const VIBRATE_READY = [30, 60, 30];
