"""
Audio analysis module for real estate reel creation.

Ported and adapted from MixMate's audio analysis engine
(Backend/mixmate/analyzer/services.py). Provides BPM detection,
key detection, spectral analysis, waveform extraction, and
time-domain analysis for audio tracks used in reel production.
"""

import io
import math
import shutil
import subprocess

import numpy as np
from scipy import signal
from scipy.io import wavfile

TARGET_SAMPLE_RATE = 44100

BAND_RANGES = [
    ("Sub Bass", 20, 60),
    ("Bass", 60, 250),
    ("Low Mid", 250, 500),
    ("Mid", 500, 2000),
    ("High Mid", 2000, 6000),
    ("High", 6000, 20000),
]

KRUMHANSL_MAJOR = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)
KRUMHANSL_MINOR = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def decode_audio(file_obj, filename=""):
    """
    Decode an uploaded audio file into (sample_rate, samples float64 [-1,1], channels).

    WAV files are decoded with scipy; everything else is decoded through ffmpeg
    (piped stdin/stdout, no temp files) when ffmpeg is available.
    """
    data = file_obj.read()
    if not data:
        raise ValueError("Uploaded file is empty.")

    ext = filename.rsplit(".", 1)[-1].lower() if filename else ""
    if ext == "wav":
        try:
            return _decode_wav(data)
        except Exception:
            pass

    if shutil.which("ffmpeg"):
        return _decode_ffmpeg(data)

    if ext == "wav":
        raise ValueError("Could not decode WAV file.")
    raise ValueError(
        "Could not decode this audio format. Convert to WAV or install ffmpeg."
    )


def _sanitize(samples):
    samples = np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)
    if samples.ndim == 1:
        samples = samples.reshape(-1, 1)
    if samples.size == 0:
        raise ValueError("Audio contained no samples.")
    return samples


def _decode_wav(data):
    sr, samples = wavfile.read(io.BytesIO(data))
    samples = np.asarray(samples)
    if samples.ndim == 1:
        samples = samples.reshape(-1, 1)
    if np.issubdtype(samples.dtype, np.floating):
        samples = samples.astype(np.float64)
    elif np.issubdtype(samples.dtype, np.integer):
        info = np.iinfo(samples.dtype)
        samples = samples.astype(np.float64) / float(max(abs(info.min), info.max))
    return sr, _sanitize(samples), samples.shape[1]


def _decode_ffmpeg(data):
    cmd = [
        "ffmpeg",
        "-v", "error",
        "-i", "pipe:0",
        "-f", "s16le",
        "-acodec", "pcm_s16le",
        "-ar", str(TARGET_SAMPLE_RATE),
        "-ac", "2",
        "pipe:1",
    ]
    proc = subprocess.run(
        cmd,
        input=data,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=180,
    )
    if proc.returncode != 0 or not proc.stdout:
        raise ValueError(f"ffmpeg could not decode audio: {proc.stderr.decode(errors='replace')[-500:]}")
    raw = np.frombuffer(proc.stdout, dtype=np.int16).astype(np.float64) / 32768.0
    if raw.size == 0:
        raise ValueError("ffmpeg produced no audio samples.")
    samples = raw.reshape(-1, 2)
    return TARGET_SAMPLE_RATE, _sanitize(samples), 2


def _channel_sum(samples):
    if samples.ndim == 1:
        return samples
    return samples.mean(axis=1)


def _db(x):
    if not math.isfinite(x) or x <= 1e-12:
        return -120.0
    return 20.0 * math.log10(x)


def _lufs_approx(samples, sr):
    """Approximate loudness using ITU-R BS.1770 style K-weighting + mean square."""
    mono = _channel_sum(samples)
    if mono.size < 512:
        return -70.0
    k_filter = signal.lfilter(
        np.array([1.53512485958697, -2.69169618940638, 1.19839281085285]),
        np.array([1.0, -1.69065929318241, 0.73248077421585]),
        mono,
    )
    if np.any(~np.isfinite(k_filter)):
        return -70.0
    k_filter = np.clip(k_filter, -2.0, 2.0).astype(np.float32, copy=False)
    window = int(0.4 * sr)
    step = int(0.1 * sr)
    energies = []
    for start in range(0, max(mono.size - window, 1), step):
        seg = k_filter[start:start + window]
        energies.append(float(np.mean(seg ** 2)))
    if not energies:
        return -70.0
    gate = float(np.mean(energies))
    gated = [e for e in energies if e > 0.000001 * gate + 1e-12]
    if not gated:
        gated = energies
    mean_energy = float(np.mean(gated))
    if not math.isfinite(mean_energy) or mean_energy <= 1e-12:
        return -70.0
    lufs = -0.691 + 10.0 * math.log10(mean_energy)
    return round(float(lufs), 2)


