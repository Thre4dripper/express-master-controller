import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import swaggerUI from 'swagger-ui-express'
import MasterController from './MasterController'
import RequestBuilder from './RequestBuilder'
import ResponseBuilder from './ResponseBuilder'
import { NextFunction, Request, Response } from 'express'
import SwaggerConfig from './config/swaggerConfig'

interface IMiddlewareConfig {
    routersPath: string
    generateSwaggerDocs: Boolean
    swaggerDocsEndpoint?: string
    swaggerDocPath?: string
    modifySwaggerDoc?: boolean
}

const loadRouters = async (dir: string, app: express.Application) => {
    //load all routers from dir and sub dir
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
            //recursive call to sub dir
            await loadRouters(fullPath, app)
        } else if (
            entry.isFile() &&
            (entry.name.endsWith('.router.ts') || entry.name.endsWith('.router.js'))
        ) {
            const router = require(fullPath)
            if (router.default) router.default(app)
            else router(app)
        }
    }
}

const masterController =
    ({ routersPath, generateSwaggerDocs, swaggerDocPath, swaggerDocsEndpoint, modifySwaggerDoc }: IMiddlewareConfig) =>
        async (req: Request, res: Response, next: NextFunction) => {
            if (swaggerDocPath) SwaggerConfig.initSwagger({ path: swaggerDocPath, modify: modifySwaggerDoc })
            else SwaggerConfig.initSwagger()
            await loadRouters(routersPath, req.app)
            if (generateSwaggerDocs) {
                req.app.use(
                    swaggerDocsEndpoint || '/api-docs',
                    swaggerUI.serve,
                    swaggerUI.setup(SwaggerConfig.getSwaggerDocument()),
                )
            }
        }
export { masterController, MasterController, RequestBuilder, ResponseBuilder }
