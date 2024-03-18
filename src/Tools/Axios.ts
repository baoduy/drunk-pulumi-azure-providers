import axios from "axios";
import { getAzureToken } from "../AzBase/Internal";

export const createAxios = () => {
  let token: string | undefined;
  let baseUrl: string | undefined;

  const axiosWrapper = axios.create();

  axiosWrapper.interceptors.request.use(async (config) => {
    if (!token) {
      const info = await getAzureToken("https://management.azure.com");
      token = info.token;
      baseUrl = `https://management.azure.com/subscriptions/${info.subscriptionId}`;
    }

    if (!config.url!.startsWith("http")) {
      config.url = config.url!.includes("subscriptions")
        ? "https://management.azure.com" + config.url
        : baseUrl + config.url!;
    }

    config.headers.set("Authorization", `Bearer ${token}`);
    return config;
  });

  // axiosWrapper.interceptors.response.use(
  //   // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  //   (rs) => rs
  // );
  return axiosWrapper;
};
