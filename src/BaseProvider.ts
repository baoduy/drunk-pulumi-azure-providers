import * as pulumi from "@pulumi/pulumi";

/**
 * DynamicProviderInputs represents the inputs that are passed as inputs
 * to each function in the implementation of a `pulumi.dynamic.ResourceProvider`.
 */
export interface DefaultInputs {}

/**
 * The Outputs represents the output type of `create` function in the
 * dynamic resource provider.
 */
export interface DefaultOutputs extends Omit<DefaultInputs, "result"> {
  name: string;
}

export type DeepInput<T> = T extends object
  ? { [K in keyof T]: DeepInput<T[K]> | pulumi.Input<T[K]> }
  : pulumi.Input<T>;

export type DeepOutput<T> = T extends object
  ? { [K in keyof T]: DeepOutput<T[K]> | pulumi.Output<T[K]> }
  : pulumi.Output<T>;

export type BaseOptions<TOptions = DefaultInputs> = DeepInput<TOptions>;

export type BaseOutputs<TOptions = DefaultOutputs> = DeepOutput<TOptions>;

export interface BaseProvider<
  TInputs extends DefaultInputs,
  TOutputs extends DefaultOutputs,
> extends pulumi.dynamic.ResourceProvider {
  check?: (olds: TInputs, news: TInputs) => Promise<pulumi.dynamic.CheckResult>;

  diff?: (
    id: string,
    previousOutput: TOutputs,
    news: TInputs,
  ) => Promise<pulumi.dynamic.DiffResult>;

  create: (inputs: TInputs) => Promise<pulumi.dynamic.CreateResult>;
  read?: (id: string, props: TOutputs) => Promise<pulumi.dynamic.ReadResult>;
  update?: (
    id: string,
    olds: TOutputs,
    news: TInputs,
  ) => Promise<pulumi.dynamic.UpdateResult>;
  delete?: (id: string, props: TOutputs) => Promise<void>;
}

export abstract class BaseResource<
  TInputs extends DefaultInputs,
  TOutputs extends DefaultOutputs,
> extends pulumi.dynamic.Resource {
  constructor(
    provider: BaseProvider<TInputs, TOutputs>,
    name: string,
    args: BaseOptions<TInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(provider, name, args, opts);
  }
}
