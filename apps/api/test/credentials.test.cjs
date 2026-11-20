const {
  hashPassword,
  matchesPassword,
  randomToken,
  tokenHash,
} = require("../dist/auth/credentials");

test("senha idêntica gera hash diferente com sal exclusivo e valida apenas a senha correta", async () => {
  const password = "uma-senha-forte-123";
  const [first, second] = await Promise.all([hashPassword(password), hashPassword(password)]);
  expect(first).not.toBe(second);
  expect(first).not.toContain(password);
  expect(await matchesPassword(password, first)).toBe(true);
  expect(await matchesPassword(password + "x", first)).toBe(false);
  expect(await matchesPassword(password)).toBe(false);
});

test("tokens opacos são aleatórios e o digest é estável", () => {
  const first = randomToken();
  const second = randomToken();
  expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(second).not.toBe(first);
  expect(tokenHash(first)).toMatch(/^[a-f0-9]{64}$/);
  expect(tokenHash(first)).toBe(tokenHash(first));
  expect(tokenHash(first)).not.toBe(tokenHash(second));
});
