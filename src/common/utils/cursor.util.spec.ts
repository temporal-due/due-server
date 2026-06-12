import { BadRequestException } from '@nestjs/common';
import { encodeCursor, decodeCursor } from './cursor.util';

// 커서 페이지네이션의 순수 로직. 서비스 mock 없이 함수만 직접 검증한다.
describe('cursor.util', () => {
  it('encode → decode 라운드트립으로 id가 보존된다', () => {
    expect(decodeCursor(encodeCursor(42))).toBe(42);
  });

  it('큰 id도 보존된다', () => {
    expect(decodeCursor(encodeCursor(987654321))).toBe(987654321);
  });

  it('잘못된 커서 문자열은 BadRequestException', () => {
    expect(() => decodeCursor('invalid!!')).toThrow(BadRequestException);
  });

  it('0 이하로 디코드되는 커서는 BadRequestException', () => {
    expect(() => decodeCursor(encodeCursor(0))).toThrow(BadRequestException);
  });
});
