from io import BytesIO
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from PIL import Image, ImageDraw, ImageFont, ImageOps
from estates.models import Property


class SocialPostDownloadView(APIView):
    """
    Generate a downloadable social media post for a property.

    Returns a ZIP file containing:
    - post.png: Image with property details overlaid (ready for Instagram/Facebook)
    - caption.txt: Pre-written caption text
    """

    permission_classes = [AllowAny]

    def get(self, request, slug):
        property = get_object_or_404(Property, slug=slug)

        # Get cover image URL
        cover_image = None
        images = property.images.all()
        if images.exists():
            cover_image = images.filter(is_cover=True).first() or images.first()

        # Build the post image
        img_bytes = self._build_post_image(property, cover_image)

        # Build the caption
        caption = self._build_caption(property)

        # Create ZIP in memory
        import zipfile
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("post.png", img_bytes.getvalue())
            zf.writestr("caption.txt", caption.encode("utf-8"))

        zip_buffer.seek(0)

        response = HttpResponse(
            zip_buffer.read(),
            content_type="application/zip",
        )
        response["Content-Disposition"] = (
            f'attachment; filename="{property.slug}_social_post.zip"'
        )
        return response

    def _build_post_image(self, property, cover_image):
        """Create a social media post image with property details overlaid."""
        # Canvas size: 1080x1350 (4:5 portrait, good for IG/FB)
        width, height = 1080, 1350
        canvas = Image.new("RGB", (width, height), "#1a1a1a")
        draw = ImageDraw.Draw(canvas)

        # Try to load fonts with fallbacks
        try:
            font_title = ImageFont.truetype("arialbd.ttf", 64)
            font_subtitle = ImageFont.truetype("arial.ttf", 40)
            font_small = ImageFont.truetype("arial.ttf", 32)
        except Exception:
            font_title = ImageFont.load_default()
            font_subtitle = ImageFont.load_default()
            font_small = ImageFont.load_default()

        # Add cover image if available (top portion)
        if cover_image and hasattr(cover_image.image, "path"):
            try:
                img = Image.open(cover_image.image.path).convert("RGB")
                # Crop to cover the top 60% of canvas
                img_ratio = img.width / img.height
                target_ratio = width / (height * 0.6)
                if img_ratio > target_ratio:
                    new_width = int(img.height * target_ratio)
                    left = (img.width - new_width) // 2
                    img = img.crop((left, 0, left + new_width, img.height))
                else:
                    new_height = int(img.width / target_ratio)
                    top = (img.height - new_height) // 2
                    img = img.crop((0, top, img.width, top + new_height))
                img = img.resize((width, int(height * 0.6)))
                canvas.paste(img, (0, 0))
            except Exception:
                pass

        # Dark overlay for text readability
        overlay = Image.new("RGBA", (width, height), (0, 0, 0, 120))
        canvas.paste(overlay, (0, 0), overlay)

        draw = ImageDraw.Draw(canvas)

        # Title
        title = property.title
        draw.text(
            (60, int(height * 0.65)),
            title,
            font=font_title,
            fill="#ffffff",
        )

        # Price line
        if property.price:
            price_text = f"{property.currency} {property.price:,.0f}"
            draw.text(
                (60, int(height * 0.74)),
                price_text,
                font=font_subtitle,
                fill="#ff6b6b",
            )

        # Location line
        location = f"{property.city}, {property.province}" if property.city and property.province else ""
        if location:
            draw.text(
                (60, int(height * 0.80)),
                location,
                font=font_small,
                fill="#cccccc",
            )

        # Property type + listing type
        type_line = f"{property.get_property_type_display()} · {property.get_listing_type_display()}"
        draw.text(
            (60, int(height * 0.85)),
            type_line,
            font=font_small,
            fill="#cccccc",
        )

        # Footer
        draw.text(
            (60, height - 80),
            "SOREAL Estate · Contact us to schedule a visit",
            font=font_small,
            fill="#888888",
        )

        # Save to bytes
        buf = BytesIO()
        canvas.save(buf, format="PNG", quality=95)
        buf.seek(0)
        return buf

    def _build_caption(self, property):
        """Build a pre-written social media caption."""
        lines = []

        lines.append(f"🏠 {property.title}")
        lines.append("")

        if property.price:
            lines.append(f"💰 Price: {property.currency} {property.price:,.0f}")

        if property.bedrooms:
            lines.append(f"🛏️ Bedrooms: {property.bedrooms}")
        if property.bathrooms:
            lines.append(f"🚽 Bathrooms: {property.bathrooms}")
        if property.area_sqm:
            lines.append(f"📐 Area: {property.area_sqm} m²")

        lines.append("")
        lines.append(f"📍 Location: {property.city}, {property.province}")
        lines.append(f"🏷️ Type: {property.get_property_type_display()}")
        lines.append(f"📋 Listing: {property.get_listing_type_display()}")

        if property.description:
            # Strip HTML tags roughly
            import re
            desc = re.sub(r"<[^>]+>", "", property.description or "")
            lines.append("")
            lines.append(f"📝 {desc[:300]}")

        lines.append("")
        lines.append("Contact us to schedule a visit!")
        lines.append("")
        lines.append("#RealEstate #PropertyForSale #PropertyForRent #SOREALEstate #DominicanRepublic")

        return "\n".join(lines)
