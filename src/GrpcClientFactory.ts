import * as grpc from '@grpc/grpc-js';

export interface GrpcClientConfig {
    address: string;
    credentials?: grpc.ChannelCredentials;
    options?: grpc.ClientOptions;
    onError?: (error: grpc.ServiceError) => void | never;
}

type UnaryMethodNames<TClient> = {
    [K in keyof TClient]: TClient[K] extends (request: any, ...args: any[]) => grpc.ClientUnaryCall
        ? K
        : never;
}[keyof TClient];

type ServerStreamMethodNames<TClient> = {
    [K in keyof TClient]: TClient[K] extends (
        request: any,
        ...args: any[]
    ) => grpc.ClientReadableStream<any>
        ? K
        : never;
}[keyof TClient];

type ClientStreamMethodNames<TClient> = {
    [K in keyof TClient]: TClient[K] extends (...args: any[]) => grpc.ClientWritableStream<any>
        ? K
        : never;
}[keyof TClient];

type BidiStreamMethodNames<TClient> = {
    [K in keyof TClient]: TClient[K] extends (...args: any[]) => grpc.ClientDuplexStream<any, any>
        ? K
        : never;
}[keyof TClient];

type ExtractUnaryRequest<TClient, TMethod extends keyof TClient> = TClient[TMethod] extends (
    request: infer TRequest,
    ...args: any[]
) => any
    ? TRequest
    : never;

type ExtractUnaryResponse<TClient, TMethod extends keyof TClient> = TClient[TMethod] extends {
    (request: any, callback: (error: any, response: infer TResponse) => void): any;
    (request: any, metadata: any, callback: (error: any, response: any) => void): any;
    (request: any, metadata: any, options: any, callback: (error: any, response: any) => void): any;
}
    ? TResponse
    : TClient[TMethod] extends (
            request: any,
            callback: (error: any, response: infer TResponse) => void
        ) => any
      ? TResponse
      : never;

type ExtractServerStreamRequest<TClient, TMethod extends keyof TClient> = TClient[TMethod] extends (
    request: infer TRequest,
    ...args: any[]
) => any
    ? TRequest
    : never;

type ExtractServerStreamResponse<
    TClient,
    TMethod extends keyof TClient,
> = TClient[TMethod] extends (...args: any[]) => grpc.ClientReadableStream<infer TResponse>
    ? TResponse
    : never;

type ExtractClientStreamRequest<TClient, TMethod extends keyof TClient> = TClient[TMethod] extends (
    ...args: any[]
) => grpc.ClientWritableStream<infer TRequest>
    ? TRequest
    : never;

type ExtractClientStreamResponse<
    TClient,
    TMethod extends keyof TClient,
> = TClient[TMethod] extends {
    (callback: (error: any, response: infer TResponse) => void): any;
    (metadata: any, callback: (error: any, response: any) => void): any;
    (metadata: any, options: any, callback: (error: any, response: any) => void): any;
}
    ? TResponse
    : never;

type ExtractBidiStreamRequest<TClient, TMethod extends keyof TClient> = TClient[TMethod] extends (
    ...args: any[]
) => grpc.ClientDuplexStream<infer TRequest, any>
    ? TRequest
    : never;

type ExtractBidiStreamResponse<TClient, TMethod extends keyof TClient> = TClient[TMethod] extends (
    ...args: any[]
) => grpc.ClientDuplexStream<any, infer TResponse>
    ? TResponse
    : never;

export class GrpcClientFactory {
    private static clientCache = new Map<
        string,
        { client: grpc.Client; config: GrpcClientConfig }
    >();

    static getOrCreateClient<TClient extends grpc.Client>(
        cacheKey: string,
        ClientCtor: new (
            address: string,
            credentials: grpc.ChannelCredentials,
            options?: grpc.ClientOptions
        ) => TClient,
        config: GrpcClientConfig
    ): TClient {
        const cached = this.clientCache.get(cacheKey);
        if (cached) return cached.client as TClient;

        const client = new ClientCtor(
            config.address,
            config.credentials ?? grpc.credentials.createInsecure(),
            config.options
        );

        this.clientCache.set(cacheKey, { client, config });
        return client;
    }

    static closeClient(cacheKey: string): void {
        const cached = this.clientCache.get(cacheKey);
        if (cached) {
            cached.client.close();
            this.clientCache.delete(cacheKey);
        }
    }

    static closeAllClients(): void {
        this.clientCache.forEach(({ client }) => client.close());
        this.clientCache.clear();
    }

