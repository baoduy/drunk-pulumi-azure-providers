const config = JSON.parse(process.env.PULUMI_CONFIG ?? '{}');
export const subscriptionId = config[
    'azure-native:config:subscriptionId'
    ] as string;