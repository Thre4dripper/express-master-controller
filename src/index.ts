import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import swaggerUI from 'swagger-ui-express'
import MasterController from './MasterController'
import RequestBuilder from './RequestBuilder'
import ResponseBuilder from './ResponseBuilder'
import { NextFunction, Request, Response } from 'express'
import SwaggerConfig from './config/swaggerConfig'
import swaggerDocument from '../swagger.json'

interface IMiddlewareConfig {
    routersPath: string
    generateSwaggerDocs: Boolean
    swaggerDocsPath?: string
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
    ({ routersPath, generateSwaggerDocs, swaggerDocsPath }: IMiddlewareConfig) =>
    async (req: Request, res: Response, next: NextFunction) => {
        await loadRouters(routersPath, req.app)

        if (generateSwaggerDocs) {
            SwaggerConfig.initSwagger(swaggerDocument)
            req.app.use(
                swaggerDocsPath!,
                swaggerUI.serve,
                swaggerUI.setup(SwaggerConfig.getSwaggerDocument())
            )
        }
    }
export { masterController, MasterController, RequestBuilder, ResponseBuilder }
