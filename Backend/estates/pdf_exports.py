"""PDF exports for estate listings.

Two layouts are supported:

* ``factsheet`` – a compact one-page sheet with the cover photo, key facts,
  description and broker contact.
* ``brochure`` – a two-page, more visual layout with a large cover and a
  photo gallery.

The generated documents are deliberately independent from the frontend
theme: they use the SOREAL green palette and print-friendly typography.
"""

from io import BytesIO

from bs4 import BeautifulSoup
from django.conf import settings
from django.utils import timezone
from PIL import Image, ImageOps
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    Image as RLImage,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

GREEN = colors.HexColor("#18764a")
GREEN_DARK = colors.HexColor("#105b38")
GREEN_SOFT = colors.HexColor("#e8f4ec")
INK = colors.HexColor("#17231b")
MUTED = colors.HexColor("#5b6b60")
LINE = colors.HexColor("#d7e4db")
WHITE = colors.white

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 15 * mm
CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN)
TOP_BAND = 13 * mm
BOTTOM_BAND = 14 * mm

LABELS = {
    "en": {
        "language": "en",
        "brand": "SOREAL ESTATE",
        "fact_sheet": "PROPERTY FACT SHEET",
        "brochure": "PROPERTY BROCHURE",
        "id": "ID",
        "beds": "Bedrooms",
        "baths": "Bathrooms",
        "area": "m²",
        "location": "Location",
        "address": "Address",
        "type": "Property type",
        "listing": "Listing",
        "description": "About this property",
        "gallery": "Gallery",
        "contact": "Contact broker",
        "contact_generic": "Contact us to schedule a visit",
        "price_on_request": "Price on request",
        "no_photos": "No photos available.",
        "page": "Page",
    },
    "es": {
        "language": "es",
        "brand": "SOREAL ESTATE",
        "fact_sheet": "FICHA DE LA PROPIEDAD",
        "brochure": "FOLLETO DE LA PROPIEDAD",
        "id": "ID",
        "beds": "Habitaciones",
        "baths": "Baños",
        "area": "m²",
        "location": "Ubicación",
        "address": "Dirección",
        "type": "Tipo de propiedad",
        "listing": "Operación",
        "description": "Sobre esta propiedad",
        "gallery": "Galería",
        "contact": "Contactar corredor",
        "contact_generic": "Contáctanos para agendar una visita",
        "price_on_request": "Precio a consultar",
        "no_photos": "No hay fotos disponibles.",
        "page": "Página",
    },
}

TYPE_LABELS_ES = {
    "house": "Casa",
    "apartment": "Apartamento",
    "land": "Terreno",
    "commercial": "Comercial",
    "villa": "Villa",
}

LISTING_LABELS_ES = {
    "sale": "En Venta",
    "rent": "En Alquiler",
}


def _styles():
    base = getSampleStyleSheet()
    return {
        "id_right": ParagraphStyle(
            "SorealIdRight",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=GREEN,
            alignment=2,
            spaceAfter=4,
        ),
        "title": ParagraphStyle(
            "SorealTitle",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=23,
            textColor=INK,
            spaceBefore=0,
            spaceAfter=3,
        ),
        "title_brochure": ParagraphStyle(
            "SorealTitleBrochure",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=27,
            textColor=INK,
            spaceBefore=0,
            spaceAfter=4,
        ),
        "price": ParagraphStyle(
            "SorealPrice",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=19,
            textColor=GREEN,
            spaceAfter=4,
        ),
        "lede": ParagraphStyle(
            "SorealLede",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=15,
            textColor=MUTED,
            spaceAfter=8,
        ),
        "body": ParagraphStyle(
            "SorealBody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=6,
        ),
        "section": ParagraphStyle(
            "SorealSection",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=GREEN,
            spaceBefore=2,
            spaceAfter=4,
        ),
        "label": ParagraphStyle(
            "SorealLabel",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=6.8,
            leading=8.5,
            textColor=MUTED,
        ),
        "value": ParagraphStyle(
            "SorealValue",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.6,
            leading=11,
            textColor=INK,
        ),
        "spec_line": ParagraphStyle(
            "SorealSpecLine",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=13,
            leading=15,
            textColor=INK,
            alignment=TA_CENTER,
        ),
        "contact_name": ParagraphStyle(
            "SorealContactName",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=13,
            textColor=INK,
            spaceAfter=2,
        ),
        "contact_line": ParagraphStyle(
            "SorealContactLine",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=12,
            textColor=INK,
        ),
        "placeholder": ParagraphStyle(
            "SorealPlaceholder",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=15,
            textColor=GREEN_DARK,
            alignment=TA_CENTER,
        ),
    }


