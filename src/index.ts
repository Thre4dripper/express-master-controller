import http from 'http';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import swaggerUI from 'swagger-ui-express';
import MasterController from './MasterController';
import RequestBuilder from './RequestBuilder';
import ResponseBuilder from './ResponseBuilder';
import { NextFunction, Request, Response } from 'express';
import SwaggerConfig, { SwaggerConfigOptions } from './config/swaggerConfig';
import CronBuilder from './CronBuilder';
import { CronMonth, CronWeekday } from './enums/CronJob';
import CronConfig from './config/cronConfig';
import SocketConfig from './config/socketConfig';

interface IMiddlewareConfig {
    routesFolder?: string;
    cronJobsFolder?: string;
    enableSocket?: boolean;
    swaggerConfig?: SwaggerConfigOptions & { swaggerDocsEndpoint?: string };
}

const isRequireSupported = () => {
    try {
        require('fs');
        return true;
    } catch (error) {
        return false;
    }
};

const loadRouters = async (dir: string, app: express.Application) => {
    //load all routers from dir and sub dir
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            //recursive call to sub dir
            await loadRouters(fullPath, app);
        } else if (
            entry.isFile() &&
            (entry.name.endsWith('.routes.ts') ||
                entry.name.endsWith('.routes.js') ||
                entry.name.endsWith('.routes.mjs'))
        ) {
            let router;
            let errorMessage;

            if (isRequireSupported()) {
                router = require(fullPath);
                errorMessage =
                    'router file must export a function by module.exports or exports.routerName';
            } else {
                const fileUrl = new URL('file:///' + fullPath);
                router = await import(fileUrl.href);
                errorMessage =
                    'router file must export a function by export default or export const routerName';
            }

            if (typeof router === 'function') {
                router(app);
            } else if (typeof router === 'object') {
                Object.keys(router).forEach((key) => {
                    if (typeof router[key] === 'function') {
                        router[key](app);
                    }
                });
            } else {
                throw new Error(errorMessage);
            }
        }
    }
};

const masterController =
    ({ routesFolder, cronJobsFolder, enableSocket, swaggerConfig }: IMiddlewareConfig) =>
    async (req: Request, res: Response, next: NextFunction) => {
        if (!routesFolder) console.warn('No routes folder provided');
        if (!cronJobsFolder) console.warn('No cron jobs folder provided');

        const {
            title,
            description,
            version,
            swaggerDocsEndpoint,
            swaggerDocPath,
            modifySwaggerDoc,
        } = swaggerConfig || {};

        SwaggerConfig.initSwagger({
            title: title ?? 'Node Swagger API',
            description: description ?? 'Demonstrating how to describe a RESTful API with Swagger',
            version: version ?? '1.0.0',
            swaggerDocPath,
            modifySwaggerDoc,
        });

        if (routesFolder) await loadRouters(routesFolder, req.app);
        if (cronJobsFolder)
            await CronConfig.InitCronJobs(cronJobsFolder, async (pathToCron: string) => {
                // configurable import statement to load all the cron jobs before starting server
                // This lambda function is called for each cron job file found

                if (isRequireSupported()) {
                    require(pathToCron);
                } else {
                    const fileUrl = new URL('file:///' + pathToCron);
                    await import(fileUrl.href);
                }
            });

        if (enableSocket) {
            const httpServer = http.createServer(req.app);
            const io = SocketConfig.init(httpServer);

            io.on('connection', (socket) => {
                SocketConfig.socketListener(io, socket);
            });
        }

        if (swaggerConfig) {
            req.app.use(
                swaggerDocsEndpoint || '/api-docs',
                swaggerUI.serve,
                swaggerUI.setup(SwaggerConfig.getSwaggerDocument())
            );
        }

        next();
    };
export {
    masterController,
    MasterController,
    RequestBuilder,
    ResponseBuilder,
    CronBuilder,
    CronMonth,
    CronWeekday,
};
