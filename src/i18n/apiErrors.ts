// What the API (and Supabase's sign-in) says when it refuses something is English. In Spanish, each message the
// user can come across is translated here: exactly, or by its pattern (a name or an amount inside). Several
// field errors come joined with "; ". One not listed stays as it came: still true, just in English.

const EXACT: Record<string, string> = {
  'Your session expired. Please sign in again.': 'Tu sesión venció. Volvé a entrar.',
  'Invalid login credentials': 'El email o la contraseña no son correctos',
  'Email not confirmed': 'Todavía no confirmaste tu email',
  'Platform not found': 'No se encontró la plataforma',
  'Asset class not found': 'No se encontró la clase',
  'Malformed JSON body': 'El pedido está mal formado',
  'Name is required': 'El nombre es obligatorio',
  'Platform is required': 'La plataforma es obligatoria',
  'Asset class is required': 'La clase es obligatoria',
  'AssetClass must not be blank': 'La clase no puede estar vacía',
  'Value is required': 'El valor es obligatorio',
  'Value must not be negative': 'El valor no puede ser negativo',
  'Value must be a number': 'El valor tiene que ser un número',
  'Value is too large': 'El valor es demasiado grande',
  'Amount is too large': 'El monto es demasiado grande',
  'amount must be greater than 0': 'El monto tiene que ser mayor que 0',
  "fee can't be larger than the amount": 'La comisión no puede ser mayor que el monto',
  'Balance is required': 'El saldo es obligatorio',
  'Balance must not be negative': 'El saldo no puede ser negativo',
  'Balance is too large': 'El saldo es demasiado grande',
  'Monthly payment must not be negative': 'La cuota no puede ser negativa',
  'Monthly payment is too large': 'La cuota es demasiado grande',
  'Pick a different destination': 'Elegí otro destino',
  'A payment can only lower the balance': 'Un pago solo puede bajar el saldo',
  'New charges and interest can only raise the balance': 'Los consumos y los intereses solo pueden subir el saldo',
  "occurredAt can't be in the future or before 1970": 'La fecha no puede ser futura ni anterior a 1970',
  'capturedAt must be in the past, from 1970 on': 'La fecha tiene que ser pasada, de 1970 en adelante',
  'color must be a hex color like #1a2b3c': 'El color tiene que ser hexadecimal, como #1a2b3c',
  'textColor must be a hex color like #1a2b3c': 'El color de letra tiene que ser hexadecimal, como #1a2b3c',
  'avatarText must be 1 or 2 characters (an emoji counts as one)': 'La miniatura tiene que tener 1 o 2 caracteres (un emoji cuenta como uno)',
  'expectedReturnPct must be between -100 and 100': 'El retorno esperado tiene que estar entre -100 y 100',
  'interestRatePct must be between 0 and 200': 'La tasa tiene que estar entre 0 y 200',
  'dueDay must be between 1 and 31': 'El día de vencimiento tiene que estar entre 1 y 31',
  "Adding or removing a debt can't be undone here: remove it, or add it again.":
    'Agregar o eliminar una deuda no se deshace acá: eliminala, o agregala de nuevo.',
  "Adding or removing an asset can't be undone here: remove it, or add it again.":
    'Agregar o eliminar un activo no se deshace acá: eliminalo, o agregalo de nuevo.',
};

const NOT_FOUND: Record<string, string> = {
  Holding: 'No se encontró el activo',
  Debt: 'No se encontró la deuda',
  Movement: 'No se encontró el movimiento',
  Snapshot: 'No se encontró la foto',
};

const LONG_FIELD: Record<string, string> = { Note: 'La nota', Notes: 'Las notas', 'Debt name': 'El nombre', Lender: 'El acreedor' };

