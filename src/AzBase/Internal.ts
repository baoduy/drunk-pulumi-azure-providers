import { authorization } from "@pulumi/azure-native";

export const getToken = (resource:string='https://management.azure.com')=>{
const rs = Promise.all(authorization.)
}