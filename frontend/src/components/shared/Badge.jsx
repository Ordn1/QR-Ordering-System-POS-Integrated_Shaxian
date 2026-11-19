const TONE_BY_VALUE = {
  pending: 'grey',
  preparing: 'amber',
  ready: 'green',
  completed: 'blue',
  abandoned: 'grey',
  voided: 'red',
  paid: 'green',
  failed: 'red',
  vacant: 'grey',
  occupied: 'blue',
  reserved: 'violet',
  senior: 'violet',
  pwd: 'blue',
  pregnant: 'orange',
  standard: 'grey',
  available: 'green',
  'sold out': 'grey',
  active: 'green',
  ended: 'grey',
  priority: 'violet',
  group: 'blue',
  success: 'green',
  admin: 'violet',
  service_crew: 'blue',
};

const LABELS = {
  pwd: 'PWD',
  'sold out': 'Sold out',
  admin: 'Admin',
  service_crew: 'Service crew',
};

function toneFor(value, domain) {
  if (domain === 'payment' && value === 'pending') {
    return 'amber';
  }
  return TONE_BY_VALUE[value] ?? 'grey';
}

function labelFor(value) {
  if (LABELS[value]) {
    return LABELS[value];
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function Badge({ value, domain, tone, label }) {
  return (
    <span className={`badge badge-${tone ?? toneFor(value, domain)}`}>
      {label ?? labelFor(value)}
    </span>
  );
}