def _read_image_bytes(image):
    if not image:
        return None
    # ``PropertyImage`` wraps a Wagtail image in its ``image`` FK.
    wagtail_image = getattr(image, "image", image)
    try:
        field = wagtail_image.file
        field.open("rb")
        try:
            return field.read()
        finally:
            field.close()
    except Exception:
        return None


def _flowable_image(image, width_mm, height_mm, styles, crop=True):
    """Load a Wagtail image into a reportlab flowable, cropped to the frame."""
    data = _read_image_bytes(image)
    if not data:
        return None

    try:
        with Image.open(BytesIO(data)) as opened:
            img = ImageOps.exif_transpose(opened).convert("RGB")
            target = (
                max(1, int(width_mm / 25.4 * 150)),
                max(1, int(height_mm / 25.4 * 150)),
            )
            if crop:
                img = ImageOps.fit(img, target, method=Image.Resampling.LANCZOS)
            else:
                img.thumbnail(target, Image.Resampling.LANCZOS)
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=86, optimize=True)
            buf.seek(0)
    except Exception:
        return None

    if crop:
        return RLImage(buf, width=width_mm * mm, height=height_mm * mm)

    width_px, height_px = img.size
    scale = min((width_mm * mm) / width_px, (height_mm * mm) / height_px)
    return RLImage(buf, width=width_px * scale, height=height_px * scale)


def _placeholder(width_mm, height_mm, styles):
    table = Table(
        [[Paragraph("SOREAL ESTATE", styles["placeholder"])]],
        colWidths=[width_mm * mm],
        rowHeights=[height_mm * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), GREEN_SOFT),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    return table


def _hero(image, width_mm, height_mm, styles):
    hero = _flowable_image(image, width_mm, height_mm, styles, crop=True)
    return hero or _placeholder(width_mm, height_mm, styles)


def _description_blocks(value):
    if not value:
        return []
    soup = BeautifulSoup(value, "html.parser")
    for br in soup.find_all("br"):
        br.replace_with("\n")
    for item in soup.find_all("li"):
        item.insert(0, "• ")
    for tag in soup.find_all(
        ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr"]
    ):
        tag.append("\n")

    text = soup.get_text().replace("\u00a0", " ")
    blocks = []
    current = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if line:
            current.append(line)
        elif current:
            blocks.append(" ".join(current))
            current = []
    if current:
        blocks.append(" ".join(current))
    return blocks


def _paragraphs(value, styles):
    blocks = _description_blocks(value)
    return [
        Paragraph(_escape(block).replace("\n", "<br/>"), styles["body"])
        for block in blocks
    ]


def _escape(value):
    return (
        (value or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _money(property):
    if property.price is None or property.price == "":
        return None
    try:
        amount = float(property.price)
    except (TypeError, ValueError):
        return None
    currency = property.currency or ""
    return f"{currency} {amount:,.0f}".strip()


def _type_label(property, labels):
    if labels["language"] == "es":
        return TYPE_LABELS_ES.get(
            property.property_type, property.get_property_type_display()
        )
    return property.get_property_type_display()


def _listing_label(property, labels):
    if labels["language"] == "es":
        return LISTING_LABELS_ES.get(
            property.listing_type, property.get_listing_type_display()
        )
    return property.get_listing_type_display()


def _specs_row(property, labels, styles):
    specs = []
    if property.bedrooms is not None:
        specs.append((str(property.bedrooms), labels["beds"]))
    if property.bathrooms is not None:
        specs.append((str(property.bathrooms), labels["baths"]))
    if property.area_sqm is not None:
        specs.append((f"{float(property.area_sqm):,.0f}", labels["area"]))
    if not specs:
        return None

    cells = [
        Paragraph(
            f'<font size="13"><b>{_escape(value)}</b></font>'
            f'<br/><font size="6.3" color="#5b6b60">{_escape(label.upper())}</font>',
            styles["spec_line"],
        )
        for value, label in specs
    ]
    table = Table([cells], colWidths=[CONTENT_WIDTH / len(specs)] * len(specs))
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), GREEN_SOFT),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.7, WHITE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def _details_table(property, labels, styles):
    location = ", ".join(
        value for value in (property.city, property.province) if value
    )
    pairs = []
    if location:
        pairs.append((labels["location"], location))
    if property.address:
        pairs.append((labels["address"], property.address))
    pairs.append((labels["type"], _type_label(property, labels)))
    pairs.append((labels["listing"], _listing_label(property, labels)))
    if not pairs:
        return None

    rows = []
    for index in range(0, len(pairs), 2):
        chunk = pairs[index : index + 2]
        row = []
        for label, value in chunk:
            row.extend(
                [
                    Paragraph(label.upper(), styles["label"]),
                    Paragraph(_escape(value), styles["value"]),
                ]
            )
        if len(chunk) == 1:
            row.extend(["", ""])
        rows.append(row)

    table = Table(
        rows,
        colWidths=[27 * mm, 63 * mm, 27 * mm, 63 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
            ]
        )
    )
    return table


