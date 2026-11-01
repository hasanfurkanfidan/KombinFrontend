import * as WebBrowser from 'expo-web-browser';

import { buildGoUrl, openOffer } from '@/features/catalog/buy';

describe('buy via /go', () => {
  it('builds the redirect URL from the API origin and the offer goPath only', () => {
    expect(buildGoUrl('/api/v1/go/o1')).toBe('http://api.test/api/v1/go/o1?src=product_detail');
  });

  it('adds the active persona', () => {
    expect(buildGoUrl('/api/v1/go/o1', { personaId: 'pe 1' })).toBe(
      'http://api.test/api/v1/go/o1?src=product_detail&personaId=pe%201',
    );
  });

  it('names other sources and tolerates a goPath that already has a query', () => {
    expect(buildGoUrl('/api/v1/go/o1?x=1', { source: 'saved' })).toBe(
      'http://api.test/api/v1/go/o1?x=1&src=saved',
    );
  });

  it('opens the redirect in the in-app browser, and survives a browser failure', async () => {
    const open = jest.mocked(WebBrowser.openBrowserAsync);
    await openOffer({ goPath: '/api/v1/go/o2' }, { personaId: 'pe1' });
    expect(open).toHaveBeenLastCalledWith(
      'http://api.test/api/v1/go/o2?src=product_detail&personaId=pe1',
    );

    open.mockRejectedValueOnce(new Error('no browser'));
    await expect(openOffer({ goPath: '/api/v1/go/o2' })).resolves.toBeUndefined();
  });
});
