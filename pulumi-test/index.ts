import { Aks, SqlServer, VM, VMS } from '@drunk-pulumi/azure-providers/AzBase';
import * as pulumi from '@pulumi/pulumi';

const rs = (async () => {
  console.log(
    await new SqlServer('63a31b41-eb5d-4160-9fc9-d30fc00286c9').search(),
  );
})();

export default pulumi.output(rs);
