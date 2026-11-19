/**
 * The dish's code from the printed menu board (A1, A3s, D2+), as a small red seal chip.
 * `overlay` pins it to the top-left corner of the dish photo it sits inside.
 */
export default function MenuCode({ code, overlay = false }) {
  if (!code) {
    return null;
  }

  return <span className={`menu-code${overlay ? ' menu-code-overlay' : ''}`}>{code}</span>;
}
