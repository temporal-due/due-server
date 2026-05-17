import { ArgumentsHost, HttpException, Logger, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockHost: ArgumentsHost;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue({ status: mockStatus }),
        getRequest: jest.fn().mockReturnValue({ url: '/test' }),
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('HttpException(string) 시 표준 에러 포맷 반환', () => {
    filter.catch(new HttpException('Bad request', 400), mockHost);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Bad request',
        error: 'HttpException',
        path: '/test',
      }),
    );
    expect(mockJson.mock.calls[0][0]).toHaveProperty('timestamp');
  });

  it('ValidationPipe 형태(message 배열)는 배열 그대로 유지', () => {
    const exception = new HttpException(
      { statusCode: 400, message: ['name must not be empty', 'budget must be integer'], error: 'Bad Request' },
      400,
    );

    filter.catch(exception, mockHost);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: ['name must not be empty', 'budget must be integer'],
        error: 'Bad Request',
      }),
    );
  });

  it('NotFoundException 시 404 반환', () => {
    filter.catch(new NotFoundException('Resource not found'), mockHost);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404 }),
    );
  });

  it('일반 Error 시 500 반환, message 고정, Logger.error 호출', () => {
    filter.catch(new Error('Unexpected crash'), mockHost);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      }),
    );
    expect(loggerErrorSpy).toHaveBeenCalled();
  });
});
