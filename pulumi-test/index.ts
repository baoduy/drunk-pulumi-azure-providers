import * as pulumi from '@pulumi/pulumi';
import { PGPResource } from '@drunk-pulumi/azure-providers';

const rs = (async () => {
  const vault = new PGPResource('global-drunkcoding-vlt', { user: { email: 'drunk@coding.net', name: 'drunkcoding' } });

})();

export default pulumi.output(rs);
