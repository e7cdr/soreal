# tour_menu/parser.py - Adapted for soreal lead extraction
import os
import re
import shutil
import stat
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import List, Dict, Any
from .extractor import is_property_request

MAX_ARCHIVE_ENTRIES = 2000
MAX_EXTRACTED_BYTES = 100 * 1024 * 1024
MESSAGE_PATTERN = re.compile(
    r"^\[?(?P<date>\d{1,2}[/-]\d{1,2}[/-]\d{2,4}),\s*"
    r"(?P<time>\d{1,2}:\d{2}(?::\d{2})?(?:[\s\u00a0]*[ap]\.?[\s\u00a0]*m\.?)?)"
    r"(?:\]\s*|\s+-\s+)(?P<sender>[^:]+):\s*(?P<message>.*)$",
    re.IGNORECASE,
)
ATTACHMENT_PATTERN = re.compile(
    r"<attached:\s*([^>]+)>|(?<!\S)([^\s<>]+\.[A-Za-z0-9]{2,8})\s+\(file attached\)",
    re.IGNORECASE,
)


def unzip_chat_export(
    zip_path: str, output_dir: str = ".", extract_to: str = None, debug: bool = False
) -> tuple[str, str]:
    """Extract a WhatsApp chat export ZIP file."""
    os.makedirs(output_dir, exist_ok=True)
    if extract_to:
        extract_dir = os.path.join(output_dir, extract_to)
        os.makedirs(extract_dir, exist_ok=True)
    else:
        extract_dir = tempfile.mkdtemp(prefix="whatsapp_chat_", dir=output_dir)

    try:
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            members = zip_ref.infolist()
            if len(members) > MAX_ARCHIVE_ENTRIES:
                raise ValueError("ZIP contains too many files.")

            total_size = sum(member.file_size for member in members)
            if total_size > MAX_EXTRACTED_BYTES:
                raise ValueError("ZIP contents exceed the 100 MB import limit.")

            root = Path(extract_dir).resolve()
            for member in members:
                normalized_name = member.filename.replace("\\", "/")
                member_path = PurePosixPath(normalized_name)
                if member_path.is_absolute() or ".." in member_path.parts:
                    raise ValueError("ZIP contains an unsafe file path.")
                if not member_path.parts or ":" in member_path.parts[0]:
                    raise ValueError("ZIP contains an unsafe file path.")

                target = (root / Path(*member_path.parts)).resolve()
                if os.path.commonpath([str(root), str(target)]) != str(root):
                    raise ValueError("ZIP contains an unsafe file path.")

                mode = member.external_attr >> 16
                if stat.S_ISLNK(mode):
                    raise ValueError("ZIP contains an unsupported symbolic link.")
                if member.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue

                target.parent.mkdir(parents=True, exist_ok=True)
                with zip_ref.open(member) as source, target.open("wb") as destination:
                    extracted_size = 0
                    while chunk := source.read(64 * 1024):
                        extracted_size += len(chunk)
                        if extracted_size > member.file_size or extracted_size + (
                            total_size - member.file_size
                        ) > MAX_EXTRACTED_BYTES:
                            raise ValueError(
                                "ZIP contents exceed the 100 MB import limit."
                            )
                        destination.write(chunk)
    except Exception:
        shutil.rmtree(extract_dir, ignore_errors=True)
        raise

    if debug:
        print(f"\n=== DEBUG: Extracted ZIP contents in {extract_dir} ===")
        for root, dirs, files in os.walk(extract_dir):
            level = root.replace(extract_dir, "").count(os.sep)
            indent = ' ' * 2 * level
            print(f"{indent}{os.path.basename(root)}/")
            subindent = ' ' * 2 * (level + 1)
            for file in files:
                print(f"{subindent}{file}")

    txt_files = sorted(
        str(path)
        for path in Path(extract_dir).rglob("*")
        if path.is_file() and path.suffix.lower() == ".txt"
        if "__MACOSX" not in path.parts
    )
    if not txt_files:
        shutil.rmtree(extract_dir, ignore_errors=True)
        raise ValueError("No TXT file found in ZIP.")

    return txt_files[0], extract_dir


