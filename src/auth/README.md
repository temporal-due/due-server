# 인증 (프론트엔드 가이드)

백엔드는 **OAuth authorization code를 받지 않습니다.** 각 플랫폼 **SDK로 로그인**한 뒤 얻은 **OIDC ID Token(JWT)** 만 받아, 서명·발행자·audience를 검증한 다음 **우리 서비스용 access/refresh JWT**를 발급합니다.

## 공통으로 해야 할 일

1. **플랫폼 개발자 콘솔**에서 앱(Web/iOS/Android)을 등록하고, **클라이언트 ID**(및 리다이렉트 URI·번들 ID 등)를 백엔드 팀과 맞춥니다.  
   - 백엔드 `.env`의 `GOOGLE_CLIENT_ID` / `KAKAO_CLIENT_ID` / `APPLE_CLIENT_ID`는 **ID Token의 `aud`(audience)와 동일한 값**이어야 검증에 성공합니다.
2. 로그인 성공 후 **반드시 `id_token`(또는 플랫폼에서 부르는 이름의 JWT)** 문자열을 확보합니다. (access token만으로는 안 됩니다.)
3. 아래 API로 전달합니다.

### 로그인 API

`POST /auth/social`

**Body (JSON)**

| 필드       | 타입   | 설명 |
|------------|--------|------|
| `provider` | string | `"google"` \| `"kakao"` \| `"apple"` (소문자, 정확히 일치) |
| `idToken`  | string | 해당 플랫폼이 발급한 **ID Token** 원문 |

**응답**

- `accessToken`, `refreshToken`, `expiresIn`, `user` 등 — 이후 API는 **`Authorization: Bearer <accessToken>`** 으로 호출합니다.

### 이후 세션

| 용도 | 메서드·경로 | 비고 |
|------|-------------|------|
| 액세스 토큰 갱신 | `POST /auth/refresh` — `{ "refreshToken": "..." }` | 새 access/refresh 쌍 반환 |
| 로그아웃 | `POST /auth/logout` | Bearer 필요 |
| 내 정보 | `GET /auth/me` | Bearer 필요 |

---

## Google

**해야 할 일**

- [Google Identity Services (GIS)](https://developers.google.com/identity/gsi/web) 또는 모바일용 [Google Sign-In](https://developers.google.com/identity/sign-in/android/start) 등 공식 흐름으로 로그인합니다.
- **OpenID Connect 스코프**를 포함해 **ID Token**을 받습니다. (예: `openid`, `email`, `profile` — 플랫폼/API에 맞게 설정)
- 응답에서 **`id_token`** 또는 **`credential`**(JWT 문자열)을 추출해 `POST /auth/social`의 `idToken`으로 보냅니다.
- Google Cloud 콘솔에 등록한 **OAuth 클라이언트 ID**가 백엔드 `GOOGLE_CLIENT_ID`와 **동일한 클라이언트(웹/앱)** 여야 `aud` 검증이 통과합니다. (테스트 시 OAuth Playground 등 다른 클라이언트로 받은 토큰은 `aud`가 달라 실패할 수 있음)

**백엔드가 기대하는 `provider` 값:** `google`

---

## Kakao

**해야 할 일**

- [카카오 로그인](https://developers.kakao.com/docs/latest/ko/kakaologin/common) · [JavaScript](https://developers.kakao.com/docs/latest/ko/javascript/getting-started) / [Android](https://developers.kakao.com/docs/latest/ko/kakaologin/android) / [iOS](https://developers.kakao.com/docs/latest/ko/kakaologin/ios) SDK로 로그인합니다.
- **OpenID Connect**를 사용하는 설정에서 토큰 응답에 포함되는 **`id_token`** 을 사용합니다. (REST API로 직접 받는 경우에도 [토큰 요청](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#request-token) 응답의 `id_token` 필드)
- 카카오 개발자 콘솔의 **REST API 키(또는 네이티브 앱 키 등, OIDC에 맞게 설정된 값)** 가 백엔드 `KAKAO_CLIENT_ID`와 일치해야 합니다.
- 동의 항목에 따라 `email` 등 클레임 유무가 달라질 수 있습니다.

**백엔드가 기대하는 `provider` 값:** `kakao`

---

## Apple (Sign in with Apple)

**해야 할 일**

- [Sign in with Apple](https://developer.apple.com/sign-in-with-apple/) — 웹(JS) / iOS / Android(제공 방식에 따름) 공식 가이드로 로그인합니다.
- **Identity Token** — 보통 JWT 문자열로, 이것을 그대로 `idToken`으로 보냅니다.
- Apple Developer에서 만든 **Services ID(웹)** 또는 **번들 ID(앱)** 등, 실제 로그인에 쓰는 **클라이언트 식별자**가 백엔드 `APPLE_CLIENT_ID`와 같아야 합니다.
- Apple은 최초 로그인 시에만 이메일을 줄 수 있어, 이후 로그인에서는 토큰에 이메일이 없을 수 있습니다. (이미 가입된 사용자는 백엔드에 저장된 정보를 쓰는 흐름이 일반적입니다.)

**백엔드가 기대하는 `provider` 값:** `apple`

---

## 자주 나는 실패 원인

- **`aud` 불일치:** 토큰을 **다른 OAuth 클라이언트**(다른 앱·Playground 기본 클라이언트 등)로 받았는데, 백엔드는 우리 앱 클라이언트 ID로만 검증함.
- **access token을 보냄:** ID Token이 아니면 검증에 실패합니다.
- **`provider` 오타:** 반드시 `google` / `kakao` / `apple` 소문자.

문제가 지속되면 ID Token을 [jwt.io](https://jwt.io) 등으로 디코드해 **`iss` / `aud` / `exp`** 만 확인해 백엔드 설정과 비교해 보세요. (프로덕션에서는 토큰을 신뢰할 수 있는 채널로만 공유할 것.)
