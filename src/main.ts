import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Due API')
    .setDescription('Due 프로젝트 관리 서비스 API')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    customJsStr: `
      (function () {
        const TOKEN_KEY = 'swagger_dev_token';

        // customJsStr은 SwaggerUIBundle() 호출 전에 실행된다.
        // SwaggerUIBundle을 래핑해 config에 requestInterceptor를 삽입하면
        // Swagger UI가 공식 지원하는 경로로 모든 요청에 Authorization 헤더가 주입된다.
        var _Bundle = window.SwaggerUIBundle;
        window.SwaggerUIBundle = function (config) {
          var orig = config.requestInterceptor || function (r) { return r; };
          config.requestInterceptor = function (req) {
            req = orig(req);
            var token = localStorage.getItem(TOKEN_KEY);
            if (token) {
              req.headers = req.headers || {};
              req.headers['Authorization'] = 'Bearer ' + token;
            }
            return req;
          };
          return _Bundle(config);
        };
        window.SwaggerUIBundle.presets = _Bundle.presets;
        window.SwaggerUIBundle.plugins = _Bundle.plugins;

        function markLoggedIn(btn) {
          btn.textContent = '✓ 로그인됨';
          btn.style.background = '#1976D2';
          btn.disabled = false;
        }

        window.addEventListener('load', function () {
          var interval = setInterval(function () {
            var topbar = document.querySelector('.swagger-ui .topbar');
            if (!topbar || !window.ui) return;
            clearInterval(interval);

            var btn = document.createElement('button');
            btn.style.cssText = [
              'margin-left:16px',
              'padding:6px 14px',
              'color:#fff',
              'border:none',
              'border-radius:4px',
              'cursor:pointer',
              'font-size:13px',
              'font-weight:600',
              'letter-spacing:.3px',
            ].join(';');

            if (localStorage.getItem(TOKEN_KEY)) {
              markLoggedIn(btn);
            } else {
              btn.textContent = 'Dev Login';
              btn.style.background = '#4CAF50';
            }

            btn.addEventListener('click', async function () {
              if (btn.disabled) return;
              btn.disabled = true;
              btn.textContent = '로그인 중...';
              try {
                var res = await fetch('/auth/dev-login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                });
                if (!res.ok) throw new Error(res.status);
                var data = await res.json();
                localStorage.setItem(TOKEN_KEY, data.accessToken);
                markLoggedIn(btn);
              } catch (e) {
                btn.textContent = '실패 — 재시도';
                btn.style.background = '#e53935';
                btn.disabled = false;
              }
            });

            topbar.appendChild(btn);
          }, 100);
        });
      })();
    `,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
