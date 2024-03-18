import { authorization } from "@pulumi/azure-native";
import { GetClientConfigResult } from "@pulumi/azure-native/authorization/getClientConfig";
import { GetClientTokenResult } from "@pulumi/azure-native/authorization/getClientToken";

let cache: (GetClientConfigResult & GetClientTokenResult) | undefined =
  undefined;

export const getAzureToken = async (
  endpoint: string = "https://management.azure.com",
): Promise<GetClientConfigResult & GetClientTokenResult> => {
  if (cache) return cache;

  const [config, token] = await Promise.all([
    authorization.getClientConfig(),
    authorization.getClientToken({ endpoint }),
  ]);

  cache = { ...config, ...token };
  return cache;
};
