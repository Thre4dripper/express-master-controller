export default class ResponseBuilder {
    response: { status: string; message: string; data: any }

    constructor(status: string, data: any, message: string) {
        this.response = {
            status,
            data,
            message,
        }
    }
}
