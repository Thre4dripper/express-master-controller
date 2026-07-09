import { NextFunction, Request, Response } from 'express';
import * as grpc from '@grpc/grpc-js';
import { Socket } from 'socket.io';
import { StatusCodes } from './enums/StatusCodes';
import { createLogger } from './Logger';

const log = createLogger('error');

export class ValidationError extends Error {
    errorCode?: number;

    constructor(message: string, errorCode?: number) {
        super(message);
        this.name = 'ValidationError';
        this.errorCode = errorCode;
    }
}

export const httpToGrpcStatus = (httpStatus: number): grpc.status => {
    const map: Record<number, grpc.status> = {
        200: grpc.status.OK,
        400: grpc.status.INVALID_ARGUMENT,
        401: grpc.status.UNAUTHENTICATED,
        403: grpc.status.PERMISSION_DENIED,
        404: grpc.status.NOT_FOUND,
        409: grpc.status.ALREADY_EXISTS,
        429: grpc.status.RESOURCE_EXHAUSTED,
        500: grpc.status.INTERNAL,
        501: grpc.status.UNIMPLEMENTED,
        503: grpc.status.UNAVAILABLE,
    };
    return map[httpStatus] ?? grpc.status.UNKNOWN;
};

export class CustomErrorHandler {
    static rest = (err: any, _req: Request, res: Response, next: NextFunction) => {
        if (err && err.name === 'ValidationError') {
            return res
                .status(err.errorCode || StatusCodes.BAD_REQUEST)
                .json({ error: err.message });
        }
        return next(err);
    };

    static grpc = (err: any): grpc.ServiceError => {
        if (
            err &&
            typeof err === 'object' &&
            'code' in err &&
            'message' in err &&
            'metadata' in err
        ) {
            return err as grpc.ServiceError;
        }

        if (err instanceof ValidationError || (err && err.name === 'ValidationError')) {
            const httpStatus = err.errorCode || StatusCodes.BAD_REQUEST;
            return {
                name: 'ValidationError',
                message: err.message,
                code: httpToGrpcStatus(httpStatus),
                details: err.message,
                metadata: new grpc.Metadata(),
            };
        }

        if (err && err.response && typeof err.response.status === 'number') {
            return {
                name: 'GrpcError',
                message: err.response.message,
                code: httpToGrpcStatus(err.response.status),
                details: err.response.message,
                metadata: new grpc.Metadata(),
            };
        }

        return {
            name: err?.name || 'InternalError',
            message: err?.message || 'Internal server error',
            code: grpc.status.INTERNAL,
            details: err?.message || 'Internal server error',
            metadata: new grpc.Metadata(),
        };
    };

    static socket = (err: any, socket: Socket) => {
        log.error({ err: err?.message }, 'Socket error');
        socket.emit('error', {
            message: err?.message || 'Internal server error',
        });
    };

    static cron = (err: any, jobName = 'cron') => {
        log.error({ err: err?.message, job: jobName }, 'Cron job error');
    };
}

export const RestCustomErrorHandler = CustomErrorHandler.rest;
export const GrpcCustomErrorHandler = CustomErrorHandler.grpc;
export const SocketCustomErrorHandler = CustomErrorHandler.socket;
export const CronCustomErrorHandler = CustomErrorHandler.cron;

export const customErrorHandler = CustomErrorHandler.rest;
export const grpcCustomErrorHandler = CustomErrorHandler.grpc;

export default CustomErrorHandler.rest;
