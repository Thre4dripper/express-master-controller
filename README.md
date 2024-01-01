# node-master-controller

node-master-controller is a powerful npm package designed to help you create APIs and sockets super fast.
It is a master-controller-based express package that provides a streamlined way to manage your routes and socket events.
It also
automates the creation of Swagger documentation for your express application

## Features

- Easy creation of APIs and sockets
- Automated Swagger documentation
- Joi validation
- TypeScript support

## Installation

```bash
npm install node-master-controller
```

or

```bash
yarn add node-master-controller
```

## Initialization

```typescript
import { masterController } from 'node-master-controller'

const app = express()

// routersPath: routesPath,
//     generateSwaggerDocs: true,
//     swaggerDocsEndpoint: '/swagger',
//     swaggerDocPath,
//     modifySwaggerDoc
app.use(masterController({
    // make sute to use absolute path for the routes directory
    routersPath: path.join(__dirname, 'routes'),
    // whether to generate swagger docs or not
    generateSwaggerDocs: true,
    // if you want to give your swagger doc
    swaggerDocPath: path.join(__dirname, 'swagger.json'),
    // swagger docs endpoint
    swaggerDocsEndpoint: '/api-docs',
    // whether to modify your provided swagger doc or not
    modifySwaggerDoc: true,
}))

app.listen(3000, () => {
    console.log('Server started')
})
```

## Creating APIs

### Controller

```typescript
import { MasterController, RequestBuilder, ResponseBuilder } from 'node-master-controller'
import Joi from 'joi'

class Controller extends MasterController<IParams, IQuery, IBody> {

    // swagger documetation for the api
    static doc() {
        return {
            tags: ['User'],
            summary: 'Register User',
            description: 'Register User',
        }
    }

    // add your validations here, 
    // rest of the swagger documentation will be generated automatically from the validation
    public static validate(): RequestBuilder {
        const payload = new RequestBuilder()

        // request body validation
        payload.addToBody(
            Joi.object().keys({
                name: Joi.string().required(),
                lastName: Joi.string().required(),
                email: Joi.string().email().required(),
                password: Joi.string().min(8).max(20).required(),
            }),
        )

        // request query validation
        payload.addToQuery(
            Joi.object().keys({
                limit: Joi.number().required(),
                offset: Joi.number().required(),
            }),
        )

        // request params validation
        payload.addToParams(
            Joi.object().keys({
                id: Joi.number().required(),
            }),
        )
        return payload
    }

    // controller function
    async restController(params: IParams, query: IQuery, body: IBody, headers: any, allData: any): Promise<any> {
        // your code here
        return new ResponseBuilder('Status', Response, 'Success Message')
    }

    // socket controller function
    socketController(io: Server, socket: Socket, payload: any): any {
        // your code here
        // Socket data will be available in payload, recieved from the client on socket event, which is setup in the route file
        // You can emit data back to the client using io.emit or socket.emit
    }
}

export default Controller
```

#### Controller Generics

- **IParams:** Request params interface/type
- **IQuery:** Request query interface/type
- **IBody:** Request body interface/type

#### restController Parameters

- **params:** Request params (eg. /user/:id)
- **query:** Request query (eg. /user?limit=10&offset=0)
- **body:** Request body
- **headers:** Request headers
- **allData:** All request data (all the above-combined + custom data from middlewares)

#### socketController Parameters

- **io:** Socket.io instance
- **socket:** Socket instance
- **payload:** Data sent from the client

### Route File

```typescript
import express from 'express'
import Controller from '../Controller'

export default (app: express.Application) => {
    // REST Routes
    Controller.get(app, '/user', [/* Comma separated middlewares */])
    Controller.post(app, '/user', [])
    Controller.put(app, '/user/:id', [])
    Controller.delete(app, '/user/:id', [])

    // Socket Events
    // Any payload you send from the client to this event will be available in the socketController function
    Controller.socketIO('Event Name')
}
```

> **Note:** You don't need to import your route file to anywhere,
> put it in the routes directory, and it will be automatically
> taken care by the package.

### External Dependencies (You need to install these packages)

- [joi](https://www.npmjs.com/package/joi) (For validation)
- [socket.io](https://www.npmjs.com/package/socket.io) (For sockets)

