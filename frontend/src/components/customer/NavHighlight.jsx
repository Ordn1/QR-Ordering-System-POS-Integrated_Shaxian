import { useTranslation } from 'react-i18next';

/**
 * The visible half of useNavGuidance: a ring around one control plus a short label
 * naming what it does. Uses the Glow effect and the modal fade from UIDesign §14 —
 * no pulse, no bounce. Purely decorative to assistive tech, since the label repeats
 * what the highlighted control already announces.
 */
export default function NavHighlight({ target, onDismiss }) {
  const { t } = useTranslation();

  if (!target) {
    return null;
  }

  const { top, left, width, height, name } = target;

  return (
    <div className="nav-guide" aria-hidden="true">
      <button
        type="button"
        className="nav-guide-scrim"
        tabIndex={-1}
        aria-label={t('guide.dismiss')}
        onClick={onDismiss}
      />
      <span
        className="nav-guide-ring"
        style={{ top: `${top}px`, left: `${left}px`, width: `${width}px`, height: `${height}px` }}
      />
      <span
        className="nav-guide-label"
        style={{ top: `${top + height}px`, left: `${left}px` }}
      >
        {t(`guide.${name}`)}
      </span>
    </div>
  );
}
