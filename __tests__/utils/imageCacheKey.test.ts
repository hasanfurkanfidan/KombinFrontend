import { imageCacheKey } from '@/utils/imageCacheKey';

const BASE = 'https://storage.kombin.test/kombin/social/u1/p1/feed.jpg';

describe('imageCacheKey', () => {
  it('is the same for the same path with a different signature', () => {
    const first = imageCacheKey(
      `${BASE}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&X-Amz-Signature=aaa`,
    );
    const second = imageCacheKey(
      `${BASE}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&X-Amz-Signature=bbb`,
    );

    expect(first).toBe(BASE);
    expect(second).toBe(first);
  });

  it('differs for a different path, and for the same path on another host', () => {
    const signed = (url: string) => imageCacheKey(`${url}?X-Amz-Signature=aaa`);

    expect(signed(BASE)).not.toBe(
      signed('https://storage.kombin.test/kombin/social/u1/p2/feed.jpg'),
    );
    expect(signed(BASE)).not.toBe(signed('https://other.test/kombin/social/u1/p1/feed.jpg'));
  });

  it('drops every signing and expiry parameter of a signed link, in any case', () => {
    expect(
      imageCacheKey(
        `${BASE}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=k%2F20261118&X-Amz-Date=20261118T100000Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=aaa`,
      ),
    ).toBe(BASE);
    expect(imageCacheKey(`${BASE}?x-amz-signature=aaa`)).toBe(BASE);
    expect(imageCacheKey(`${BASE}?Expires=1&Signature=aaa&AWSAccessKeyId=k`)).toBe(BASE);
    expect(imageCacheKey(`${BASE}?X-Goog-Date=1&X-Goog-Expires=3600&X-Goog-Signature=aaa`)).toBe(
      BASE,
    );
    expect(imageCacheKey(`${BASE}?sv=2024&se=2026-11-18&sr=b&sp=r&sig=aaa`)).toBe(BASE);
    expect(imageCacheKey(`${BASE}?sig=aaa#frag`)).toBe(BASE);
  });

  it('keeps a parameter that changes the picture next to the signature: two sizes are two pictures', () => {
    const small = imageCacheKey('https://cdn.shop.test/p/1.jpg?w=300&sig=aaa');
    const large = imageCacheKey('https://cdn.shop.test/p/1.jpg?w=600&sig=bbb');
    const smallAgain = imageCacheKey('https://cdn.shop.test/p/1.jpg?sig=ccc&w=300&Expires=9');

    expect(small).toBe('https://cdn.shop.test/p/1.jpg?w=300');
    expect(large).toBe('https://cdn.shop.test/p/1.jpg?w=600');
    expect(small).not.toBe(large);
    // The same picture with a new signature, and the parameters in another order, is still one entry.
    expect(smallAgain).toBe(small);
    expect(imageCacheKey('https://cdn.shop.test/p/1.jpg?h=40&w=300&X-Amz-Signature=a')).toBe(
      imageCacheKey('https://cdn.shop.test/p/1.jpg?X-Amz-Signature=b&w=300&h=40'),
    );
  });

  it('leaves an unsigned address alone: a CDN query that picks the size makes a different picture', () => {
    expect(imageCacheKey('https://cdn.shop.test/p/1.jpg?w=300')).toBeUndefined();
    expect(imageCacheKey('https://cdn.shop.test/p/1.jpg?w=600')).toBeUndefined();
    expect(imageCacheKey('https://cdn.shop.test/p/1.jpg')).toBeUndefined();
    expect(imageCacheKey('https://cdn.shop.test/p/1.jpg?designation=1')).toBeUndefined();
  });

  it('does not key local files, data URIs or an empty address', () => {
    expect(imageCacheKey('file:///cache/ImagePicker/a.jpg?sig=1')).toBeUndefined();
    expect(imageCacheKey('data:image/png;base64,AAAA')).toBeUndefined();
    expect(imageCacheKey('')).toBeUndefined();
  });
});
