import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# [FIX] Используем централизованные settings вместо os.getenv
from app.core.config import settings

logger = logging.getLogger("flow_translate.email")


class EmailService:
    @staticmethod
    def send_verification_email(to_email: str, code: str, link: str):
        smtp_host = settings.SMTP_HOST
        smtp_user = settings.SMTP_USER
        raw_password = settings.SMTP_PASSWORD
        smtp_port = settings.SMTP_PORT

        # Убираем случайные пробелы из пароля приложения Google
        smtp_password = raw_password.replace(" ", "").strip() if raw_password else None

        html_content = f"""
        <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F4EFE6; padding: 30px 15px; margin: 0;">
                <div style="max-width: 460px; margin: 0 auto; background-color: #ffffff; padding: 35px 30px; border-radius: 24px; border: 1px solid #E5DDD0; box-shadow: 0 10px 30px rgba(0,0,0,0.04); text-align: center;">
                    <div style="font-size: 24px; font-weight: 800; color: #1C1A17; margin-bottom: 8px;">Flow Translate</div>
                    <p style="font-size: 15px; color: #78716C; margin-top: 0;">Подтверждение регистрации аккаунта</p>
                    
                    <p style="font-size: 14px; color: #44403C; text-align: left; margin-top: 24px;">
                        Здравствуйте! Используйте этот 6-значный код для активации вашего личного кабинета:
                    </p>

                    <div style="background-color: #FAF7F2; padding: 18px; border-radius: 16px; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1C1A17; margin: 24px 0; border: 1px dashed #D5CBBF;">
                        {code}
                    </div>

                    <p style="font-size: 12px; color: #A8A29E; margin-bottom: 24px;">
                        Код действует в течение 24 часов. Никому не сообщайте его.
                    </p>

                    <div style="border-top: 1px solid #F5F0E6; padding-top: 20px;">
                        <a href="{link}" style="display: inline-block; background-color: #1C1A17; color: #ffffff; padding: 12px 26px; text-decoration: none; border-radius: 14px; font-size: 13px; font-weight: 700;">
                            Подтвердить в один клик
                        </a>
                    </div>
                </div>
            </body>
        </html>
        """

        # [FIX #23] Добавлен plain-text вариант письма (ранее был только HTML — спам-фильтры блокировали)
        plain_content = (
            f"Flow Translate — Подтверждение регистрации\n\n"
            f"Ваш 6-значный код: {code}\n\n"
            f"Или подтвердите по ссылке: {link}\n\n"
            f"Код действует в течение 24 часов. Никому не сообщайте его."
        )

        if smtp_host and smtp_user and smtp_password:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = f"{code} — ваш код подтверждения Flow Translate"
                msg["From"] = f"Flow Translate <{smtp_user}>"
                msg["To"] = to_email
                # [FIX #23] Сначала plain-text, потом HTML (MIMEMultipart выбирает последний поддерживаемый)
                msg.attach(MIMEText(plain_content, "plain", "utf-8"))
                msg.attach(MIMEText(html_content, "html", "utf-8"))

                with smtplib.SMTP(smtp_host, smtp_port, timeout=12) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_password)
                    server.sendmail(smtp_user, to_email, msg.as_string())

                logger.info(f"Письмо с кодом успешно доставлено через Gmail на {to_email}")
                return True
            except Exception as exc:
                logger.error(f"Ошибка отправки через Gmail SMTP: {exc}")

        # Резервный вывод в консоль (если пароль не указан или нет интернета)
        print("\n" + "=" * 60)
        print(f"📧 [EMAIL DISPATCHER] ПИСЬМО ДЛЯ: {to_email}")
        print(f"🔑 ВАШ 6-ЗНАЧНЫЙ КОД: {code}")
        print("=" * 60 + "\n")
        return True