    static unary<TClient extends grpc.Client, TMethod extends UnaryMethodNames<TClient>>(
        client: TClient,
        methodName: TMethod,
        request: ExtractUnaryRequest<TClient, TMethod>,
        metadata?: grpc.Metadata,
        options?: grpc.CallOptions
    ): Promise<ExtractUnaryResponse<TClient, TMethod>> {
        const method = this.getMethod(client, methodName as string);

        return new Promise((resolve, reject) => {
            const callback = (
                error: grpc.ServiceError | null,
                response: ExtractUnaryResponse<TClient, TMethod>
            ) => {
                if (error) {
                    const normalized = this.normalizeError(error);
                    const cached = this.findClientConfig(client);
                    if (cached?.config.onError) {
                        try {
                            cached.config.onError(normalized);
                        } catch (handled) {
                            return reject(handled);
                        }
                    }
                    return reject(normalized);
                }
                resolve(response);
            };

            if (metadata) {
                method(request, metadata, options ?? {}, callback);
            } else {
                method(request, options ?? {}, callback);
            }
        });
    }

    static serverStream<
        TClient extends grpc.Client,
        TMethod extends ServerStreamMethodNames<TClient>,
    >(
        client: TClient,
        methodName: TMethod,
        request: ExtractServerStreamRequest<TClient, TMethod>,
        metadata?: grpc.Metadata,
        options?: grpc.CallOptions
    ): grpc.ClientReadableStream<ExtractServerStreamResponse<TClient, TMethod>> {
        const method = this.getMethod(client, methodName as string);
        return metadata ? method(request, metadata, options ?? {}) : method(request, options ?? {});
    }

    static clientStream<
        TClient extends grpc.Client,
        TMethod extends ClientStreamMethodNames<TClient>,
    >(
        client: TClient,
        methodName: TMethod,
        metadata?: grpc.Metadata,
        options?: grpc.CallOptions
    ): {
        stream: grpc.ClientWritableStream<ExtractClientStreamRequest<TClient, TMethod>>;
        response: Promise<ExtractClientStreamResponse<TClient, TMethod>>;
    } {
        const method = this.getMethod(client, methodName as string);

        let resolver: (value: ExtractClientStreamResponse<TClient, TMethod>) => void = () => {};
        let rejecter: (reason?: any) => void = () => {};
        const response = new Promise<ExtractClientStreamResponse<TClient, TMethod>>(
            (resolve, reject) => {
                resolver = resolve;
                rejecter = reject;
            }
        );

        const callback = (
            error: grpc.ServiceError | null,
            res: ExtractClientStreamResponse<TClient, TMethod>
        ) => {
            if (error) return rejecter(this.normalizeError(error));
            resolver(res);
        };

        const stream = metadata
            ? method(metadata, options ?? {}, callback)
            : method(options ?? {}, callback);
        return { stream, response };
    }

    static bidiStream<TClient extends grpc.Client, TMethod extends BidiStreamMethodNames<TClient>>(
        client: TClient,
        methodName: TMethod,
        metadata?: grpc.Metadata,
        options?: grpc.CallOptions
    ): grpc.ClientDuplexStream<
        ExtractBidiStreamRequest<TClient, TMethod>,
        ExtractBidiStreamResponse<TClient, TMethod>
    > {
        const method = this.getMethod(client, methodName as string);
        return metadata ? method(metadata, options ?? {}) : method(options ?? {});
    }

    private static getMethod(client: grpc.Client, methodName: string): any {
        const method = (client as any)[methodName]?.bind(client);
        if (!method) {
            throw this.createError(
                `Method '${methodName}' not found on client`,
                grpc.status.UNIMPLEMENTED
            );
        }
        return method;
    }

    private static findClientConfig(
        client: grpc.Client
    ): { client: grpc.Client; config: GrpcClientConfig } | null {
        const cachedClients = Array.from(this.clientCache.values());
        for (let index = 0; index < cachedClients.length; index += 1) {
            const cached = cachedClients[index];
            if (cached.client === client) return cached;
        }
        return null;
    }

    private static createError(message: string, code: grpc.status): grpc.ServiceError {
        return {
            name: 'GrpcClientError',
            message,
            code,
            details: message,
            metadata: new grpc.Metadata(),
        };
    }

    private static normalizeError(error: any): grpc.ServiceError {
        if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
            return error as grpc.ServiceError;
        }
        return {
            name: error?.name || 'GrpcClientError',
            message: error?.message || 'gRPC client call failed',
            code:
                typeof error?.code === 'number' ? (error.code as grpc.status) : grpc.status.UNKNOWN,
            details: error?.details || error?.message || String(error),
            metadata: error?.metadata ?? new grpc.Metadata(),
        };
    }
}
