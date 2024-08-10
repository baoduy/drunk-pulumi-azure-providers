import { ResourceInfo } from '../types';

export const sleep = (seconds: number) =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

export const waitAndRetry = async <T>(
  caller: () => Promise<T>,
  { eachSecond = 15, times = 4 }: { eachSecond?: number; times?: number } = {
    eachSecond: 15,
    times: 4,
  },
): Promise<T> => {
  let rs = await caller();

  let count = 0;
  while (!rs && count < times) {
    await sleep(eachSecond);
    rs = await caller();
  }

  return rs;
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