def parse_whatsapp_chat(txt_path: str, extract_dir: str, debug: bool = False) -> List[Dict[str, Any]]:
    """Parse a WhatsApp chat export text file into message records."""
    messages = []
    with open(txt_path, "r", encoding="utf-8-sig", errors="replace") as chat_file:
        lines = chat_file.readlines()

    for line in lines:
        line = line.rstrip("\r\n")
        match = MESSAGE_PATTERN.match(line)
        if match:
            date_str = match.group("date")
            time_str = match.group("time")
            sender = match.group("sender").strip()
            msg = match.group("message")
            attachments = [
                (attachment.group(1) or attachment.group(2)).strip()
                for attachment in ATTACHMENT_PATTERN.finditer(msg)
            ]
            msg = ATTACHMENT_PATTERN.sub("", msg).strip()
            messages.append({
                'date': date_str,
                'time': time_str,
                'sender': sender.strip("\u200e\u200f "),
                'message': msg,
                'attachments': attachments,
            })
        elif messages and line.strip():
            messages[-1]["message"] += "\n" + line

    if debug:
        print(f"\n=== DEBUG: All parsed messages with attachments ===")
        for idx, msg in enumerate(messages):
            if msg['attachments']:
                print(f"Message {idx} ({msg['date']} {msg['time']}, {msg['sender']}): attachments={msg['attachments']}, text='{msg['message'][:50]}...'")

    return messages


def _parse_message_datetime(message: Dict[str, Any]) -> datetime:
    time_str = re.sub(r"[\s\u00a0]+", " ", message["time"].strip())
    time_str = re.sub(r"\b([ap])\.\s*m\.?", r"\1m", time_str, flags=re.IGNORECASE)
    date_time = f"{message['date']} {time_str}"
    for date_format in ("%m/%d/%y", "%m/%d/%Y", "%d/%m/%y", "%d/%m/%Y",
                        "%m-%d-%y", "%m-%d-%Y", "%d-%m-%y", "%d-%m-%Y"):
        for time_format in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M:%S %p"):
            try:
                return datetime.strptime(f"{message['date']} {time_str}", f"{date_format} {time_format}")
            except ValueError:
                continue
    raise ValueError(f"Unsupported WhatsApp date/time: {date_time}")


def associate_request_context(
    messages: List[Dict[str, Any]],
    prior_window_minutes: int = 5,
    followup_window_minutes: int = 10,
) -> List[Dict[str, Any]]:
    """Keep a request's nearby link and short requirement replies with the request."""
    consumed = set()
    merged = {}
    detail_reply_pattern = re.compile(
        r"\b(?:vac[ií]os?|amueblad[oa]s?|furnished|unfurnished|"
        r"\d+\s*(?:habitaci[oó]n|dormitorio|bed|br|ba[ñn]o)|"
        r"presupuesto|budget|entre\s+\d+|hasta\s+\d+)\b",
        re.IGNORECASE,
    )

    for index, message in enumerate(messages):
        if index in consumed:
            continue
        current = message.copy()
        if not is_property_request(current.get("message", "")):
            merged[index] = current
            continue

        try:
            request_datetime = _parse_message_datetime(current)
        except ValueError:
            merged[index] = current
            continue
        context_parts = []
        context_attachments = []

        for previous_index in range(max(0, index - 5), index):
            previous = messages[previous_index]
            if previous.get("sender") != current.get("sender"):
                continue
            try:
                difference = (
                    request_datetime - _parse_message_datetime(previous)
                ).total_seconds() / 60
            except ValueError:
                continue
            previous_text = (previous.get("message") or "").strip()
            is_context_link = bool(re.search(r"https?://\S+", previous_text))
            has_attachments = bool(previous.get("attachments"))
            if (
                0 <= difference <= prior_window_minutes
                and (is_context_link or has_attachments)
            ):
                if previous_text:
                    context_parts.append(previous_text)
                context_attachments.extend(previous.get("attachments", []))
                consumed.add(previous_index)

        for next_index in range(index + 1, min(len(messages), index + 6)):
            following = messages[next_index]
            if following.get("sender") != current.get("sender"):
                continue
            following_text = (following.get("message") or "").strip()
            if not following_text or len(following_text) > 120:
                continue
            if is_property_request(following_text):
                continue
            try:
                difference = (
                    _parse_message_datetime(following) - request_datetime
                ).total_seconds() / 60
            except ValueError:
                continue
            if (
                0 <= difference <= followup_window_minutes
                and detail_reply_pattern.search(following_text)
            ):
                context_parts.append(following_text)
                context_attachments.extend(following.get("attachments", []))
                consumed.add(next_index)

        current["message"] = "\n".join(context_parts + [current.get("message", "")]).strip()
        current["attachments"] = list(
            dict.fromkeys(context_attachments + current.get("attachments", []))
        )
        merged[index] = current
    return [
        merged[index]
        for index in range(len(messages))
        if index in merged and index not in consumed
    ]


