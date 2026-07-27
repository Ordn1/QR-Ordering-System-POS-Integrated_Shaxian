export const peso = (amount) =>
  `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const queueLabel = (queueNumber) => `Q-${String(queueNumber).padStart(3, '0')}`;

export const shortDate = (isoString) =>
  new Date(isoString).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
