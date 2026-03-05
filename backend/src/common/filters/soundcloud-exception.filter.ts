import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { AxiosError } from 'axios';

@Catch()
export class SoundcloudExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return response.status(status).send(body);
    }

    if (exception instanceof AxiosError && exception.response) {
      const { status, data } = exception.response;
      const statusCode = status >= 400 && status < 600 ? status : HttpStatus.BAD_GATEWAY;

      return response.status(statusCode).send({
        statusCode,
        error: `SoundCloud API error`,
        ...(typeof data === 'object' && data !== null ? data : { message: String(data) }),
      });
    }

    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof Error ? exception.message : 'Internal server error';
    return response.status(status).send({ statusCode: status, message });
  }
}
