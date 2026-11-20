export function shareLabel(share, t) {
  if (share.is_companion) {
    return t('people.shareName', { name: share.display_name });
  }
  return share.is_host
    ? t('split.deviceHost', { number: share.device_number })
    : t('split.device', { number: share.device_number });
}

export function companionName(session, forDeviceId) {
  return session?.companions?.find((person) => person.device_id === forDeviceId)?.display_name ?? null;
}

export function claimLabel(claim, t) {
  if (!claim) {
    return '';
  }
  if (claim.is_companion) {
    return t('staff.claimCompanion', { name: claim.display_name, number: claim.managed_by_number });
  }
  return claim.display_name || t('split.device', { number: claim.device_number });
}
