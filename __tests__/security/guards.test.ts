import { deleteAsync } from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';

import { screenName } from '@/analytics/screenName';
import { apiUrlProblem } from '@/api/client';
import { getLegal } from '@/api/endpoints/legal';
import { buildGoUrl, isGoPath, openOffer } from '@/features/catalog/buy';
import { isAllowedLegalUrl, openLegalPage } from '@/features/legal/legal';
import { queryClient } from '@/api/queryClient';
import { discardTempFile, isAppTempFile } from '@/utils/tempFiles';
import { handleParam, inAppPath, uuidParam } from '@/utils/routeParams';

jest.mock('@/api/endpoints/legal');

declare const __dirname: string;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- typed by hand; no Node types to import with
const fs = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
  readdirSync: (path: string, options: { recursive: true }) => string[];
};

const ID = '6f1c2a8e-1b2c-4d3e-8f90-123456789abc';

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
});

describe('the API address', () => {
  it('lets a development build use http (LAN, emulator) and https', () => {
    expect(apiUrlProblem('http://10.0.2.2:8081', true)).toBeNull();
    expect(apiUrlProblem('http://192.168.1.20:8081', true)).toBeNull();
    expect(apiUrlProblem('https://api.kombin.test', true)).toBeNull();
  });

  it('refuses anything but https in a release build', () => {
    expect(apiUrlProblem('https://api.kombin.test', false)).toBeNull();
    expect(apiUrlProblem('http://api.kombin.test', false)).toMatch(/https/);
    expect(apiUrlProblem(undefined, false)).toMatch(/not set/);
    expect(apiUrlProblem('ftp://api.kombin.test', false)).not.toBeNull();
    expect(apiUrlProblem('not a url', false)).not.toBeNull();
  });

  it('accepts a plain origin only', () => {
    expect(apiUrlProblem('https://user:pw@api.kombin.test', false)).not.toBeNull();
    expect(apiUrlProblem('https://api.kombin.test?x=1', false)).not.toBeNull();
    expect(apiUrlProblem('https://api.kombin.test#x', false)).not.toBeNull();
  });
});

describe('route params from outside the app', () => {
  it('takes ids only when they are uuids', () => {
    expect(uuidParam(ID)).toBe(ID);
    expect(uuidParam([ID, 'x'])).toBe(ID);
    expect(uuidParam('..')).toBeNull();
    expect(uuidParam('p1/../../me')).toBeNull();
    expect(uuidParam(undefined)).toBeNull();
  });

  it('takes handles only in the backend shape', () => {
    expect(handleParam('ayse.style')).toBe('ayse.style');
    expect(handleParam('a')).toBeNull();
    expect(handleParam('../x')).toBeNull();
    expect(handleParam('ayse?x=1')).toBeNull();
  });

  it('follows returnTo only inside the app', () => {
    expect(inAppPath('/profile')).toBe('/profile');
    expect(inAppPath('/(tabs)/profile')).toBe('/(tabs)/profile');
    expect(inAppPath('https://evil.example')).toBeUndefined();
    expect(inAppPath('//evil.example')).toBeUndefined();
    expect(inAppPath('/profile?next=https://evil.example')).toBeUndefined();
    expect(inAppPath('javascript:alert(1)')).toBeUndefined();
  });
});

describe('buy links', () => {
  it('only ever opens the API origin + a /go path', async () => {
    expect(isGoPath(`/api/v1/go/${ID}`)).toBe(true);
    expect(isGoPath(`/api/v1/go/${ID}?src=feed&post=${ID}`)).toBe(true);
    expect(isGoPath('@evil.example/x')).toBe(false);
    expect(isGoPath('//evil.example/api/v1/go/1')).toBe(false);
    expect(isGoPath('/api/v1/me')).toBe(false);
    expect(() => buildGoUrl('@evil.example')).toThrow();

    await openOffer({ id: 'o1', goPath: '.evil.example/api/v1/go/1' });
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
    await openOffer({ id: 'o1', goPath: `/api/v1/go/${ID}` });
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      `http://api.test/api/v1/go/${ID}?src=product_detail`,
    );
  });
});

describe('legal links', () => {
  it('opens only pages on the API origin (or an allow-listed https host)', () => {
    expect(
      isAllowedLegalUrl('https://api.kombin.test/legal/privacy', 'https://api.kombin.test'),
    ).toBe(true);
    expect(isAllowedLegalUrl('https://evil.example/legal/privacy', 'https://api.kombin.test')).toBe(
      false,
    );
    expect(
      isAllowedLegalUrl('http://api.kombin.test/legal/privacy', 'https://api.kombin.test'),
    ).toBe(false);
    expect(isAllowedLegalUrl('https://u:p@api.kombin.test/legal', 'https://api.kombin.test')).toBe(
      false,
    );
    expect(isAllowedLegalUrl('javascript:alert(1)', 'https://api.kombin.test')).toBe(false);
  });

  it('does not open a legal URL the API answered with on another host', async () => {
    jest.mocked(getLegal).mockResolvedValue({
      version: '1',
      privacyUrl: 'https://evil.example/privacy',
      termsUrl: 'https://evil.example/terms',
      deleteAccountUrl: 'https://evil.example/delete',
    } as Awaited<ReturnType<typeof getLegal>>);

    await openLegalPage('privacy');

    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });
});

describe('analytics screen names', () => {
  it('never carry a handle or an id', () => {
    expect(screenName('/creators/ayse.style')).toBe('creators/:handle');
    expect(screenName(`/product/${ID}`)).toBe('product/:id');
    expect(screenName('/users/not-a-uuid')).toBe('users/:id');
    expect(screenName('/posts/new')).toBe('posts/new');
    expect(screenName('/posts/mine')).toBe('posts/mine');
    expect(screenName('/outfits/daily')).toBe('outfits/daily');
    expect(screenName('/outfits/x1')).toBe('outfits/:id');
    expect(screenName('/profile/sizes')).toBe('profile/sizes');
  });
});

describe('temporary photos', () => {
  it('deletes only files the app made in its own cache', async () => {
    expect(isAppTempFile('file:///cache/ImageManipulator/a.jpg')).toBe(true);
    expect(isAppTempFile('file:///cache/ImagePicker/b.heic')).toBe(true);
    expect(isAppTempFile('file:///cache/ImagePicker/../secret')).toBe(false);
    expect(isAppTempFile('file:///cache/other/a.jpg')).toBe(false);
    expect(isAppTempFile('content://media/external/images/1')).toBe(false);
    expect(isAppTempFile('ph://ABC')).toBe(false);

    await discardTempFile('content://media/external/images/1');
    expect(deleteAsync).not.toHaveBeenCalled();
    await discardTempFile('file:///cache/ImageManipulator/a.jpg');
    expect(deleteAsync).toHaveBeenCalledWith('file:///cache/ImageManipulator/a.jpg', {
      idempotent: true,
    });
  });
});

describe('logging', () => {
  const ROOT = `${__dirname}/../../src`;

  it('every console call in src is inside a __DEV__ branch (nothing is logged in production)', () => {
    const offenders: string[] = [];
    for (const file of fs.readdirSync(ROOT, { recursive: true })) {
      if (!/\.(ts|tsx)$/.test(file) || file.includes('types.gen')) {
        continue;
      }
      const lines = fs.readFileSync(`${ROOT}/${file}`, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (/\bconsole\.(log|info|warn|error|debug)\(/.test(line)) {
          const context = lines.slice(Math.max(0, index - 3), index + 1).join('\n');
          if (!/__DEV__/.test(context)) {
            offenders.push(`${file}:${index + 1}`);
          }
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
