const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function gen(prefix: string): string {
  let p = prefix + '-';
  for (let i = 0; i < 4; i++) p += CHARS[Math.floor(Math.random() * CHARS.length)];
  return p;
}

export const generatePin = () => gen('SPK');
export const generateTutorPin = () => gen('TCH');
export const generateAdminPin = () => gen('ADM');

export async function makeUniquePin(
  checkExists: (pin: string) => Promise<boolean>,
  generator: () => string = generatePin
): Promise<string> {
  let pin = generator();
  while (await checkExists(pin)) pin = generator();
  return pin;
}
