import { describe, expect, it } from 'vitest';

import * as requestAdapter from './oauth-request.adapter.ts';

describe('OAuthRequestAdapter', () => {
  it('keeps request reconstruction available through the focused adapter', () => {
    expect(requestAdapter.OAuthRequestAdapter).toBeDefined();
    expect(
      requestAdapter.OAuthRequestAdapter.toRequest({
        headers: { host: 'resource.local' },
      }).url,
    ).toBe('http://resource.local/');
  });
});
