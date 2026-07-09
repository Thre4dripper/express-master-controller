import * as grpc from '@grpc/grpc-js';

export interface GrpcCallContext<TRequest = any, TResponse = any> {
    request: TRequest;
    metadata: grpc.Metadata;
    call:
        | grpc.ServerUnaryCall<TRequest, TResponse>
        | grpc.ServerWritableStream<TRequest, TResponse>
        | grpc.ServerReadableStream<TRequest, TResponse>
        | grpc.ServerDuplexStream<TRequest, TResponse>;
}

export type GrpcMiddleware<TRequest = any, TResponse = any> = (
    callContext: GrpcCallContext<TRequest, TResponse>
) => Promise<void> | void;

export const executeGrpcMiddlewares = async <TRequest = any, TResponse = any>(
    middlewares: GrpcMiddleware<TRequest, TResponse>[],
    callContext: GrpcCallContext<TRequest, TResponse>
): Promise<void> => {
    for (const middleware of middlewares) {
        await middleware(callContext);
    }
};
