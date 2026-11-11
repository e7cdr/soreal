# tour_menu/parser.py - Adapted for soreal lead extraction
import os
import re
import shutil
import zipfile
from datetime import datetime
from typing import List, Dict, Any


def unzip_chat_export(zip_path: str, output_dir: str = '.', extract_to: str = 'extracted_chat_temp', debug: bool = False) -> tuple[str, str]:
    """Extract a WhatsApp chat export ZIP file."""
    extract_to = os.path.join(output_dir, extract_to)
    if os.path.exists(extract_to):
        shutil.rmtree(extract_to)
    os.makedirs(extract_to)

    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_to)

    if debug:
        print(f"\n=== DEBUG: Extracted ZIP contents in {extract_to} ===")
        for root, dirs, files in os.walk(extract_to):
            level = root.replace(extract_to, '').count(os.sep)
            indent = ' ' * 2 * level
            print(f"{indent}{os.path.basename(root)}/")
            subindent = ' ' * 2 * (level + 1)
            for file in files:
                print(f"{subindent}{file}")

    txt_files = [f for f in os.listdir(extract_to) if f.endswith('.txt')]
    if not txt_files:
        raise ValueError("No TXT file found in ZIP.")

    txt_path = os.path.join(extract_to, txt_files[0])
    return txt_path, extract_to


def parse_whatsapp_chat(txt_path: str, extract_dir: str, debug: bool = False) -> List[Dict[str, Any]]:
    """Parse a WhatsApp chat export text file into message records."""
    messages = []
    with open(txt_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # WhatsApp export format: MM/DD/YY, HH:MM - Sender: Message
        match = re.match(r'^(\d{1,2}/\d{1,2}/\d{2}), (\d{2}:\d{2}) - (.+?): (.*)$', line)
        if match:
            date_str, time_str, sender, msg = match.groups()
            attachments = []
            if '(file attached)' in msg:
                clean_filename = msg.split('(file attached)')[0].strip()
                attachments = [clean_filename]
                msg = ''
            messages.append({
                'date': date_str,
                'time': time_str,
                'sender': sender,
                'message': msg.strip(),
                'attachments': attachments,
            })
            i += 1
        else:
            i += 1

    if debug:
        print(f"\n=== DEBUG: All parsed messages with attachments ===")
        for idx, msg in enumerate(messages):
            if msg['attachments']:
                print(f"Message {idx} ({msg['date']} {msg['time']}, {msg['sender']}): attachments={msg['attachments']}, text='{msg['message'][:50]}...'")

    return messages


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
            dt = datetime.strptime(f"{msg['date']} {msg['time']}", '%m/%d/%y %H:%M')
        except ValueError:
            i += 1
            continue

        j = i + 1
        while j < len(messages) and j < i + max_followups:
            next_msg = messages[j]
            if next_msg['sender'] == msg['sender'] and next_msg['attachments'] and not next_msg['message'].strip():
                try:
                    next_dt = datetime.strptime(f"{next_msg['date']} {next_msg['time']}", '%m/%d/%y %H:%M')
                    time_diff = (next_dt - dt).total_seconds() / 60
                    if time_diff <= time_tolerance_minutes:
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
        key = (msg.get('destination', ''), msg['message'])
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