def associate_followup_attachments(messages: List[Dict[str, Any]], max_followups: int = 10, time_tolerance_minutes: int = 5, debug: bool = False) -> List[Dict[str, Any]]:
    """
    Post-process: For messages with destination keywords (non-empty text), append attachments
    from subsequent same-sender att-only messages that are close in time.
    """
    processed = []
    i = 0
    while i < len(messages):
        msg = messages[i]
        processed.append(msg)

        if msg.get('destination') == 'Other' or not msg['message'].strip():
            i += 1
            continue

        try:
            dt = _parse_message_datetime(msg)
        except ValueError:
            i += 1
            continue

        j = i + 1
        while j < len(messages) and j < i + max_followups:
            next_msg = messages[j]
            if next_msg['sender'] == msg['sender'] and next_msg['attachments'] and not next_msg['message'].strip():
                try:
                    next_dt = _parse_message_datetime(next_msg)
                    time_diff = (next_dt - dt).total_seconds() / 60
                    if 0 <= time_diff <= time_tolerance_minutes:
                        msg['attachments'].extend(next_msg['attachments'])
                        if debug:
                            print(f"Associated followup atts from {j} to {i}: {next_msg['attachments']} (time diff: {time_diff:.1f} min)")
                        j += 1
                        continue
                except ValueError:
                    pass
            break
        i = j

    if debug:
        print(f"=== DEBUG: Association summary ===")
        for msg in processed:
            if len(msg['attachments']) > 1 or (len(msg['attachments']) == 1 and not msg['message'].strip()):
                print(f"Msg {msg['date']} {msg['time']}: {len(msg['attachments'])} atts {'(associated)' if len(msg['attachments']) > 1 else '(single)'}")

    return processed


def dedupe_messages(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Remove exact duplicate messages within same destination to reduce chat-like repetition."""
    seen = set()
    unique = []
    for msg in messages:
        key = (msg.get('destination', ''), msg.get('sender', ''), msg['message'])
        if key not in seen:
            seen.add(key)
            unique.append(msg)
    return unique


def copy_media_to_menu_dir(tour_messages: List[Dict[str, Any]], misc_messages: List[Dict[str, Any]], extract_dir: str, output_dir: str = '.', media_dir: str = 'whatsapp_media', debug: bool = False):
    """Copy all unique attachments from tour + misc to a media subdir."""
    media_dir = os.path.join(output_dir, media_dir)
    if os.path.exists(media_dir):
        shutil.rmtree(media_dir)
    os.makedirs(media_dir)

    all_atts = set()
    for msg in tour_messages + misc_messages:
        for att in msg['attachments']:
            all_atts.add(att)

    copied = {}
    copied_count = 0
    for att in all_atts:
        src_found = None
        for root, _, files in os.walk(extract_dir):
            if att in files:
                src_found = os.path.join(root, att)
                break

        if src_found and os.path.exists(src_found):
            flat_dest = os.path.join(media_dir, os.path.basename(att))
            shutil.copy2(src_found, flat_dest)
            rel_path = f"whatsapp_media/{os.path.basename(att)}"
            copied[att] = rel_path
            copied_count += 1
            if debug:
                print(f"  Copied: {att} -> {rel_path} (from {src_found})")
        else:
            if debug:
                print(f"  Warning: Could not find or copy {att}")

    if debug:
        print(f"\n=== DEBUG: Copy summary ===")
        print(f"  Successfully copied: {copied_count}/{len(all_atts)} files")

    return copied
