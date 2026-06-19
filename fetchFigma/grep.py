import json
import sys

def search_layers(node, target_name, results=None):
    """Fungsi rekursif untuk mencari layer terluar berdasarkan nama."""
    if results is None:
        results = []

    current_name = node.get("name", "")
    
    # JIKA KETEMU: Tambahkan ke hasil dan BERHENTI mencari ke dalam (children)
    if target_name.lower() in current_name.lower():
        results.append(node)
        return results # Ini kunci utamanya agar dia tidak menggali lebih dalam

    # JIKA BELUM KETEMU: Baru cari ke dalam layer anaknya (layers)
    for child in node.get("layers", []):
        search_layers(child, target_name, results)

    return results

def main():
    if len(sys.argv) < 2:
        print("Penggunaan: python3 grep.py <nama_layer>")
        print("Contoh: python3 grep.py scan")
        sys.exit(1)

    target = sys.argv[1]
    input_file = "clean_layout_data.json"

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        print(f"Mencari layer terluar yang mengandung kata: '{target}'...\n")
        
        # Mulai pencarian
        found_layers = search_layers(data, target)

        if found_layers:
            print(f"Ditemukan {len(found_layers)} layer utama yang cocok!")
            
            output_file = f"layer_{target}.json"
            with open(output_file, "w", encoding="utf-8") as out_f:
                json.dump(found_layers, out_f, indent=2)
                
            print(f"Data layer utuh telah disimpan ke '{output_file}'")

        else:
            print(f"Layer dengan kata kunci '{target}' tidak ditemukan.")

    except FileNotFoundError:
        print(f"Error: File '{input_file}' tidak ditemukan.")
    except json.JSONDecodeError:
        print(f"Error: File '{input_file}' bukan format JSON yang valid.")

if __name__ == "__main__":
    main()