const PATTERNS: [RegExp, (...groups: string[]) => string][] = [
  [/^(.+) is worth (\$\S+): a loss can't be larger than that\.$/, (name, worth) => `${name} vale ${worth}: la pérdida no puede ser mayor.`],
  [/^(.+) is worth (\$\S+): you can't withdraw more than that\.$/, (name, worth) => `${name} vale ${worth}: no podés retirar más que eso.`],
  [/^(.+) is worth (\$\S+): you can't transfer more than that\.$/, (name, worth) => `${name} vale ${worth}: no podés transferir más que eso.`],
  [/^(.+) is worth (\$\S+): you can't pay more than that\.$/, (name, worth) => `${name} vale ${worth}: no podés pagar más que eso.`],
  [/^(.+) is worth (\$\S+): undoing this would take it below zero\.$/, (name, worth) => `${name} vale ${worth}: deshacer esto lo dejaría debajo de cero.`],
  [
    /^(.+) has (\$\S+) left to pay: undoing this would take it below zero\.$/,
    (name, left) => `A ${name} le quedan ${left} por pagar: deshacer esto lo dejaría debajo de cero.`,
  ],
  [/^(.+) only has (\$\S+) left to pay\.$/, (name, left) => `A ${name} solo le quedan ${left} por pagar.`],
  [/^(.+) was removed, so this can't be undone\.$/, (name) => `${name} se eliminó, así que esto no se puede deshacer.`],
  [
    /^You've reached the limit of (\d+) recorded changes\. Undo some to record new ones\.$/,
    (n) => `Llegaste al límite de ${n} cambios registrados. Deshacé algunos para registrar nuevos.`,
  ],
  [/^You've reached the limit of (\d+) snapshots\.$/, (n) => `Llegaste al límite de ${n} fotos.`],
  [/^A snapshot already exists for (.+)$/, (when) => `Ya hay una foto de ese momento (${when})`],
  [/^You can set up to (\d+) asset classes\. Remove one to add another\.$/, (n) => `Podés tener hasta ${n} clases. Eliminá una para agregar otra.`],
  [/^You can track up to (\d+) holdings\. Remove one to add another\.$/, (n) => `Podés seguir hasta ${n} activos. Eliminá uno para agregar otro.`],
  [/^You can track up to (\d+) debts\. Remove one to add another\.$/, (n) => `Podés seguir hasta ${n} deudas. Eliminá una para agregar otra.`],
  [
    /^You can customize up to (\d+) platforms\. Reset one to customize another\.$/,
    (n) => `Podés personalizar hasta ${n} plataformas. Volvé una al original para personalizar otra.`,
  ],
  [/^There's already a class named "(.+)"$/, (name) => `Ya hay una clase llamada "${name}"`],
  [/^There's already a platform named "(.+)"$/, (name) => `Ya hay una plataforma llamada "${name}"`],
  [/^(.+) still has assets: say which class they move to \(moveTo\)$/, (name) => `${name} todavía tiene activos: elegí a qué clase pasan`],
  [/^(Holding|Debt|Movement|Snapshot) \S+ not found$/, (what) => NOT_FOUND[what]],
  [/^Name must be at most (\d+) characters$/, (n) => `El nombre puede tener hasta ${n} caracteres`],
  [/^type must be at most (\d+) characters$/, (n) => `El tipo puede tener hasta ${n} caracteres`],
  [/^(Note|Notes|Debt name|Lender) exceeds max length \(\d+ > (\d+)\)$/, (field, max) => `${LONG_FIELD[field]} puede tener hasta ${max} caracteres`],
  [/^Request failed with status (\d+)$/, (status) => `El pedido falló (estado ${status})`],
];

/** One message (no "; " in it) in Spanish, or as it came. */
function toSpanish(message: string): string {
  if (message in EXACT) return EXACT[message];
  for (const [pattern, say] of PATTERNS) {
    const match = pattern.exec(message);
    if (match) return say(...match.slice(1));
  }
  return message;
}

/** What the API said, in the app's language: Spanish (here) or English (as it came). */
export function translateApiMessage(message: string, language: 'en' | 'es'): string {
  return language === 'es' ? message.split('; ').map(toSpanish).join('; ') : message;
}
