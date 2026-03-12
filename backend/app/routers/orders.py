"""
발주 자동화 API
- 재고 부족 품목 자동 발주 추천
- 발주서 생성 / 상태 관리
- PDF 발주서 출력
- 이메일 발송
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from datetime import date, timedelta
import io

from ..core.database import get_db
from ..core.auth import require_admin
from ..core.email_sender import send_order_email
from ..models import Item, Inventory, Order, OrderItem, OrderStatus, Transaction, TransactionType
from sqlalchemy import func, case

router = APIRouter()


# --- Schemas ---
class OrderItemIn(BaseModel):
    item_id: int
    quantity: float
    unit_price: Optional[float] = None

class OrderCreate(BaseModel):
    supplier_id: Optional[int] = None
    items: List[OrderItemIn]
    memo: Optional[str] = None
    expected_date: Optional[date] = None

class OrderOut(BaseModel):
    id: int
    supplier_id: Optional[int]
    status: OrderStatus
    memo: Optional[str]
    expected_date: Optional[date]
    total_amount: float
    item_count: int

    class Config:
        from_attributes = True

class OrderDetailOut(OrderOut):
    items: List[dict]


# --- 발주 추천 ---
@router.get("/recommend")
def recommend_orders(db: Session = Depends(get_db)):
    """
    재고 부족 품목 발주 추천
    - 현재 재고 <= min_stock 품목 추출
    - 최근 7일 평균 소비량 기반 발주 수량 계산 (최소 min_stock * 2)
    """
    inventories = db.query(Inventory).join(Item).filter(Item.min_stock > 0).all()
    since = date.today() - timedelta(days=30)

    # [W-3] 모든 item의 최근 30일 출고량을 한 번에 집계 (N+1 해결)
    consumption = dict(
        db.query(Transaction.item_id, func.sum(Transaction.quantity))
        .filter(
            Transaction.type == TransactionType.OUT,
            Transaction.created_at >= since,
        )
        .group_by(Transaction.item_id)
        .all()
    )

    recommendations = []
    for inv in inventories:
        item = inv.item
        if inv.quantity > item.min_stock:
            continue

        # 30일 평균 소비량
        avg_out = consumption.get(item.id, 0)
        daily_avg = avg_out / 30
        # 14일치 or min_stock*2 중 큰 값
        suggested_qty = max(daily_avg * 14, item.min_stock * 2)

        recommendations.append({
            "item_id": item.id,
            "name": item.name,
            "unit": item.unit,
            "current_stock": inv.quantity,
            "min_stock": item.min_stock,
            "suggested_qty": round(suggested_qty, 2),
            "unit_price": item.unit_price,
            "estimated_cost": round(suggested_qty * item.unit_price, 0),
            "supplier_id": item.supplier_id,
        })

    return {
        "count": len(recommendations),
        "total_estimated_cost": sum(r["estimated_cost"] for r in recommendations),
        "items": recommendations,
    }


# --- 발주서 CRUD ---
@router.post("/", response_model=OrderOut, status_code=201)
def create_order(payload: OrderCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    order = Order(
        supplier_id=payload.supplier_id,
        memo=payload.memo,
        expected_date=payload.expected_date,
    )
    db.add(order)
    db.flush()

    for oi in payload.items:
        item = db.query(Item).filter(Item.id == oi.item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"품목 #{oi.item_id} 없음")
        db.add(OrderItem(
            order_id=order.id,
            item_id=oi.item_id,
            quantity=oi.quantity,
            unit_price=oi.unit_price or item.unit_price,
        ))

    db.commit()
    db.refresh(order)
    return _to_out(order)


@router.get("/", response_model=List[OrderOut])
def list_orders(status: Optional[OrderStatus] = None, db: Session = Depends(get_db)):
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    return [_to_out(o) for o in q.order_by(Order.created_at.desc()).all()]


@router.get("/{order_id}", response_model=OrderDetailOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="발주서 없음")
    out = _to_out(order)
    out_detail = OrderDetailOut(**out.model_dump(), items=[
        {
            "item_id": oi.item_id,
            "name": oi.item.name,
            "unit": oi.item.unit,
            "quantity": oi.quantity,
            "unit_price": oi.unit_price,
            "subtotal": round((oi.unit_price or 0) * oi.quantity, 0),
        }
        for oi in order.items
    ])
    return out_detail


@router.patch("/{order_id}/status")
async def update_status(
    order_id: int,
    status: OrderStatus,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    order = (
        db.query(Order)
        .options(
            joinedload(Order.supplier),
            joinedload(Order.items).joinedload(OrderItem.item),
        )
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="발주서 없음")

    order.status = status

    # 입고 완료 시 자동 재고 반영
    if status == OrderStatus.RECEIVED:
        for oi in order.items:
            inv = oi.item.inventory
            if inv:
                inv.quantity += oi.quantity
                db.add(Transaction(
                    item_id=oi.item_id,
                    type=TransactionType.IN,
                    quantity=oi.quantity,
                    unit_price=oi.unit_price,
                    memo=f"발주서 #{order_id} 자동 입고",
                ))

    # [M-10] 트랜잭션 롤백
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(500, "처리 중 오류가 발생했습니다")

    # 발주 완료(sent) 상태 변경 시 이메일 자동 발송
    email_queued = False
    if status == OrderStatus.SENT and order.supplier and order.supplier.email:
        order_items = [
            {
                "name": oi.item.name,
                "quantity": oi.quantity,
                "unit": oi.item.unit,
                "unit_price": oi.unit_price if oi.unit_price is not None else oi.item.unit_price,
            }
            for oi in order.items
        ]
        total_amount = sum(i["quantity"] * i["unit_price"] for i in order_items)

        # PDF 생성 시도 (실패해도 이메일은 발송)
        try:
            pdf_bytes = _generate_pdf(order)
        except Exception:
            pdf_bytes = None

        background_tasks.add_task(
            send_order_email,
            to_email=order.supplier.email,
            supplier_name=order.supplier.name,
            order_id=order.id,
            order_date=str(date.today()),
            items=order_items,
            total_amount=total_amount,
            memo=order.memo,
            pdf_bytes=pdf_bytes,
        )
        email_queued = True

    return {"ok": True, "status": status, "email_queued": email_queued}


@router.post("/{order_id}/send-email")
async def send_email_manual(
    order_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """발주서 이메일 수동 발송"""
    order = (
        db.query(Order)
        .options(
            joinedload(Order.supplier),
            joinedload(Order.items).joinedload(OrderItem.item),
        )
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="발주서 없음")
    if not order.supplier or not order.supplier.email:
        raise HTTPException(status_code=400, detail="공급업체 이메일 없음")

    order_items = [
        {
            "name": oi.item.name,
            "quantity": oi.quantity,
            "unit": oi.item.unit,
            "unit_price": oi.unit_price if oi.unit_price is not None else oi.item.unit_price,
        }
        for oi in order.items
    ]
    total_amount = sum(i["quantity"] * i["unit_price"] for i in order_items)

    try:
        pdf_bytes = _generate_pdf(order)
    except Exception:
        pdf_bytes = None

    background_tasks.add_task(
        send_order_email,
        to_email=order.supplier.email,
        supplier_name=order.supplier.name,
        order_id=order.id,
        order_date=str(date.today()),
        items=order_items,
        total_amount=total_amount,
        memo=order.memo,
        pdf_bytes=pdf_bytes,
    )
    return {"ok": True, "message": f"{order.supplier.email}로 발송 예약됨"}


# --- PDF 발주서 ---
@router.get("/{order_id}/pdf")
def export_pdf(order_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="발주서 없음")

    pdf_bytes = _generate_pdf(order)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=order_{order_id}.pdf"},
    )


def _to_out(order: Order) -> OrderOut:
    total = sum((oi.unit_price or 0) * oi.quantity for oi in order.items)
    return OrderOut(
        id=order.id,
        supplier_id=order.supplier_id,
        status=order.status,
        memo=order.memo,
        expected_date=order.expected_date,
        total_amount=round(total, 0),
        item_count=len(order.items),
    )


def _generate_pdf(order: Order) -> bytes:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except ImportError:
        raise HTTPException(500, "PDF 생성 라이브러리가 설치되지 않았습니다. pip install reportlab")
    import os

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=40, bottomMargin=40)

    styles = getSampleStyleSheet()
    # 한글 폰트 (시스템 폰트 시도)
    font_paths = [
        "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    ]
    font_name = "Helvetica"
    for fp in font_paths:
        if os.path.exists(fp):
            pdfmetrics.registerFont(TTFont("KorFont", fp))
            font_name = "KorFont"
            break

    title_style = ParagraphStyle("title", fontName=font_name, fontSize=18, spaceAfter=8)
    normal_style = ParagraphStyle("normal", fontName=font_name, fontSize=10, spaceAfter=4)

    elements = []
    elements.append(Paragraph(f"발주서 #{order.id}", title_style))
    elements.append(Paragraph(f"상태: {order.status.value}  |  작성일: {date.today()}", normal_style))
    if order.expected_date:
        elements.append(Paragraph(f"예상 입고일: {order.expected_date}", normal_style))
    if order.memo:
        elements.append(Paragraph(f"메모: {order.memo}", normal_style))
    elements.append(Spacer(1, 16))

    # 테이블
    table_data = [["품목명", "단위", "수량", "단가(원)", "소계(원)"]]
    total = 0
    for oi in order.items:
        subtotal = (oi.unit_price or 0) * oi.quantity
        total += subtotal
        table_data.append([
            oi.item.name,
            oi.item.unit,
            str(oi.quantity),
            f"{int(oi.unit_price or 0):,}",
            f"{int(subtotal):,}",
        ])
    table_data.append(["", "", "", "합계", f"{int(total):,}"])

    table = Table(table_data, colWidths=[160, 50, 60, 80, 90])
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4CAF50")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), font_name),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -2), 0.5, colors.grey),
        ("LINEABOVE", (0, -1), (-1, -1), 1.5, colors.black),
        ("FONTNAME", (-2, -1), (-1, -1), font_name),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f5f5f5")),
    ]))
    elements.append(table)
    doc.build(elements)
    return buf.getvalue()