def _contact_box(property, labels, styles):
    broker = property.broker if property.broker_id else None
    lines = [Paragraph(labels["contact"].upper(), styles["section"])]

    if broker:
        lines.append(Paragraph(_escape(broker.name), styles["contact_name"]))
        if broker.phone:
            lines.append(Paragraph(_escape(broker.phone), styles["contact_line"]))
        if broker.email:
            lines.append(Paragraph(_escape(broker.email), styles["contact_line"]))
    else:
        lines.append(
            Paragraph(_escape(labels["contact_generic"]), styles["contact_name"])
        )
        phone = getattr(settings, "SOREAL_CONTACT_PHONE", "")
        email = getattr(settings, "SOREAL_CONTACT_EMAIL", "")
        if phone:
            lines.append(Paragraph(_escape(phone), styles["contact_line"]))
        if email:
            lines.append(Paragraph(_escape(email), styles["contact_line"]))

    site_url = getattr(settings, "PUBLIC_SITE_URL", "")
    if site_url:
        lines.append(Paragraph(_escape(site_url), styles["contact_line"]))

    table = Table([[lines]], colWidths=[CONTENT_WIDTH])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), GREEN_SOFT),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    return table


def _cover_image(property):
    images = list(property.images.all())
    if not images:
        return None
    return next((image for image in images if image.is_cover), images[0])


def _gallery_images(property, limit=4):
    images = list(property.images.all())
    cover = _cover_image(property)
    ordered = [image for image in images if image.pk != getattr(cover, "pk", None)]
    if not ordered:
        ordered = images
    return ordered[:limit]


def _header_row(property, labels, styles):
    return Paragraph(
        f'{labels["id"]} {property.custom_id}',
        styles["id_right"],
    )


def _fact_sheet_story(property, labels, styles):
    story = [_header_row(property, labels, styles), Spacer(1, 5 * mm)]

    hero = _flowable_image(
        _cover_image(property), CONTENT_WIDTH / mm, 70, styles, crop=True
    )
    if hero:
        story.extend([hero, Spacer(1, 4 * mm)])

    story.append(Paragraph(_escape(property.title), styles["title"]))

    price = _money(property)
    price_text = _escape(price) if price else _escape(labels["price_on_request"])
    story.append(
        Paragraph(
            f'{price_text} &nbsp;&nbsp; <font size="9" color="#5b6b60">'
            f"{_escape(_listing_label(property, labels))} · "
            f"{_escape(_type_label(property, labels))}</font>",
            styles["price"],
        )
    )

    specs = _specs_row(property, labels, styles)
    if specs:
        story.extend([specs, Spacer(1, 4 * mm)])

    details = _details_table(property, labels, styles)
    if details:
        story.extend([details, Spacer(1, 2 * mm)])

    description = _paragraphs(property.description, styles)
    if description:
        story.append(Paragraph(labels["description"].upper(), styles["section"]))
        story.append(
            HRFlowable(width="100%", thickness=0.5, color=LINE, spaceAfter=5)
        )
        story.extend(description)

    story.extend([Spacer(1, 4 * mm), _contact_box(property, labels, styles)])
    return story


