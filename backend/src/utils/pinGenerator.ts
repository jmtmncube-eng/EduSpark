const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePin(): string {
  let p = 'SPK-';
  for (let i = 0; i < 4; i++) {
    p += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return p;
}

export async function makeUniquePin(
  checkExists: (pin: string) => Promise<boolean>
): Promise<string> {
  let pin = generatePin();
  while (await checkExists(pin)) {
    pin = generatePin();
  }
  return pin;
}
