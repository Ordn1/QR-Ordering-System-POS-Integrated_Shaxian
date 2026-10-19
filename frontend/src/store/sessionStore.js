import { create } from 'zustand';

import { setDeviceToken } from '../api/client';
import * as sessionApi from '../api/sessions';
import i18n from '../lib/i18n';
import { useUiStore } from './uiStore';

const STORAGE_KEY = 'shaxian.devices';

let inflightPromise = null;
let inflightToken = null;

function remember(qrToken, deviceToken) {
  try {
    const map = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    map[qrToken] = deviceToken;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [qrToken]: deviceToken }));
  }
}

function recall(qrToken) {
  try {
    const map = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (map && map[qrToken]) {
      return map[qrToken];
    }
  } catch {}

  try {
    const legacy = JSON.parse(localStorage.getItem('shaxian.device'));
    if (legacy?.qrToken === qrToken && legacy?.deviceToken) {
      remember(qrToken, legacy.deviceToken);
      return legacy.deviceToken;
    }
  } catch {}

  return null;
}

function applySession(session) {
  setDeviceToken(session.device_token);
  useUiStore.getState().setUiMode(session.ui_mode_used);
  useUiStore.getState().setLanguage(session.language_used);
  i18n.changeLanguage(session.language_used);
}

export const useSessionStore = create((set, get) => ({
  session: null,
  status: 'idle',

  open: async (qrToken) => {
    if (inflightPromise && inflightToken === qrToken) {
      return inflightPromise;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const urlDeviceToken = urlParams.get('device_token');

    let tokenToUse = urlDeviceToken || recall(qrToken);

    if (urlDeviceToken) {
      remember(qrToken, urlDeviceToken);
    }

    set({ status: 'opening' });

    inflightToken = qrToken;
    inflightPromise = sessionApi
      .openSession(qrToken, tokenToUse)
      .then((session) => {
        remember(qrToken, session.device_token);
        applySession(session);
        set({ session, status: 'ready' });
        return session;
      })
      .catch((error) => {
        set({ status: 'failed' });
        throw error;
      })
      .finally(() => {
        inflightPromise = null;
        inflightToken = null;
      });

    return inflightPromise;
  },

  refresh: async () => {
    const current = get().session;
    if (!current) {
      return null;
    }
    try {
      const next = await sessionApi.readSession(current.session_id);
      applySession(next);
      set({ session: next });
      return next;
    } catch {
      return null;
    }
  },

  declare: async (status) => {
    const session = await sessionApi.declarePriority(get().session.session_id, status);
    applySession(session);
    set({ session });
    return session;
  },

  setLanguage: async (language) => {
    i18n.changeLanguage(language);
    useUiStore.getState().setLanguage(language);
    const current = get().session;
    if (!current) {
      return;
    }
    const session = await sessionApi.savePreferences(current.session_id, {
      language_used: language,
    });
    set({ session });
  },
}));