import json

def figma_color_to_hex(color_dict):
    """Mengubah warna rasio 0-1 dari Figma menjadi format HEX standar."""
    if not color_dict:
        return None
    r = round(color_dict.get('r', 0) * 255)
    g = round(color_dict.get('g', 0) * 255)
    b = round(color_dict.get('b', 0) * 255)
    return f"#{r:02x}{g:02x}{b:02x}".upper()

def extract_colors(fills):
    """Mengekstrak tipe warna solid dari array fills/strokes Figma."""
    colors = []
    if not fills:
        return colors
    for fill in fills:
        if fill.get('type') == 'SOLID' and 'color' in fill:
            colors.append(figma_color_to_hex(fill['color']))
    return colors

def parse_layer(node):
    """Fungsi rekursif untuk mengambil data layout, size, dan warna dari tiap node."""
    # 1. Ambil Identitas Layer Dasar
    parsed_data = {
        "name": node.get("name", "Unnamed Layer"),
        "type": node.get("type", "UNKNOWN_TYPE"),
    }

    # 2. Ambil Data Size dan Layout Absolut
    bbox = node.get("absoluteBoundingBox")
    if bbox:
        parsed_data["size"] = {
            "width": round(bbox.get("width", 0), 2),
            "height": round(bbox.get("height", 0), 2)
        }
        parsed_data["position"] = {
            "x": round(bbox.get("x", 0), 2),
            "y": round(bbox.get("y", 0), 2)
        }

    # 3. Ambil Data Auto Layout (Flexbox) jika layer menggunakannya
    if "layoutMode" in node and node["layoutMode"] != "NONE":
        parsed_data["auto_layout"] = {
            "direction": node.get("layoutMode"),
            "spacing": node.get("itemSpacing", 0),
            "padding_left": node.get("paddingLeft", 0),
            "padding_top": node.get("paddingTop", 0)
        }

    # 4. Ambil Data Warna (Background / Fill)
    fills = node.get("fills", [])
    extracted_colors = extract_colors(fills)
    if extracted_colors:
        parsed_data["colors"] = extracted_colors

    # Ambil teks jika ini adalah layer teks
    if node.get("type") == "TEXT" and "characters" in node:
        parsed_data["text_content"] = node.get("characters")

    # 5. Telusuri Child Layer secara rekursif (misal dari Page -> Frame -> Group -> Rectangle)
    if "children" in node:
        parsed_data["layers"] = [parse_layer(child) for child in node["children"]]

    return parsed_data

def main():
    input_file = 'fetch.json'
    output_file = 'clean_layout_data.json'

    try:
        # Buka data mentah Figma
        with open(input_file, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
        
        print("Memproses data Figma...")
        
        # Ekstrak dari node paling atas (biasanya Document atau Canvas)
        clean_design_data = parse_layer(raw_data)

        # Simpan hasilnya ke file JSON baru yang bersih
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(clean_design_data, f, indent=2)
        
        print(f"Sukses! Data telah diekstrak dan disimpan di '{output_file}'.")

    except FileNotFoundError:
        print(f"Error: File '{input_file}' tidak ditemukan di folder ini.")
    except Exception as e:
        print(f"Terjadi kesalahan: {e}")

if __name__ == "__main__":
    main()