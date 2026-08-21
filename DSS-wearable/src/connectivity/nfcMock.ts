export async function mockNfcRead(): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return 'mock-wristband-01';
}
