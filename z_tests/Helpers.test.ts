import assert from 'node:assert/strict';
import {
  diffProps,
  errorMessage,
  getResourceInfoFromId,
  ignoreNotFound,
  waitAndRetry,
} from '../src/AzBase/Helpers';

describe('Helpers', () => {
  it('waitAndRetry gives up after `times` retries instead of looping forever', async () => {
    let calls = 0;
    const rs = await waitAndRetry(
      async () => {
        calls++;
        return undefined;
      },
      { eachSecond: 0.001, times: 3 },
    );
    assert.equal(rs, undefined);
    assert.equal(calls, 4); // first call + 3 retries
  });

  it('waitAndRetry returns as soon as the caller succeeds', async () => {
    let calls = 0;
    const rs = await waitAndRetry(async () => (++calls === 2 ? 'ok' : ''), {
      eachSecond: 0.001,
    });
    assert.equal(rs, 'ok');
    assert.equal(calls, 2);
  });

  it('ignoreNotFound swallows 404 only', () => {
    assert.equal(ignoreNotFound({ statusCode: 404 }), undefined);
    assert.throws(() => ignoreNotFound({ statusCode: 403 }));
  });

  it('getResourceInfoFromId parses an ARM id', () => {
    assert.deepEqual(
      getResourceInfoFromId(
        '/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.KeyVault/vaults/kv-1',
      ),
      {
        id: '/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.KeyVault/vaults/kv-1',
        subscriptionId: 'sub-1',
        resourceGroupName: 'rg-1',
        resourceName: 'kv-1',
      },
    );
  });

  it('diffProps flags changes, replacements and ignores output keys', () => {
    const olds = { name: 'a', tags: { x: '1' }, version: 'v1' };
    assert.deepEqual(
      diffProps(olds, { name: 'a', tags: { x: '1' }, version: undefined }, {
        outputKeys: ['version'],
      }),
      { changes: false, replaces: [] },
    );
    assert.deepEqual(
      diffProps(olds, { name: 'b', tags: { x: '2' } }, {
        replaceKeys: ['name'],
        outputKeys: ['version'],
      }),
      { changes: true, replaces: ['name'] },
    );
  });
});

describe('errorMessage', () => {
  it('never falls back to [object Object]', () => {
    assert.equal(errorMessage(new Error('boom')), 'boom');
    assert.equal(errorMessage('plain'), 'plain');
    assert.equal(errorMessage({ message: 'rest error' }), 'rest error');
    assert.equal(errorMessage({ code: 403 }), '{"code":403}');
  });
});
