import { loginSchema, registerSchema } from '@/features/auth/schemas';
import { tr } from '@/i18n/tr';

const valid = { displayName: 'Ayşe Yılmaz', email: 'ayse@example.com', password: 'sifre1234' };

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe('registerSchema', () => {
  it('accepts valid input and trims name and email', () => {
    const result = registerSchema.safeParse({
      displayName: '  Ayşe  ',
      email: ' ayse@example.com ',
      password: 'sifre1234',
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ displayName: 'Ayşe', email: 'ayse@example.com' });
  });

  it.each(['', 'not-an-email', 'a@b', 'a b@c.com'])('rejects the email %p in Turkish', (email) => {
    const result = registerSchema.safeParse({ ...valid, email });

    expect(result.success).toBe(false);
    expect(messages(result)).toContain(
      email === '' ? tr.validationEmailRequired : tr.validationEmailInvalid,
    );
  });

  it('requires at least 8 characters, a letter and a digit', () => {
    expect(messages(registerSchema.safeParse({ ...valid, password: 'abc123' }))).toEqual([
      tr.validationPasswordMin,
    ]);
    expect(messages(registerSchema.safeParse({ ...valid, password: '12345678' }))).toEqual([
      tr.validationPasswordLetter,
    ]);
    expect(messages(registerSchema.safeParse({ ...valid, password: 'abcdefgh' }))).toEqual([
      tr.validationPasswordDigit,
    ]);
  });

  it('counts non-ASCII letters as letters', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'şifreler1' }).success).toBe(true);
  });

  it('keeps the display name between 2 and 50 characters', () => {
    expect(messages(registerSchema.safeParse({ ...valid, displayName: 'A' }))).toEqual([
      tr.validationDisplayNameMin,
    ]);
    expect(messages(registerSchema.safeParse({ ...valid, displayName: ' A ' }))).toEqual([
      tr.validationDisplayNameMin,
    ]);
    expect(messages(registerSchema.safeParse({ ...valid, displayName: 'A'.repeat(51) }))).toEqual([
      tr.validationDisplayNameMax,
    ]);
    expect(registerSchema.safeParse({ ...valid, displayName: 'A'.repeat(50) }).success).toBe(true);
  });
});

describe('loginSchema', () => {
  it('accepts any non-empty password (the server decides)', () => {
    expect(loginSchema.safeParse({ email: 'ayse@example.com', password: 'x' }).success).toBe(true);
  });

  it('asks for both fields in Turkish', () => {
    const result = loginSchema.safeParse({ email: '', password: '' });

    expect(messages(result)).toEqual([tr.validationEmailRequired, tr.validationPasswordRequired]);
  });
});
