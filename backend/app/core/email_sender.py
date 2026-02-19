"""
이메일 발송 유틸리티
aiosmtplib 기반 비동기 이메일 발송
SMTP 미설정 시 graceful skip (로그만 출력)
"""
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from .config import settings

logger = logging.getLogger(__name__)


async def send_order_email(
    to_email: str,
    supplier_name: str,
    order_id: int,
    order_date: str,
    items: list,  # [{"name": str, "quantity": float, "unit": str, "unit_price": float}]
    total_amount: float,
    memo: str | None = None,
    pdf_bytes: bytes | None = None,
) -> bool:
    """발주서 이메일 발송. 성공 시 True, 실패 또는 미설정 시 False."""

    # SMTP 미설정 시 skip
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.info(f"[Email] SMTP 미설정 - 발송 스킵 (order #{order_id} → {to_email})")
        return False

    # HTML 이메일 본문 구성 (발주서 형태)
    items_html = "".join(
        f"<tr>"
        f"<td>{i['name']}</td>"
        f"<td>{i['quantity']}{i['unit']}</td>"
        f"<td>₩{i['unit_price']:,.0f}</td>"
        f"<td>₩{i['quantity'] * i['unit_price']:,.0f}</td>"
        f"</tr>"
        for i in items
    )
    memo_html = f"<p>메모: {memo}</p>" if memo else ""
    html_body = f"""
    <html><body>
    <h2>발주서 #{order_id}</h2>
    <p>안녕하세요, {supplier_name} 담당자님.</p>
    <p>아래와 같이 발주 드립니다.</p>
    <table border="1" cellpadding="8" style="border-collapse:collapse">
      <tr><th>품목</th><th>수량</th><th>단가</th><th>소계</th></tr>
      {items_html}
      <tr>
        <td colspan="3"><strong>합계</strong></td>
        <td><strong>₩{total_amount:,.0f}</strong></td>
      </tr>
    </table>
    {memo_html}
    <p>발주일: {order_date}</p>
    <p>감사합니다.</p>
    </body></html>
    """

    try:
        import aiosmtplib
        msg = MIMEMultipart("mixed")
        msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
        msg["To"] = to_email
        msg["Subject"] = f"[발주서] #{order_id} - {order_date}"
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        if pdf_bytes:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(pdf_bytes)
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f'attachment; filename="order_{order_id}.pdf"',
            )
            msg.attach(part)

        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=False,
            start_tls=settings.SMTP_TLS,
        )
        logger.info(f"[Email] 발주서 #{order_id} 발송 완료 → {to_email}")
        return True

    except ImportError:
        logger.warning("[Email] aiosmtplib 미설치 - pip install aiosmtplib")
        return False
    except Exception as e:
        logger.error(f"[Email] 발주서 #{order_id} 발송 실패: {e}")
        return False
