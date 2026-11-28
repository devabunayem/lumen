use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const B64_URL: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

#[must_use]
pub fn base64url_encode(data: &[u8]) -> String {
    let mut out = String::with_capacity((data.len() * 4).div_ceil(3));
    for chunk in data.chunks(3) {
        let b0 = u32::from(chunk[0]);
        let b1 = if chunk.len() > 1 {
            u32::from(chunk[1])
        } else {
            0
        };
        let b2 = if chunk.len() > 2 {
            u32::from(chunk[2])
        } else {
            0
        };
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(B64_URL[((n >> 18) & 63) as usize] as char);
        out.push(B64_URL[((n >> 12) & 63) as usize] as char);
        if chunk.len() > 1 {
            out.push(B64_URL[((n >> 6) & 63) as usize] as char);
        }
        if chunk.len() > 2 {
            out.push(B64_URL[(n & 63) as usize] as char);
        }
    }
    out
}

/// Pure-Rust SHA-256 for RFC 7636 PKCE `S256` code challenge generation.
#[must_use]
pub fn sha256_bytes(input: &[u8]) -> [u8; 32] {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
        0x5be0cd19,
    ];
    let bit_len = (input.len() as u64) * 8;
    let mut msg = input.to_vec();
    msg.push(0x80);
    while (msg.len() % 64) != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bit_len.to_be_bytes());

    for block in msg.as_chunks::<64>().0 {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                block[i * 4],
                block[i * 4 + 1],
                block[i * 4 + 2],
                block[i * 4 + 3],
            ]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1);
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);
            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }
        let vals = [a, b, c, d, e, f, g, hh];
        for idx in 0..8 {
            h[idx] = h[idx].wrapping_add(vals[idx]);
        }
    }

    let mut digest = [0u8; 32];
    for (idx, word) in h.iter().enumerate() {
        digest[idx * 4..idx * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    digest
}

#[derive(Debug, Clone)]
pub struct PkcePair {
    pub verifier: String,
    pub challenge: String,
    pub state: String,
}

#[must_use]
pub fn generate_pkce_pair() -> PkcePair {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(1_700_000_000_000);
    let pid = u128::from(std::process::id());
    let seed_a = sha256_bytes(&format!("lumen-pkce-v-{nanos}-{pid}").into_bytes());
    let seed_b =
        sha256_bytes(&format!("lumen-pkce-s-{pid}-{}", nanos.rotate_left(17)).into_bytes());
    let verifier = base64url_encode(&seed_a);
    let challenge = base64url_encode(&sha256_bytes(verifier.as_bytes()));
    let state = base64url_encode(&seed_b[..16]);
    PkcePair {
        verifier,
        challenge,
        state,
    }
}

#[must_use]
pub fn url_encode_component(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for byte in raw.bytes() {
        let is_unreserved =
            byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~');
        if is_unreserved {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{:02X}", byte));
        }
    }
    out
}

#[must_use]
pub fn url_decode_component(raw: &str) -> String {
    let bytes = raw.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%'
            && i + 2 < bytes.len()
            && let Ok(hex_str) = std::str::from_utf8(&bytes[i + 1..i + 3])
            && let Ok(val) = u8::from_str_radix(hex_str, 16)
        {
            out.push(val);
            i += 3;
            continue;
        }
        if bytes[i] == b'+' {
            out.push(b' ');
        } else {
            out.push(bytes[i]);
        }
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[must_use]
pub fn encode_form_params(pairs: &[(&str, &str)]) -> String {
    pairs
        .iter()
        .map(|(k, v)| format!("{}={}", url_encode_component(k), url_encode_component(v)))
        .collect::<Vec<_>>()
        .join("&")
}

#[must_use]
pub fn parse_query_params(query: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for part in query.trim_start_matches('?').split('&') {
        if part.is_empty() {
            continue;
        }
        if let Some((k, v)) = part.split_once('=') {
            map.insert(url_decode_component(k), url_decode_component(v));
        }
    }
    map
}

/// Binds an ephemeral `127.0.0.1:0` loopback socket for OAuth PKCE redirect capture.
pub fn bind_loopback_listener() -> Result<(TcpListener, u16), String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("bind OAuth loopback listener failed: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("loopback local_addr failed: {e}"))?
        .port();
    Ok((listener, port))
}

/// Waits up to `timeout_secs` for the OAuth redirect on `127.0.0.1`, verifies `state`, and returns `code`.
pub fn wait_for_loopback_code(
    listener: TcpListener,
    expected_state: &str,
    timeout_secs: u64,
) -> Result<String, String> {
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("set nonblocking failed: {e}"))?;
    let start = std::time::Instant::now();
    loop {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]);
                let first_line = req.lines().next().unwrap_or("");
                let target = first_line.split_whitespace().nth(1).unwrap_or("/");
                let query = target.split_once('?').map(|(_, q)| q).unwrap_or("");
                let params = parse_query_params(query);

                if let Some(err) = params.get("error") {
                    let body = format!(
                        "<html><body style=\"font-family:sans-serif;background:#111;color:#fff;padding:32px\"><h2>Lumen Calendar</h2><p>Authorization cancelled ({err}). You may close this tab.</p></body></html>"
                    );
                    let resp = format!(
                        "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    let _ = stream.write_all(resp.as_bytes());
                    return Err(format!("OAuth denied: {err}"));
                } else if params.get("state").map(String::as_str) != Some(expected_state) {
                    let body = "<html><body style=\"font-family:sans-serif;background:#111;color:#fff;padding:32px\"><h2>State mismatch</h2><p>Please retry from Lumen.</p></body></html>";
                    let resp = format!(
                        "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    let _ = stream.write_all(resp.as_bytes());
                    return Err("OAuth state mismatch".into());
                } else if let Some(code) = params.get("code") {
                    let body = "<html><body style=\"font-family:sans-serif;background:#0a0a0c;color:#fff;padding:32px\"><h2>Connected to Lumen</h2><p>Your calendar is syncing locally. You can close this browser tab.</p></body></html>";
                    let resp = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    let _ = stream.write_all(resp.as_bytes());
                    return Ok(code.clone());
                }
                let body = "<html><body>Missing authorization code.</body></html>";
                let resp = format!(
                    "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(resp.as_bytes());
                return Err("Missing authorization code".into());
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if start.elapsed() >= Duration::from_secs(timeout_secs) {
                    return Err("OAuth login timed out waiting for browser callback".into());
                }
                std::thread::sleep(Duration::from_millis(80));
            }
            Err(e) => return Err(format!("OAuth loopback accept failed: {e}")),
        }
    }
}

