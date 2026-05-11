// Formatea pesos chilenos con punto de miles, sin decimales.
export function formatCLP(amount) {
  if (amount === null || amount === undefined || amount === '') return ''
  const n = Number(amount)
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)
}
