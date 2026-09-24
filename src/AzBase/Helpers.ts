import { DefaultAzureCredential, TokenCredential } from '@azure/identity';
import * as pulumi from '@pulumi/pulumi';
import { ResourceInfo } from '../types';

let credential: TokenCredential | undefined;
/** One shared credential per process so the token cache is reused across clients. */
export const getCredential = (): TokenCredential =>
  (credential ??= new DefaultAzureCredential());

export const sleep = (seconds: number) =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

export const waitAndRetry = async <T>(
  caller: () => Promise<T>,
  { eachSecond = 15, times = 4 }: { eachSecond?: number; times?: number } = {},
): Promise<T> => {
  let rs = await caller();

  for (let count = 0; !rs && count < times; count++) {
    await sleep(eachSecond);
    rs = await caller();
  }

  return rs;
};

/** Readable message for any thrown value (never `[object Object]`). */
export const errorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  const message = (err as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : JSON.stringify(err);
};

/** Use as `.catch(ignoreNotFound)`: swallows 404s only, rethrows everything else. */
export const ignoreNotFound = (err: { statusCode?: number }) => {
  if (err?.statusCode === 404) return undefined;
  throw err;
};

/** Drain an Azure SDK paged iterator into an array. */
export const collect = async <T>(items: AsyncIterable<T>): Promise<T[]> => {
  const list: T[] = [];
  for await (const item of items) list.push(item);
  return list;
};

/** List resources as ResourceInfo, optionally filtered by name. */
export const searchResources = async (
  items: AsyncIterable<{ id?: string }>,
  filter?: string,
): Promise<ResourceInfo[]> => {
  const list = (await collect(items)).map((a) => getResourceInfoFromId(a.id!));
  return filter ? list.filter((a) => a.resourceName.includes(filter)) : list;
};

/**
 * Generic dynamic-provider diff: compares every input key (except output-only keys)
 * and marks the ones in `replaceKeys` as requiring a replacement.
 */
export const diffProps = (
  olds: object,
  news: object,
  {
    replaceKeys = [],
    outputKeys = [],
  }: { replaceKeys?: string[]; outputKeys?: string[] } = {},
): pulumi.dynamic.DiffResult => {
  const o = olds as Record<string, unknown>;
  const n = news as Record<string, unknown>;
  const keys = new Set([...Object.keys(o), ...Object.keys(n)]);
  const changed = [...keys].filter(
    (k) => !outputKeys.includes(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k]),
  );
  return {
    changes: changed.length > 0,
    replaces: changed.filter((k) => replaceKeys.includes(k)),
  };
};

export const getResourceInfoFromId = (id: string): ResourceInfo => {
  const details = id.split('/');
  let name = '';
  let groupName = '';
  let subId = '';

  details.forEach((d, index) => {
    if (d === 'subscriptions') subId = details[index + 1];
    if (d === 'resourceGroups' || d === 'resourcegroups')
      groupName = details[index + 1];
    if (index === details.length - 1) name = d;
  });

  return {
    resourceName: name,
    id: id,
    resourceGroupName: groupName,
    subscriptionId: subId,
  };
};