pub fn open_browser_url(url: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("failed to launch browser: {e}"))?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = url;
        Err("browser launch is only supported on Windows".into())
    }
}

pub struct HttpTextResponse {
    pub status: u16,
    pub body: String,
}

pub fn http_get_text(url: &str, bearer_token: Option<&str>) -> Result<HttpTextResponse, String> {
    #[cfg(windows)]
    {
        use windows::Foundation::Uri;
        use windows::Web::Http::Headers::HttpCredentialsHeaderValue;
        use windows::Web::Http::HttpClient;
        use windows::core::HSTRING;

        let uri = Uri::CreateUri(&HSTRING::from(url)).map_err(|e| format!("uri error: {e}"))?;
        let client = HttpClient::new().map_err(|e| format!("http client error: {e}"))?;
        if let Some(tok) = bearer_token {
            let headers = client
                .DefaultRequestHeaders()
                .map_err(|e| format!("request headers error: {e}"))?;
            let auth = HttpCredentialsHeaderValue::CreateFromSchemeWithToken(
                &HSTRING::from("Bearer"),
                &HSTRING::from(tok),
            )
            .map_err(|e| format!("auth header error: {e}"))?;
            headers
                .SetAuthorization(&auth)
                .map_err(|e| format!("set auth header error: {e}"))?;
        }
        let resp = client
            .GetAsync(&uri)
            .map_err(|e| format!("http get start failed: {e}"))?
            .join()
            .map_err(|e| format!("http get failed: {e}"))?;
        let status = resp.StatusCode().map(|s| s.0 as u16).unwrap_or(500);
        let content = resp
            .Content()
            .map_err(|e| format!("http content failed: {e}"))?;
        let body = content
            .ReadAsStringAsync()
            .map_err(|e| format!("http read start failed: {e}"))?
            .join()
            .map_err(|e| format!("http read failed: {e}"))?
            .to_string_lossy()
            .to_string();
        Ok(HttpTextResponse { status, body })
    }
    #[cfg(not(windows))]
    {
        let _ = (url, bearer_token);
        Err("HTTP client is only supported on Windows".into())
    }
}

