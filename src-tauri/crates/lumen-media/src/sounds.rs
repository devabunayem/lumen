use std::sync::{
    Mutex, OnceLock,
    mpsc::{self, RecvTimeoutError, Sender},
};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UiSoundName {
    Open,
    Close,
    ToggleOn,
    ToggleOff,
    WaterAdd,
    TaskDone,
    ArcScrubTick,
    DaySelect,
    DropOnDay,
    FocusStart,
    FocusEnd,
    ReminderChime,
    ReminderAlarm,
    MailArrival,
    Error,
    LumiHello,
    LumiHappy,
}

impl UiSoundName {
    pub fn from_str_name(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "open" => Some(Self::Open),
            "close" => Some(Self::Close),
            "toggle_on" | "toggleon" => Some(Self::ToggleOn),
            "toggle_off" | "toggleoff" => Some(Self::ToggleOff),
            "water_add" | "wateradd" => Some(Self::WaterAdd),
            "task_done" | "taskdone" => Some(Self::TaskDone),
            "arc_scrub_tick" | "arcscrubtick" => Some(Self::ArcScrubTick),
            "day_select" | "dayselect" => Some(Self::DaySelect),
            "drop_on_day" | "droponday" => Some(Self::DropOnDay),
            "focus_start" | "focusstart" => Some(Self::FocusStart),
            "focus_end" | "focusend" => Some(Self::FocusEnd),
            "reminder_chime" | "reminderchime" => Some(Self::ReminderChime),
            "reminder_alarm" | "reminderalarm" => Some(Self::ReminderAlarm),
            "mail_arrival" | "mailarrival" => Some(Self::MailArrival),
            "error" => Some(Self::Error),
            "lumi_hello" | "lumihello" => Some(Self::LumiHello),
            "lumi_happy" | "lumihappy" => Some(Self::LumiHappy),
            _ => None,
        }
    }

    #[must_use]
    pub const fn category(self) -> SoundCategory {
        match self {
            Self::ReminderChime | Self::ReminderAlarm | Self::MailArrival | Self::FocusEnd => {
                SoundCategory::Reminders
            }
            _ => SoundCategory::Interface,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SoundCategory {
    Interface,
    Reminders,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SoundSilenceContext {
    pub enabled: bool,
    pub interface_enabled: bool,
    pub reminders_enabled: bool,
    pub volume_pct: u8,
    pub mic_or_call_active: bool,
    pub is_fullscreen: bool,
    pub focus_session_active: bool,
    pub windows_muted: bool,
    pub quiet_hours_active: bool,
}

impl Default for SoundSilenceContext {
    fn default() -> Self {
        Self {
            enabled: true,
            interface_enabled: true,
            reminders_enabled: true,
            volume_pct: 30,
            mic_or_call_active: false,
            is_fullscreen: false,
            focus_session_active: false,
            windows_muted: false,
            quiet_hours_active: false,
        }
    }
}

/// Evaluates all silence conditions before synthesizing or opening audio hardware.
#[must_use]
pub fn should_play_ui_sound(name: UiSoundName, ctx: &SoundSilenceContext) -> bool {
    if !ctx.enabled || ctx.volume_pct == 0 {
        return false;
    }
    if ctx.mic_or_call_active
        || ctx.is_fullscreen
        || ctx.focus_session_active
        || ctx.windows_muted
        || ctx.quiet_hours_active
    {
        return false;
    }
    match name.category() {
        SoundCategory::Interface => ctx.interface_enabled,
        SoundCategory::Reminders => ctx.reminders_enabled,
    }
}

fn triangle_wave(phase: f32) -> f32 {
    let p = phase.fract();
    if p < 0.25 {
        p * 4.0
    } else if p < 0.75 {
        2.0 - p * 4.0
    } else {
        p * 4.0 - 4.0
    }
}

fn envelope(t: f32, dur: f32, attack_s: f32) -> f32 {
    if t < 0.0 || t > dur || dur <= 0.0 {
        return 0.0;
    }
    let att = if t < attack_s { t / attack_s } else { 1.0 };
    let decay = (-4.2 * (t / dur)).exp();
    att * decay
}

fn push_glide(
    out: &mut Vec<f32>,
    sample_rate: u32,
    f0: f32,
    f1: f32,
    dur_ms: f32,
    gain: f32,
    triangle: bool,
) {
    let n = ((dur_ms / 1000.0) * sample_rate as f32).round().max(1.0) as usize;
    let dur = dur_ms / 1000.0;
    let mut phase = 0.0f32;
    for i in 0..n {
        let t = i as f32 / sample_rate as f32;
        let frac = i as f32 / n as f32;
        let freq = f0 + (f1 - f0) * frac;
        phase += freq / sample_rate as f32;
        let raw = if triangle {
            triangle_wave(phase)
        } else {
            (std::f32::consts::TAU * phase).sin()
        };
        out.push(raw * envelope(t, dur, 0.003) * gain);
    }
}

/// Synthesizes 16-bit signed mono PCM samples for a UI sound preset (pure software DSP).
#[must_use]
pub fn synthesize_ui_sound_pcm16(
    name: UiSoundName,
    sample_rate: u32,
    master_volume_pct: u8,
) -> Vec<i16> {
    let effective_pct = match name {
        UiSoundName::LumiHello | UiSoundName::LumiHappy => master_volume_pct.min(30),
        _ => master_volume_pct.clamp(0, 100),
    };
    // Keep UI sounds gentle: master 30% corresponds to ~ -24 dB under full scale.
    let vol = (effective_pct as f32 / 100.0) * 0.22;
    let mut fbuf = Vec::new();
    match name {
        UiSoundName::Open => push_glide(&mut fbuf, sample_rate, 520.0, 780.0, 70.0, 0.12, false),
        UiSoundName::Close => push_glide(&mut fbuf, sample_rate, 600.0, 400.0, 70.0, 0.11, false),
        UiSoundName::ToggleOn => push_glide(&mut fbuf, sample_rate, 880.0, 880.0, 35.0, 0.12, true),
        UiSoundName::ToggleOff => {
            push_glide(&mut fbuf, sample_rate, 660.0, 660.0, 35.0, 0.11, false)
        }
        UiSoundName::WaterAdd => {
            push_glide(&mut fbuf, sample_rate, 1046.0, 784.0, 140.0, 0.14, false);
            // Add subtle 8 ms deterministic droplet tick near tail
            let tick_len = ((0.008) * sample_rate as f32) as usize;
            let mut seed: u32 = 0x9E37_79B9;
            for sample in fbuf.iter_mut().take(tick_len) {
                seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                let noise = ((seed >> 16) as f32 / 32768.0) - 1.0;
                *sample += noise * 0.03;
            }
        }
        UiSoundName::TaskDone | UiSoundName::LumiHappy => {
            push_glide(&mut fbuf, sample_rate, 988.0, 988.0, 45.0, 0.12, false);
            push_glide(&mut fbuf, sample_rate, 1318.0, 1318.0, 45.0, 0.12, false);
        }
        UiSoundName::LumiHello => {
            push_glide(&mut fbuf, sample_rate, 784.0, 784.0, 45.0, 0.12, false);
            push_glide(&mut fbuf, sample_rate, 988.0, 988.0, 45.0, 0.12, false);
        }
        UiSoundName::ArcScrubTick | UiSoundName::DaySelect => {
            push_glide(&mut fbuf, sample_rate, 1500.0, 1500.0, 10.0, 0.10, false)
        }
        UiSoundName::DropOnDay => {
            push_glide(&mut fbuf, sample_rate, 320.0, 240.0, 60.0, 0.13, false)
        }
        UiSoundName::FocusStart => {
            push_glide(&mut fbuf, sample_rate, 520.0, 780.0, 75.0, 0.12, false)
        }
        UiSoundName::FocusEnd => {
            push_glide(&mut fbuf, sample_rate, 523.0, 659.0, 90.0, 0.13, false);
            push_glide(&mut fbuf, sample_rate, 784.0, 784.0, 140.0, 0.13, false);
        }
        UiSoundName::ReminderChime => {
            let total_samples = ((0.740) * sample_rate as f32) as usize;
            fbuf.resize(total_samples, 0.0);
            for (idx, freq) in [523.0f32, 659.0, 784.0].iter().enumerate() {
                let start = ((idx as f32 * 0.120) * sample_rate as f32) as usize;
                let note_len = ((0.500) * sample_rate as f32) as usize;
                let mut phase = 0.0f32;
                for i in 0..note_len {
                    if let Some(slot) = fbuf.get_mut(start + i) {
                        let t = i as f32 / sample_rate as f32;
                        phase += *freq / sample_rate as f32;
                        *slot +=
                            (std::f32::consts::TAU * phase).sin() * envelope(t, 0.5, 0.003) * 0.11;
                    }
                }
            }
        }
        UiSoundName::ReminderAlarm => {
            // Dual-pulse gentle yet clear alarm chime (~920 ms total, medium comfortable volume).
            let total_samples = ((0.920) * sample_rate as f32) as usize;
            fbuf.resize(total_samples, 0.0);
            let pulses = [
                (0.000f32, 659.25f32, 0.14f32),
                (0.110f32, 880.00f32, 0.16f32),
                (0.220f32, 1046.50f32, 0.17f32),
                (0.460f32, 659.25f32, 0.14f32),
                (0.570f32, 880.00f32, 0.16f32),
                (0.680f32, 1046.50f32, 0.17f32),
            ];
            let note_len = ((0.210) * sample_rate as f32) as usize;
            for (start_s, freq, gain) in pulses {
                let start = (start_s * sample_rate as f32) as usize;
                let mut phase = 0.0f32;
                for i in 0..note_len {
                    if let Some(slot) = fbuf.get_mut(start + i) {
                        let t = i as f32 / sample_rate as f32;
                        phase += freq / sample_rate as f32;
                        let fundamental = (std::f32::consts::TAU * phase).sin();
                        let harmonic = (std::f32::consts::TAU * phase * 2.0).sin() * 0.28;
                        *slot += (fundamental + harmonic) * envelope(t, 0.21, 0.004) * gain;
                    }
                }
            }
        }
        UiSoundName::MailArrival => {
            push_glide(&mut fbuf, sample_rate, 1175.0, 1175.0, 80.0, 0.12, false);
            push_glide(&mut fbuf, sample_rate, 1568.0, 1568.0, 80.0, 0.12, false);
        }
        UiSoundName::Error => push_glide(&mut fbuf, sample_rate, 180.0, 140.0, 90.0, 0.12, false),
    }

    fbuf.into_iter()
        .map(|s| ((s * vol).clamp(-0.98, 0.98) * i16::MAX as f32).round() as i16)
        .collect()
}

const SAMPLE_RATE: u32 = 44_100;
const IDLE_CLOSE_SECS: u64 = 5;

static SOUND_TX: OnceLock<Sender<Vec<i16>>> = OnceLock::new();
static LAST_SCRUB_AT: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();

#[cfg(windows)]
mod wave_out {
    use windows::Win32::Media::Audio::{
        HWAVEOUT, MIDI_WAVE_OPEN_TYPE, WAVE_FORMAT_PCM, WAVE_MAPPER, WAVEFORMATEX, WAVEHDR,
        waveOutClose, waveOutOpen, waveOutPrepareHeader, waveOutUnprepareHeader, waveOutWrite,
    };

    pub struct LazyWaveOut {
        handle: HWAVEOUT,
    }

    impl LazyWaveOut {
        pub fn open(sample_rate: u32) -> Option<Self> {
            let fmt = WAVEFORMATEX {
                wFormatTag: WAVE_FORMAT_PCM as u16,
                nChannels: 1,
                nSamplesPerSec: sample_rate,
                nAvgBytesPerSec: sample_rate * 2,
                nBlockAlign: 2,
                wBitsPerSample: 16,
                cbSize: 0,
            };
            let mut handle = HWAVEOUT::default();
            let res = unsafe {
                waveOutOpen(
                    Some(&mut handle),
                    WAVE_MAPPER,
                    &fmt,
                    None,
                    None,
                    MIDI_WAVE_OPEN_TYPE(0),
                )
            };
            if res == 0 {
                Some(Self { handle })
            } else {
                None
            }
        }

        pub fn play_blocking(&self, samples: &[i16]) {
            if samples.is_empty() {
                return;
            }
            let bytes: Vec<u8> = samples.iter().flat_map(|s| s.to_le_bytes()).collect();
            let mut hdr = WAVEHDR {
                lpData: windows::core::PSTR(bytes.as_ptr() as *mut u8),
                dwBufferLength: bytes.len() as u32,
                dwBytesRecorded: 0,
                dwUser: 0,
                dwFlags: 0,
                dwLoops: 0,
                lpNext: std::ptr::null_mut(),
                reserved: 0,
            };
            let cb_hdr = std::mem::size_of::<WAVEHDR>() as u32;
            unsafe {
                if waveOutPrepareHeader(self.handle, &mut hdr, cb_hdr) == 0 {
                    if waveOutWrite(self.handle, &mut hdr, cb_hdr) == 0 {
                        // Poll WHDR_DONE (bit 0) so the driver never reads freed PCM memory.
                        let est_ms = ((samples.len() as u64) * 1000 / 44_100).max(12);
                        let max_wait = std::time::Duration::from_millis(est_ms + 400);
                        let start = std::time::Instant::now();
                        while {
                            std::sync::atomic::compiler_fence(std::sync::atomic::Ordering::SeqCst);
                            let flags = std::ptr::read_unaligned(std::ptr::addr_of!(hdr.dwFlags));
                            (flags & 1) == 0 && start.elapsed() < max_wait
                        } {
                            std::thread::sleep(std::time::Duration::from_millis(8));
                        }
                    }
                    let _ = waveOutUnprepareHeader(self.handle, &mut hdr, cb_hdr);
                }
            }
            let _ = bytes;
        }
    }

    impl Drop for LazyWaveOut {
        fn drop(&mut self) {
            unsafe {
                let _ = waveOutClose(self.handle);
            }
        }
    }

    unsafe impl Send for LazyWaveOut {}
    unsafe impl Sync for LazyWaveOut {}
}

fn ensure_sound_worker() -> &'static Sender<Vec<i16>> {
    SOUND_TX.get_or_init(|| {
        let (tx, rx) = mpsc::channel::<Vec<i16>>();
        let _ = std::thread::Builder::new()
            .name("lumen-ui-sound".into())
            .spawn(move || {
                #[cfg(windows)]
                let mut stream: Option<wave_out::LazyWaveOut> = None;
                loop {
                    #[cfg(windows)]
                    let has_stream = stream.is_some();
                    #[cfg(not(windows))]
                    let has_stream = false;

                    let msg = if has_stream {
                        rx.recv_timeout(Duration::from_secs(IDLE_CLOSE_SECS))
                    } else {
                        rx.recv().map_err(|_| RecvTimeoutError::Disconnected)
                    };
                    match msg {
                        Ok(pcm) => {
                            #[cfg(windows)]
                            {
                                if stream.is_none() {
                                    stream = wave_out::LazyWaveOut::open(SAMPLE_RATE);
                                }
                                if let Some(ref dev) = stream {
                                    dev.play_blocking(&pcm);
                                }
                            }
                            #[cfg(not(windows))]
                            let _ = pcm;
                        }
                        Err(RecvTimeoutError::Timeout) => {
                            #[cfg(windows)]
                            {
                                stream = None;
                            }
                        }
                        Err(RecvTimeoutError::Disconnected) => break,
                    }
                }
            });
        tx
    })
}

/// Checks silence rules + rate limit, synthesizes waveform in memory, and dispatches to the lazy 5s-idle audio worker.
pub fn try_play_ui_sound(name: UiSoundName, ctx: &SoundSilenceContext) -> bool {
    if !should_play_ui_sound(name, ctx) {
        return false;
    }
    if name == UiSoundName::ArcScrubTick {
        let lock = LAST_SCRUB_AT.get_or_init(|| Mutex::new(None));
        if let Ok(mut guard) = lock.lock() {
            let now = Instant::now();
            if let Some(prev) = *guard
                && now.duration_since(prev) < Duration::from_millis(40)
            {
                return false;
            }
            *guard = Some(now);
        }
    }
    let samples = synthesize_ui_sound_pcm16(name, SAMPLE_RATE, ctx.volume_pct);
    if samples.is_empty() {
        return false;
    }
    let tx = ensure_sound_worker();
    tx.send(samples).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enforces_all_sound_silence_rules() {
        let base = SoundSilenceContext::default();
        assert!(should_play_ui_sound(UiSoundName::Open, &base));
        assert!(should_play_ui_sound(UiSoundName::ReminderChime, &base));

        assert!(!should_play_ui_sound(
            UiSoundName::Open,
            &SoundSilenceContext {
                enabled: false,
                ..base
            }
        ));
        assert!(!should_play_ui_sound(
            UiSoundName::Open,
            &SoundSilenceContext {
                mic_or_call_active: true,
                ..base
            }
        ));
        assert!(!should_play_ui_sound(
            UiSoundName::Open,
            &SoundSilenceContext {
                is_fullscreen: true,
                ..base
            }
        ));
        assert!(!should_play_ui_sound(
            UiSoundName::Open,
            &SoundSilenceContext {
                focus_session_active: true,
                ..base
            }
        ));
        assert!(!should_play_ui_sound(
            UiSoundName::Open,
            &SoundSilenceContext {
                windows_muted: true,
                ..base
            }
        ));
        assert!(!should_play_ui_sound(
            UiSoundName::Open,
            &SoundSilenceContext {
                quiet_hours_active: true,
                ..base
            }
        ));
        assert!(!should_play_ui_sound(
            UiSoundName::Open,
            &SoundSilenceContext {
                interface_enabled: false,
                ..base
            }
        ));
        assert!(should_play_ui_sound(
            UiSoundName::ReminderChime,
            &SoundSilenceContext {
                interface_enabled: false,
                ..base
            }
        ));
        assert!(!should_play_ui_sound(
            UiSoundName::ReminderChime,
            &SoundSilenceContext {
                reminders_enabled: false,
                ..base
            }
        ));
    }

    #[test]
    fn synthesizes_non_empty_bounded_waveforms() {
        for preset in [
            UiSoundName::Open,
            UiSoundName::Close,
            UiSoundName::ToggleOn,
            UiSoundName::ToggleOff,
            UiSoundName::WaterAdd,
            UiSoundName::TaskDone,
            UiSoundName::ArcScrubTick,
            UiSoundName::DaySelect,
            UiSoundName::DropOnDay,
            UiSoundName::FocusStart,
            UiSoundName::FocusEnd,
            UiSoundName::ReminderChime,
            UiSoundName::ReminderAlarm,
            UiSoundName::MailArrival,
            UiSoundName::Error,
            UiSoundName::LumiHello,
            UiSoundName::LumiHappy,
        ] {
            let samples = synthesize_ui_sound_pcm16(preset, 44_100, 30);
            assert!(!samples.is_empty(), "{preset:?} must produce samples");
            let peak = samples.iter().map(|s| s.unsigned_abs()).max().unwrap_or(0);
            assert!(
                peak > 10 && peak < 6000,
                "{preset:?} peak={peak} out of gentle range"
            );
        }

        // Lumi chirps strictly cap amplitude to max 30% volume even if master volume is 100%
        let lumi_at_30 = synthesize_ui_sound_pcm16(UiSoundName::LumiHappy, 44_100, 30);
        let lumi_at_100 = synthesize_ui_sound_pcm16(UiSoundName::LumiHappy, 44_100, 100);
        assert_eq!(lumi_at_30, lumi_at_100);
        // Two 45ms notes = 90ms (~3969 samples @ 44.1kHz)
        assert!(lumi_at_30.len() >= 3900 && lumi_at_30.len() <= 4050);
    }
}
