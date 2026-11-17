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

  it('drops the whole query of a signed link, whatever else it carries and in any case', () => {
    expect(imageCacheKey(`${BASE}?response-cache-control=private&x-amz-signature=aaa`)).toBe(BASE);
    expect(imageCacheKey(`${BASE}?Expires=1&Signature=aaa&AWSAccessKeyId=k`)).toBe(BASE);
    expect(imageCacheKey(`${BASE}?sig=aaa#frag`)).toBe(BASE);
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
