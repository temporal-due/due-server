// jose v6는 순수 ESM이라 Jest(CommonJS) 런타임이 파싱하지 못한다.
// jose는 OAuth id-token(JWKS) 검증에만 쓰이는데, e2e는 dev-login으로 인증을 우회하므로
// 이 코드 경로는 실행되지 않는다. 그래서 런타임에서만 이 스텁으로 매핑한다.
// (타입 체크는 moduleNameMapper의 영향을 받지 않아 실제 jose 타입을 그대로 사용한다.)
//
// 외부 인증 제공자를 테스트에서 모킹하는 것과 동일한 정당한 경계다.
// 만약 누군가 social-login 경로를 e2e로 검증하려 한다면 아래 스텁이 즉시 던져서 알려준다.

export const createRemoteJWKSet = (..._args: unknown[]) => {
  return async () => {
    throw new Error(
      '[e2e] jose is stubbed — social-login JWKS 검증 경로는 e2e 대상이 아닙니다.',
    );
  };
};

export const jwtVerify = async (..._args: unknown[]): Promise<never> => {
  throw new Error(
    '[e2e] jose is stubbed — social-login 검증 경로는 e2e 대상이 아닙니다.',
  );
};
