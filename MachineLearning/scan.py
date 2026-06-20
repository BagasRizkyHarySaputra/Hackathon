import os
from ultralytics import YOLO

# 1. Load otak AI hasil training
model = YOLO("best.pt")

# 2. Tentukan nama file foto yang mau di-scan
image_path = "rico.png" 

print(f"🔄 Memulai AI Scanning pada file: {image_path}...")

# 3. Jalankan prediksi YOLO (save=True untuk bikin tracing kotak)
results = model.predict(source=image_path, save=True, conf=0.05)
result = results[0] 

# 4. Ambil daftar nama kelas dari model
class_names = model.names
acne_counts = {name: 0 for name in class_names.values()}

# Loop untuk menghitung setiap kotak jerawat
for box in result.boxes:
    class_id = int(box.cls[0])
    class_name = class_names[class_id]
    acne_counts[class_name] += 1

print("\n========================================")
print("🎯 HASIL DETEKSI JUMLAH ABSOLUT AI")
print("========================================")
for jenis, jumlah in acne_counts.items():
    print(f" 📦 {jenis.title()}: {jumlah} titik")

# 5. HITUNG SKIN HEALTH SCORE PROFILE
weights = {
    'nodules': 15,
    'pustules': 10,
    'papules': 5,
    'dark spot': 2,
    'blackheads': 2,
    'whiteheads': 2
}

total_penalty = 0
weighted_scores = {}

for acne_type, count in acne_counts.items():
    penalty = count * weights.get(acne_type, 2)
    total_penalty += penalty
    weighted_scores[acne_type] = penalty

# Hitung persen kulit bersih, minimal 5%
clear_skin_percentage = max(5, 100 - total_penalty)
actual_acne_burden = 100 - clear_skin_percentage

score_wajah = {'clear_skin': round(clear_skin_percentage, 1)}

# Distribusi proporsional
if actual_acne_burden > 0 and total_penalty > 0:
    for acne_type, penalty_part in weighted_scores.items():
        share = (penalty_part / total_penalty) * actual_acne_burden
        score_wajah[acne_type] = round(share, 1)
else:
    for acne_type in class_names.values():
        score_wajah[acne_type] = 0.0

print("\n========================================")
print("📊 SKIN HEALTH SCORE PROFILE (%)")
print("========================================")
for kondisi, persen in score_wajah.items():
    icon = "🟩" if kondisi == 'clear_skin' else "🔺"
    print(f" {icon} {kondisi.replace('_', ' ').title()}: {persen}%")
print("========================================")

print(f"📷 Foto hasil tracing tersimpan di folder: {result.save_dir}\n")