def detect_bpm(samples, sr):
    """
    Beat detection returning a musically-correct tempo.

    Onset times are measured from a short-frame spectral flux envelope with
    sub-frame quadratic interpolation (instead of hop-quantised lags), then
    matched against candidate beat periods by how many measured intervals land
    on them, with a final phase-consistency check on the winning period.
    Returns ``round(bpm, 1)`` or ``None`` for ambient / too-short material.
    """
    mono = _channel_sum(samples)
    if mono.size < 6 * sr:
        return None

    # Short frames (23 ms) + fine hop (5.8 ms) resolve transient attack times
    # tightly enough that a 128 BPM beat no longer jitters across the grid.
    hop = 256
    frame = 1024
    n_frames = max((mono.size - frame) // hop, 1)

    # Spectral flux: half-wave-rectified change of log-compressed spectrum
    # energy. Summing raw bin energy (not per-band weighting) keeps every
    # percussive hit on one sharp spike, so peak-picking lands on the
    # attacker rather than on a band-specific harmonic.
    onset = np.zeros(n_frames)
    prev_energy = None
    for i in range(n_frames):
        seg = mono[i * hop:i * hop + frame]
        if seg.size < 128:
            break
        spec = np.abs(np.fft.rfft(seg * signal.windows.hann(seg.size)))
        energy = float(np.log1p(spec.sum()))
        if prev_energy is not None:
            onset[i] = max(0.0, energy - prev_energy)
        prev_energy = energy

    onset -= onset.mean()
    if onset.std() > 1e-12:
        onset = onset / onset.std()
    if onset.size >= 3:
        onset = np.convolve(onset, np.ones(3) / 3.0, mode="same")

    # One clean onset per percussive hit. ``min_interval_s`` suppresses the
    # decay-ripple of each hit so intervals measure attacker-to-attacker.
    onset_times = _onset_times(onset, hop, sr, min_interval_s=0.25, height_sigma=0.3)
    if onset_times.size < 8:
        return None

    # Candidate beat periods cover the 40-200 BPM range. Score each by how many
    # measured intervals land on it (Gaussian tolerance ~9%); the fundamental
    # interval dominates because octave harmonics are 2x away from the kernel
    # centre and contribute nothing when summed.
    spacing = np.diff(onset_times)
    periods = np.arange(0.30, 1.501, 0.002)
    score = np.exp(-((spacing[:, None] - periods[None, :]) / (0.09 * periods[None, :])) ** 2)
    mean_score = score.mean(axis=0)
    i = int(np.argmax(mean_score))
    frac = float(np.mean(np.abs(spacing - periods[i]) <= 0.12 * periods[i]))
    if mean_score[i] < 0.32 or frac < 0.38:
        return None

    # Phase verification: every onset should land near a beat grid crossing at
    # the chosen period. If the dominant interval is a harmonic of the true
    # grid (e.g. 2x), the residual phase scatters and we halve to the musical
    # pulse. This keeps 124.6 (beats on 1-and-3 accents) at 124.6 while real
    # half-time settles on the slow pulse.
    residuals = onset_times % periods[i]
    residuals = np.minimum(residuals, periods[i] - residuals)
    phase_frac = float(np.mean(residuals <= 0.1 * periods[i]))
    bpm = 60.0 / float(periods[i])
    if phase_frac < 0.45 and periods[i] * 2.0 <= 1.5:
        bpm = 60.0 / float(periods[i] * 2.0)
        phase_frac = 1.0 - phase_frac
    if not 40.0 <= bpm <= 200.0:
        return None
    return round(float(bpm), 1)


def _onset_times(onset, hop, sr, min_interval_s=0.25, height_sigma=0.3):
    """Peak-pick the onset envelope into discrete onset times (seconds).

    Peak locations are refined with quadratic interpolation around each apex
    so timings are sub-hop accurate (a 256-sample hop at 44.1 kHz is ~5.8 ms,
    about 1% of a 469 ms beat at 128 BPM). ``min_interval_s`` keeps decay
    ripples of one percussive hit from being picked as extra onsets;
    ``height_sigma`` is the peak threshold above the envelope mean in standard
    deviations (low enough to catch quieter beats, high enough to ignore the
    noise floor).
    """
    try:
        peaks, props = signal.find_peaks(
            onset,
            height=float(np.mean(onset) + height_sigma * np.std(onset)),
            distance=max(int(sr * min_interval_s / hop), 2),
        )
    except Exception:  # pragma: no cover - defensive
        props = {}
    if peaks.size == 0:
        return np.array([], dtype=float)

    # Quadratic apex interpolation: x_offset = 0.5 * (y_-1 - y_+1) / (y_-1 - 2 y_0 + y_+1).
    left = np.maximum(peaks - 1, 0)
    right = np.minimum(peaks + 1, onset.size - 1)
    y_l = onset[left]
    y_c = onset[peaks]
    y_r = onset[right]
    denom = y_l - 2.0 * y_c + y_r
    offset = np.zeros_like(peaks, dtype=float)
    good = (peaks > 0) & (peaks < onset.size - 1) & (np.abs(denom) > 1e-12)
    offset[good] = 0.5 * (y_l[good] - y_r[good]) / denom[good]
    return (peaks.astype(float) + offset) * (hop / float(sr))


def detect_key(samples, sr):
    """Estimate musical key via chromagram correlation with Krumhansl-Kessler."""
    key, _conf, _stab = key_profile(samples, sr)
    return key


def _chroma_for(mono, sr):
    """Fold a mono signal into a 12-bin chromagram (octaves collapsed)."""
    mono = np.asarray(mono, dtype=np.float64).ravel()
    if mono.size < sr:
        return None
    hop = 2048
    window = int(0.05 * sr)
    n_bins = 4096
    freqs = np.fft.rfftfreq(n_bins, 1.0 / sr)
    # A4 = 440 Hz; note pc at index i => f = 440 * 2^((i + 12*oct - 9) / 12)
    chroma = np.zeros(12)
    for start in range(0, max(mono.size - window, 1), hop):
        seg = mono[start:start + window]
        if seg.size < n_bins:
            seg = np.pad(seg, (0, n_bins - seg.size))
        mag = np.abs(np.fft.rfft(seg * signal.windows.hann(n_bins)))
        for pc in range(12):
            weights = np.zeros_like(freqs)
            for octave in range(-1, 7):
                f = 440.0 * 2 ** ((pc + 12 * octave - 9) / 12.0)
                idx = np.abs(freqs - f).argmin()
                if freqs[idx] <= 20000:
                    weights[idx] = 1.0
            if weights.sum() > 0:
                chroma[pc] += float(np.sum(mag * weights))
    if chroma.sum() <= 0:
        return None
    return chroma


def _key_from_chroma(chroma):
    """Best key + confidence from a chromagram.

    Confidence is the correlation margin between the winner and the
    runner-up across all 24 key candidates — wide margin means the tonal
    center is unambiguous, narrow means take the label with salt.
    """
    best_score, second_score = -1.0, -1.0
    best = None
    for root in range(12):
        for profile, mode in ((KRUMHANSL_MAJOR, "major"), (KRUMHANSL_MINOR, "minor")):
            rotated = np.roll(chroma, -root)
            n = len(rotated)
            r = (n * np.sum(rotated * profile) - np.sum(rotated) * np.sum(profile)) / (
                math.sqrt(
                    max(n * np.sum(rotated ** 2) - np.sum(rotated) ** 2, 1e-12)
                    * max(n * np.sum(profile ** 2) - np.sum(profile) ** 2, 1e-12)
                )
                + 1e-12
            )
            if r > best_score:
                second_score, best_score = best_score, r
                best = (root, mode)
            elif r > second_score:
                second_score = r
    if best is None:
        return None, 0.0
    root, mode = best
    confidence = min(1.0, max(0.0, (best_score - second_score) / 0.15))
    return f"{NOTE_NAMES[root]} {mode}", round(confidence, 2)


def key_profile(samples, sr):
    """
    Return (key, confidence, stability) for a sample buffer.

    Stability splits the signal into thirds and reports how many sections
    agree with the global key — 1.0 means one tonal center throughout,
    lower means the key drifts (common in drops vs breakdowns).
    """
    mono = _channel_sum(samples)
    chroma = _chroma_for(mono, sr)
    if chroma is None:
        return None, 0.0, 0.0
    key, confidence = _key_from_chroma(chroma)
    n = mono.size
    if n < 3 * sr * 10:
        return key, confidence, 1.0
    agree = 0
    for i in range(3):
        seg = mono[i * n // 3:(i + 1) * n // 3]
        seg_chroma = _chroma_for(seg, sr)
        if seg_chroma is None:
            continue
        seg_key, _ = _key_from_chroma(seg_chroma)
        if seg_key == key:
            agree += 1
    return key, confidence, round(agree / 3.0, 2)


# Octave bands for register-precise reference comparison: A0 (27.5 Hz) up
# through the air band. Your weight at A2 vs theirs at A5 shows up here.
OCTAVE_BANDS = [
    ("Sub A0", 27.5, 55.0),
    ("Bass A1", 55.0, 110.0),
    ("Low A2", 110.0, 220.0),
    ("Mid A3", 220.0, 440.0),
    ("High-mid A4", 440.0, 880.0),
    ("Presence A5", 880.0, 1760.0),
    ("Brilliance A6", 1760.0, 3520.0),
    ("Air A7+", 3520.0, 7500.0),
]


def octave_profile(samples, sr, avg=None):
    """Energy share per octave register — the A2-vs-A5 answer.

    Chroma folds octaves away; this keeps them, so a reference comparison
    can say *where* in register two tracks differ, not just that they do.
    """
    if avg is None:
        mono = _channel_sum(samples)
        avg = _avg_power_spectrum(mono, sr)
    if avg is None:
        return []
    power, freqs, _ = avg
    total = power.sum()
    if total <= 0:
        return []
    out = []
    for name, lo, hi in OCTAVE_BANDS:
        mask = (freqs >= lo) & (freqs < hi)
        out.append({
            "octave": name,
            "hz_start": lo,
            "hz_end": hi,
            "share": round(float(power[mask].sum() / total * 100.0), 1),
        })
    return out


def _avg_power_spectrum(mono, sr):
    """Average power spectrum (linear) across the whole file via windowed FFTs.

    Returns (power, freqs, fft_size) or None when the signal is too short.
    Averages up to 2000 overlapping frames so quiet intros no longer dominate.
    """
    if mono.size < 1024:
        return None
    fft_size = 1 << int(np.ceil(np.log2(min(0.1 * sr, 8192))))
    if fft_size > mono.size:
        fft_size = 1 << int(np.floor(np.log2(mono.size)))
    if fft_size < 256:
        fft_size = 256
    hop = fft_size // 4
    window = signal.windows.hann(fft_size)
    power = np.zeros(fft_size // 2 + 1)
    count = 0
    for start in range(0, mono.size - fft_size + 1, hop):
        seg = mono[start:start + fft_size]
        mag = np.abs(np.fft.rfft(seg * window))
        power += mag * mag
        count += 1
        if count >= 2000:
            break
    if count == 0:
        return None
    power /= count
    freqs = np.fft.rfftfreq(fft_size, 1.0 / sr)
    return power, freqs, fft_size


def spectrum(samples, sr, num_points=64, avg=None):
    if avg is None:
        mono = _channel_sum(samples)
        avg = _avg_power_spectrum(mono, sr)
    if avg is None:
        return []
    power, freqs, fft_size = avg
    db = 20.0 * np.log10(np.sqrt(power) / (fft_size / 2) + 1e-12)
    # Clip to a relative 96 dB floor so quiet bands render cleanly instead of -240.
    db = np.clip(db, float(db.max()) - 96.0, None)
    # Log-frequency binning to mirror perceptual hearing.
    lo, hi = 20.0, 20000.0
    log_bins = np.logspace(np.log10(lo), np.log10(hi), num_points + 1)
    result = []
    for i in range(num_points):
        mask = (freqs >= log_bins[i]) & (freqs < log_bins[i + 1])
        if not mask.any():
            continue
        result.append({
            "freq": round(float(np.exp(np.mean(np.log(log_bins[i:i + 2])))), 1),
            "amplitude": round(float(db[mask].max()), 2),
        })
    return result


def band_energies(samples, sr, avg=None):
    if avg is None:
        mono = _channel_sum(samples)
        avg = _avg_power_spectrum(mono, sr)
    if avg is None:
        return []
    power, freqs, _ = avg
    total = power.sum()
    if total <= 0:
        return []
    result = []
    for name, lo, hi in BAND_RANGES:
        mask = (freqs >= lo) & (freqs < hi)
        energy = power[mask].sum()
        pct = energy / total * 100.0
        result.append({
            "name": name,
            "hz_start": lo,
            "hz_end": hi,
            "level_db": round(_db(energy / max(total, 1e-12)), 1),
            "share": round(float(pct), 1),
        })
    return result


def phase_correlation(samples, sr, num_points=200):
    if samples.ndim == 1 or samples.shape[1] < 2:
        return []
    left = samples[:, 0]
    right = samples[:, 1]
    n = min(len(left), len(right))
    chunk = max(int(0.1 * sr), 1024)
    step = max(int(0.05 * sr), chunk // 2)
    pairs = []
    for start in range(0, n - chunk, step):
        l = left[start:start + chunk]
        r = right[start:start + chunk]
        denom = np.linalg.norm(l) * np.linalg.norm(r)
        if denom <= 1e-12:
            continue
        pairs.append(float(np.dot(l, r) / denom))
        if len(pairs) >= num_points:
            break
    return [round(p, 3) for p in pairs]


def stereo_width(samples):
    if samples.ndim == 1 or samples.shape[1] < 2:
        return 0.0
    left = samples[:, 0]
    right = samples[:, 1]
    mid = (left + right) / 2.0
    side = (left - right) / 2.0
    mid_rms = float(np.sqrt(np.mean(mid ** 2))) + 1e-12
    side_rms = float(np.sqrt(np.mean(side ** 2))) + 1e-12
    return round(float(side_rms / mid_rms), 3)


def phase_report(samples, sr):
    """Rich phase-correlation report: stats, histogram and per-band correlation."""
    if samples.ndim == 1 or samples.shape[1] < 2:
        return None
    left = samples[:, 0].astype(np.float64)
    right = samples[:, 1].astype(np.float64)
    n = min(len(left), len(right))
    if n < 1024:
        return None

    chunk = max(int(0.1 * sr), 1024)
    step = max(int(0.05 * sr), chunk // 2)
    pairs = []
    for start in range(0, n - chunk, step):
        l = left[start:start + chunk]
        r = right[start:start + chunk]
        denom = np.linalg.norm(l) * np.linalg.norm(r)
        if denom <= 1e-12:
            continue
        pairs.append(float(np.dot(l, r) / denom))
        if len(pairs) >= 600:
            break

    if not pairs:
        return None
    arr = np.asarray(pairs, dtype=float)
    below_zero = float(np.mean(arr < 0.0)) * 100.0
    collapse = float(np.mean(arr < -0.3)) * 100.0
    correlated = float(np.mean(arr >= 0.7)) * 100.0
    uncorrelated = float(np.mean((arr > -0.7) & (arr < 0.7))) * 100.0

    edges = np.linspace(-1.0, 1.0, 11)
    counts, _ = np.histogram(arr, bins=edges)
    histogram = [
        {"from": round(float(edges[i]), 2), "to": round(float(edges[i + 1]), 2), "count": int(c)}
        for i, c in enumerate(counts)
    ]

    band_corr = []
    if n >= 4096:
        fft_size = 4096 if sr >= 22050 else 2048
        hann = signal.windows.hann(fft_size)
        acc = [{"dot": 0.0, "nl": 0.0} for _ in BAND_RANGES]
        n_frames = 0
        for start in range(0, n - fft_size, fft_size // 2):
            lf = np.abs(np.fft.rfft(left[start:start + fft_size] * hann)) ** 2
            rf = np.abs(np.fft.rfft(right[start:start + fft_size] * hann)) ** 2
            freqs = np.fft.rfftfreq(fft_size, 1.0 / sr)
            for bi, (_name, lo, hi) in enumerate(BAND_RANGES):
                mask = (freqs >= lo) & (freqs < hi)
                if not mask.any():
                    continue
                acc[bi]["dot"] += float(np.sum(np.sqrt(lf[mask] * rf[mask])))
                acc[bi]["nl"] += float(math.sqrt(float(np.sum(lf[mask])) * float(np.sum(rf[mask])) + 1e-12))
            n_frames += 1
        for bi, (name, lo, hi) in enumerate(BAND_RANGES):
            if acc[bi]["nl"] <= 1e-12:
                continue
            corr = float(acc[bi]["dot"] / acc[bi]["nl"])
            band_corr.append({
                "name": name,
                "hz_start": int(lo),
                "hz_end": int(hi),
                "corr": round(float(np.clip(corr, -1.0, 1.0)), 3),
            })

    mid = (left + right) / 2.0
    side = (left - right) / 2.0
    mid_rms = float(np.sqrt(np.mean(mid ** 2))) + 1e-12
    side_rms = float(np.sqrt(np.mean(side ** 2))) + 1e-12

    worst_band = min(band_corr, key=lambda b: b["corr"]) if band_corr else None
    summary_parts = []
    if collapse > 2.0:
        summary_parts.append(f"{round(collapse)}% of frames are strongly out of phase and can cancel in mono")
    elif below_zero > 20.0:
        summary_parts.append(f"{round(below_zero)}% of frames dip below 0 correlation")
    else:
        summary_parts.append("phase correlation stays healthy across the track")
    if worst_band and worst_band["corr"] < 0.5:
        summary_parts.append(
            f"the {worst_band['name'].lower()} range is the weakest ({worst_band['corr']})"
        )

    return {
        "avg": round(float(np.mean(arr)), 3),
        "min": round(float(np.min(arr)), 3),
        "max": round(float(np.max(arr)), 3),
        "std": round(float(np.std(arr)), 3),
        "below_zero_pct": round(below_zero, 1),
        "collapse_pct": round(collapse, 1),
        "correlated_pct": round(correlated, 1),
        "uncorrelated_pct": round(uncorrelated, 1),
        "histogram": histogram,
        "bands": band_corr,
        "width": round(float(side_rms / mid_rms), 3),
        "image_balance": round(float(side_rms / (mid_rms + side_rms)), 3),
        "summary": "; ".join(summary_parts).capitalize() + ".",
    }


def spectral_centroid(samples, sr, avg=None):
    if avg is None:
        mono = _channel_sum(samples)
        avg = _avg_power_spectrum(mono, sr)
    if avg is None:
        return 0.0
    power, freqs, _ = avg
    total = power.sum()
    if total <= 0:
        return 0.0
    return round(float(np.sum(freqs * power) / total), 1)


def spectral_rolloff(samples, sr, threshold=0.85, avg=None):
    if avg is None:
        mono = _channel_sum(samples)
        avg = _avg_power_spectrum(mono, sr)
    if avg is None:
        return 0.0
    power, freqs, _ = avg
    total = power.sum()
    if total <= 0:
        return 0.0
    cumulative = np.cumsum(power)
    idx = int(np.searchsorted(cumulative, threshold * total))
    idx = min(idx, len(freqs) - 1)
    return round(float(freqs[idx]), 1)


def spectral_flatness(samples, sr, avg=None):
    if avg is None:
        mono = _channel_sum(samples)
        avg = _avg_power_spectrum(mono, sr)
    if avg is None:
        return 0.0
    power, freqs, _ = avg
    power = power + 1e-12
    geometric = float(np.exp(np.mean(np.log(power))))
    arithmetic = float(np.mean(power))
    if arithmetic <= 0:
        return 0.0
    return round(float(geometric / arithmetic), 4)


def waveform_peaks(samples, sr, num_points=400):
    mono = _channel_sum(samples)
    if mono.size == 0:
        return []
    step = max(len(mono) // num_points, 1)
    peaks = []
    for i in range(0, len(mono), step):
        seg = mono[i:i + step]
        if seg.size == 0:
            continue
        peaks.append(round(float(np.abs(seg).max()), 4))
    return peaks


def time_analysis(samples, sr, max_windows=120, min_window=1.0):
    """Per-timestep (time-grid) analysis across the file.

    Divides the signal into ~min_window-second windows (capped at max_windows)
    and reports loudness, dynamics, spectral centroid, dominant band and
    stereo width for each slice.
    """
    mono = _channel_sum(samples)
    n = mono.size
    if n < sr:
        return []
    duration = n / float(sr)
    win_size = max(int(sr * min_window), int(sr * duration / max_windows))
    win_size = max(win_size, int(sr // 2))

    result = []
    start = 0
    while start < n:
        seg = mono[start:start + win_size]
        if seg.size < int(sr * 0.25):
            break
        t0 = start / float(sr)
        t1 = (start + win_size) / float(sr)

        rms = float(np.sqrt(np.mean(seg ** 2)))
        peak = float(np.abs(seg).max())

        fft_size = 1 << int(np.ceil(np.log2(min(win_size, 8192))))
        if fft_size > seg.size:
            fft_size = 1 << int(np.floor(np.log2(seg.size)))
        if fft_size < 256:
            fft_size = 256
        windowed = seg[:fft_size] * signal.windows.hann(fft_size)
        power = np.abs(np.fft.rfft(windowed)) ** 2
        freqs = np.fft.rfftfreq(fft_size, 1.0 / sr)
        total = float(power.sum())
        centroid = float(np.sum(freqs * power) / total) if total > 0 else 0.0

        top_band = None
        top_share = 0.0
        if total > 0:
            best = -1.0
            for name, lo, hi in BAND_RANGES:
                band_energy = float(power[(freqs >= lo) & (freqs < hi)].sum())
                if band_energy > best:
                    best = band_energy
                    top_band = name
            top_share = round(float(best / total * 100.0), 1)

        # Per-band peak levels (magnitude dB, same scale family as spectrum())
        band_db = {}
        if total > 1e-12:
            mag_db = 20.0 * np.log10(np.sqrt(power) / (fft_size / 2) + 1e-12)
            for name, lo, hi in BAND_RANGES:
                mask = (freqs >= lo) & (freqs < hi)
                band_db[name] = round(float(mag_db[mask].max()) if mask.any() else -120.0, 1)
        else:
            for name, _lo, _hi in BAND_RANGES:
                band_db[name] = -120.0

        width = 0.0
        if samples.ndim == 2 and samples.shape[1] >= 2:
            seg2 = samples[start:start + win_size, :]
            mid = (seg2[:, 0] + seg2[:, 1]) / 2.0
            side = (seg2[:, 0] - seg2[:, 1]) / 2.0
            mid_rms = float(np.sqrt(np.mean(mid ** 2))) + 1e-12
            side_rms = float(np.sqrt(np.mean(side ** 2))) + 1e-12
            width = round(float(side_rms / mid_rms), 3)

        result.append({
            "t_start": round(t0, 2),
            "t_end": round(t1, 2),
            "rms_db": round(_db(rms), 1),
            "peak_db": round(_db(peak), 1),
            "crest_db": round(float(_db(peak) - _db(rms)), 1),
            "centroid_hz": round(centroid, 1),
            "top_band": top_band,
            "top_band_share": top_share,
            "band_db": band_db,
            "stereo_width": width,
        })
        start += win_size
    return result


def analyze(samples, sr, filename="", target=None):
    """Full analysis of an audio track.

    Returns a dict with all analysis results suitable for serializing to JSON
    and storing on an AudioTrack model.
    """
    mono = _channel_sum(samples)
    peak = float(np.abs(mono).max()) if mono.size else 0.0
    rms = float(np.sqrt(np.mean(mono ** 2))) if mono.size else 0.0
    duration = len(samples) / float(sr)
    avg = _avg_power_spectrum(mono, sr)

    _key, _key_conf, _key_stab = key_profile(samples, sr)

    result = {
        "filename": filename,
        "duration_seconds": round(duration, 2),
        "sample_rate": int(sr),
        "channels": samples.shape[1],
        "bpm": detect_bpm(samples, sr),
        "key": _key,
        "key_confidence": _key_conf,
        "key_stability": _key_stab,
        "octave_profile": octave_profile(samples, sr, avg=avg),
        "loudness_lufs": _lufs_approx(samples, sr),
        "rms_db": round(_db(rms), 1),
        "true_peak_db": round(_db(peak), 1),
        "clipped_samples": int((np.abs(mono) >= 0.999).sum()) if mono.size else 0,
        "crest_factor_db": round(float(_db(peak) - _db(rms)), 1),
        "spectral_centroid_hz": spectral_centroid(samples, sr, avg=avg),
        "spectral_rolloff_hz": spectral_rolloff(samples, sr, avg=avg),
        "spectral_flatness": spectral_flatness(samples, sr, avg=avg),
        "stereo_width": stereo_width(samples),
        "phase_correlation": phase_correlation(samples, sr),
        "phase_report": phase_report(samples, sr),
        "waveform": waveform_peaks(samples, sr),
        "spectrum": spectrum(samples, sr, avg=avg),
        "bands": band_energies(samples, sr, avg=avg),
        "timeline": time_analysis(samples, sr),
    }
    return result