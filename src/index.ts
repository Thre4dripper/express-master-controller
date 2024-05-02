import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import swaggerUI from 'swagger-ui-express';
import MasterController from './MasterController';
import RequestBuilder from './RequestBuilder';
import ResponseBuilder from './ResponseBuilder';
import { NextFunction, Request, Response } from 'express';
import SwaggerConfig, { SwaggerConfigOptions } from './config/swaggerConfig';

interface IMiddlewareConfig {
    routesFolder: string;
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
            (entry.name.endsWith('.router.ts') ||
                entry.name.endsWith('.router.js') ||
                entry.name.endsWith('.router.mjs'))
        ) {
            if (isRequireSupported()) {
                const router = require(fullPath);
                if (typeof router === 'function') {
                    router(app);
                } else if (typeof router === 'object') {
                    Object.keys(router).forEach((key) => {
                        if (typeof router[key] === 'function') {
                            router[key](app);
                        }
                    });
                } else {
                    throw new Error(
                        'router file must export a function by module.exports or exports.routerName'
                    );
                }
            } else {
                const fileUrl = new URL('file:///' + fullPath);
                const router = await import(fileUrl.href);
                if (typeof router === 'function') {
                    router(app);
                } else if (typeof router === 'object') {
                    Object.keys(router).forEach((key) => {
                        if (typeof router[key] === 'function') {
                            router[key](app);
                        }
                    });
                } else {
                    throw new Error(
                        'router file must export a function by export default or export const routerName'
                    );
                }
            }
        }
    }
};

const masterController =
    ({ routesFolder, swaggerConfig }: IMiddlewareConfig) =>
    async (req: Request, res: Response, next: NextFunction) => {
        if (!routesFolder) throw new Error('routesFolder is required');

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
        await loadRouters(routesFolder, req.app);
        if (swaggerConfig) {
            req.app.use(
                swaggerDocsEndpoint || '/api-docs',
                swaggerUI.serve,
                swaggerUI.setup(SwaggerConfig.getSwaggerDocument())
            );
        }

        next();
    };
export { masterController, MasterController, RequestBuilder, ResponseBuilder };