def _brochure_story(property, labels, styles):
    story = [_header_row(property, labels, styles), Spacer(1, 5 * mm)]

    hero = _flowable_image(
        _cover_image(property), CONTENT_WIDTH / mm, 110, styles, crop=True
    )
    story.extend(
        [
            hero or _placeholder(CONTENT_WIDTH / mm, 110, styles),
            Spacer(1, 6 * mm),
            Paragraph(_escape(property.title), styles["title_brochure"]),
        ]
    )

    price = _money(property)
    price_text = _escape(price) if price else _escape(labels["price_on_request"])
    story.append(
        Paragraph(
            f'{price_text} &nbsp;&nbsp; <font size="9" color="#5b6b60">'
            f"{_escape(_listing_label(property, labels))} · "
            f"{_escape(_type_label(property, labels))}</font>",
            styles["price"],
        )
    )

    location = ", ".join(
        value for value in (property.city, property.province) if value
    )
    if location:
        story.append(Paragraph(_escape(location), styles["lede"]))

    specs = _specs_row(property, labels, styles)
    if specs:
        story.append(specs)

    details = _details_table(property, labels, styles)
    if details:
        story.extend([Spacer(1, 4 * mm), details])

    story.append(PageBreak())

    gallery = _gallery_images(property, limit=4)
    if gallery:
        story.append(Paragraph(labels["gallery"].upper(), styles["section"]))
        story.append(
            HRFlowable(width="100%", thickness=0.5, color=LINE, spaceAfter=5)
        )
        if len(gallery) == 1:
            cell = _flowable_image(
                gallery[0], 176, 100, styles, crop=True
            ) or _placeholder(176, 100, styles)
            table = Table([[cell]], colWidths=[178 * mm], rowHeights=[102 * mm])
            table.setStyle(
                TableStyle(
                    [
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 1),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 1),
                        ("TOPPADDING", (0, 0), (-1, -1), 1),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                    ]
                )
            )
        else:
            cells = [
                _flowable_image(image, 85, 56, styles, crop=True)
                or _placeholder(85, 56, styles)
                for image in gallery
            ]
            while len(cells) < 4:
                cells.append("")
            rows = [cells[0:2]]
            if len(gallery) > 2:
                rows.append(cells[2:4])
            table = Table(
                rows,
                colWidths=[87 * mm, 87 * mm],
                rowHeights=[58 * mm] * len(rows),
            )
            table.setStyle(
                TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 1),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 1),
                        ("TOPPADDING", (0, 0), (-1, -1), 1),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                    ]
                )
            )
        story.extend([table, Spacer(1, 4 * mm)])

    description = _paragraphs(property.description, styles)
    if description:
        story.append(Paragraph(labels["description"].upper(), styles["section"]))
        story.append(
            HRFlowable(width="100%", thickness=0.5, color=LINE, spaceAfter=5)
        )
        story.extend(description)

    story.extend([Spacer(1, 4 * mm), _contact_box(property, labels, styles)])
    return story


def _page_decor(canvas, doc):
    canvas.saveState()

    canvas.setFillColor(GREEN_DARK)
    canvas.rect(0, PAGE_HEIGHT - TOP_BAND, PAGE_WIDTH, TOP_BAND, stroke=0, fill=1)

    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(MARGIN, PAGE_HEIGHT - 8.8 * mm, "SOREAL ESTATE")

    canvas.setFont("Helvetica", 7.5)
    canvas.drawRightString(
        PAGE_WIDTH - MARGIN,
        PAGE_HEIGHT - 8.8 * mm,
        doc.soreal_document_kind,
    )

    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN, 12 * mm, PAGE_WIDTH - MARGIN, 12 * mm)

    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.3)
    footer = "SOREAL Estate"
    site_url = getattr(settings, "PUBLIC_SITE_URL", "")
    if site_url:
        footer = f"{footer}  ·  {site_url}"
    canvas.drawString(MARGIN, 8.4 * mm, footer)
    canvas.drawRightString(
        PAGE_WIDTH - MARGIN,
        8.4 * mm,
        f'{doc.soreal_labels["page"]} {doc.page}',
    )

    canvas.restoreState()


def build_estates_pdf(properties, layout="factsheet", language="en"):
    """Return a BytesIO containing the PDF for one or more properties."""
    labels = LABELS.get(language, LABELS["en"])
    styles = _styles()

    buffer = BytesIO()
    document = BaseDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=TOP_BAND + 6 * mm,
        bottomMargin=BOTTOM_BAND,
        title=(
            f'{labels["brand"]} · {properties[0].title}'
            if len(properties) == 1
            else f'{labels["brand"]} · {len(properties)} properties'
        ),
        author="SOREAL Estate",
        creator="SOREAL Estate",
    )
    document.soreal_labels = labels
    document.soreal_document_kind = (
        labels["brochure"] if layout == "brochure" else labels["fact_sheet"]
    )

    frame = Frame(
        MARGIN,
        BOTTOM_BAND,
        CONTENT_WIDTH,
        PAGE_HEIGHT - (TOP_BAND + 6 * mm) - BOTTOM_BAND,
        id="content",
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    document.addPageTemplates(
        [PageTemplate(id="main", frames=[frame], onPage=_page_decor)]
    )

    story = []
    for index, property in enumerate(properties):
        if index:
            story.append(PageBreak())
        if layout == "brochure":
            story.extend(_brochure_story(property, labels, styles))
        else:
            story.extend(_fact_sheet_story(property, labels, styles))

    document.build(story)
    buffer.seek(0)
    return buffer


def pdf_filename(properties, layout="factsheet"):
    stamp = timezone.localdate().isoformat()
    if len(properties) == 1:
        suffix = "brochure" if layout == "brochure" else "factsheet"
        return f"{properties[0].slug}_{suffix}.pdf"
    suffix = "brochures" if layout == "brochure" else "factsheets"
    return f"soreal_{suffix}_{stamp}.pdf"
