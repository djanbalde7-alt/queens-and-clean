// services/quoteEngine.js
import pricing from '../config/pricing.json';

export function quoteEngine({ service_type, number_of_bedrooms }) {
  const table = pricing[service_type];
  if (!table) throw new Error('Invalid service_type');
  const amount = Number(table[number_of_bedrooms]);
  if (!Number.isFinite(amount)) throw new Error('Invalid number_of_bedrooms');
  return { amount, currency: pricing.currency || 'USD' };
}
