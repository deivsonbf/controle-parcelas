function field(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function normalize(value: string, maxLength: number) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

function normalizePixKey(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 || digits.length === 14 ? digits : value.trim();
}

function crc16(payload: string) {
  let result = 0xffff;

  for (let index = 0; index < payload.length; index += 1) {
    result ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      result = (result & 0x8000) !== 0 ? (result << 1) ^ 0x1021 : result << 1;
      result &= 0xffff;
    }
  }

  return result.toString(16).toUpperCase().padStart(4, '0');
}

export function createPixPayload({
  key,
  amount,
  receiverName,
  receiverCity
}: {
  key: string;
  amount: number;
  receiverName: string;
  receiverCity: string;
}) {
  const merchantAccount = field('00', 'BR.GOV.BCB.PIX') + field('01', normalizePixKey(key));
  const additionalData = field('05', '***');
  const payload = [
    field('00', '01'),
    field('26', merchantAccount),
    field('52', '0000'),
    field('53', '986'),
    ...(amount > 0 ? [field('54', amount.toFixed(2))] : []),
    field('58', 'BR'),
    field('59', normalize(receiverName, 25)),
    field('60', normalize(receiverCity, 15)),
    field('62', additionalData),
    '6304'
  ].join('');

  return `${payload}${crc16(payload)}`;
}