pub fn http_post_text(
    url: &str,
    content_type: &str,
    body_text: &str,
    bearer_token: Option<&str>,
) -> Result<HttpTextResponse, String> {
    #[cfg(windows)]
    {
        use windows::Foundation::Uri;
        use windows::Storage::Streams::UnicodeEncoding;
        use windows::Web::Http::Headers::HttpCredentialsHeaderValue;
        use windows::Web::Http::{HttpClient, HttpStringContent};
        use windows::core::HSTRING;

        let uri = Uri::CreateUri(&HSTRING::from(url)).map_err(|e| format!("uri error: {e}"))?;
        let client = HttpClient::new().map_err(|e| format!("http client error: {e}"))?;
        if let Some(tok) = bearer_token {
            let headers = client
                .DefaultRequestHeaders()
                .map_err(|e| format!("request headers error: {e}"))?;
            let auth = HttpCredentialsHeaderValue::CreateFromSchemeWithToken(
                &HSTRING::from("Bearer"),
                &HSTRING::from(tok),
            )
            .map_err(|e| format!("auth header error: {e}"))?;
            headers
                .SetAuthorization(&auth)
                .map_err(|e| format!("set auth header error: {e}"))?;
        }
        let content = HttpStringContent::CreateFromStringWithEncodingAndMediaType(
            &HSTRING::from(body_text),
            UnicodeEncoding::Utf8,
            &HSTRING::from(content_type),
        )
        .map_err(|e| format!("http body create failed: {e}"))?;
        let resp = client
            .PostAsync(&uri, &content)
            .map_err(|e| format!("http post start failed: {e}"))?
            .join()
            .map_err(|e| format!("http post failed: {e}"))?;
        let status = resp.StatusCode().map(|s| s.0 as u16).unwrap_or(500);
        let resp_content = resp
            .Content()
            .map_err(|e| format!("http content failed: {e}"))?;
        let body = resp_content
            .ReadAsStringAsync()
            .map_err(|e| format!("http read start failed: {e}"))?
            .join()
            .map_err(|e| format!("http read failed: {e}"))?
            .to_string_lossy()
            .to_string();
        Ok(HttpTextResponse { status, body })
    }
    #[cfg(not(windows))]
    {
        let _ = (url, content_type, body_text, bearer_token);
        Err("HTTP client is only supported on Windows".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_s256_matches_rfc7636_test_vector() {
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let expected_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
        let actual = base64url_encode(&sha256_bytes(verifier.as_bytes()));
        assert_eq!(actual, expected_challenge);
    }

    #[test]
    fn encodes_and_decodes_oauth_form_and_query_params() {
        let encoded = encode_form_params(&[
            ("redirect_uri", "http://127.0.0.1:49152/callback"),
            ("scope", "Calendars.Read offline_access"),
        ]);
        let parsed = parse_query_params(&encoded);
        assert_eq!(
            parsed.get("redirect_uri").map(String::as_str),
            Some("http://127.0.0.1:49152/callback")
        );
        assert_eq!(
            parsed.get("scope").map(String::as_str),
            Some("Calendars.Read offline_access")
        );
    }
}
