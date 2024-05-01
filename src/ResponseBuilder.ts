export default class ResponseBuilder {
    response: { status: number; message: string; data: any }

    constructor(status: number, data: any, message: string) {
        this.response = {
            status,
            data,
            message,
        }
    }
}
