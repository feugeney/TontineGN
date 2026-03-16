export function formatGNF(amount: number): string {
  // Hermes (React Native) does not support GNF as a currency code in Intl.NumberFormat
  // Format manually: space-separated thousands + GNF suffix
  const rounded = Math.round(Number(amount) || 0);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} GNF`;
}

export function formatPhone(phone: string): string {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('224') && digits.length === 12) {
    return `+224 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return phone;
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} jours`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function frequencyLabel(freq: string): string {
  const map: Record<string, string> = {
    daily: 'Quotidien',
    weekly: 'Hebdomadaire',
    monthly: 'Mensuel',
  };
  return map[freq] || freq;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'En attente',
    paid: 'Payé',
    late: 'En retard',
    penalized: 'Pénalisé',
    active: 'Actif',
    completed: 'Complété',
    cancelled: 'Annulé',
    processing: 'En cours',
    failed: 'Échoué',
  };
  return map[status] || status;
}

export function getInitials(name: string): string {
  return String(name || '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
