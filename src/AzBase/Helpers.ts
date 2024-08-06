import { ResourceInfo } from '../types';

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
