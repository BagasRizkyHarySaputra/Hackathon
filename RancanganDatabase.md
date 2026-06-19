# Database Schema Design: Web LICIN
**Description:** Rancangan struktur database relasional (SQL) untuk aplikasi Web LICIN yang mencakup fitur autentikasi, skin tracking, komunitas, chatbot AI, dan manajemen konten.

---

## 1. Authentication, Profile & Settings

### Table: `users`
Menyimpan data utama pengguna dan profil.
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | **PK** | Identifier unik user |
| `email` | VARCHAR | UNIQUE | Email user |
| `auth_provider` | ENUM | - | 'google', 'facebook', 'email' |
| `auth_id` | VARCHAR | UNIQUE | ID dari provider (Google/FB) |
| `name` | VARCHAR | - | Nama lengkap user |
| `profile_image_url`| VARCHAR | - | Link foto profil |
| `skin_type` | ENUM | - | 'normal', 'dry', 'oily', 'combination', 'sensitive' |
| `created_at` | TIMESTAMP | - | Waktu pembuatan akun |
| `updated_at` | TIMESTAMP | - | Waktu update profil |

### Table: `user_settings`
Menyimpan preferensi privasi dan notifikasi tiap user (Relasi 1:1 dengan `users`).
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `user_id` | UUID / INT | **PK, FK** -> `users.id`| Identifier user |
| `push_notification`| BOOLEAN | - | Status notifikasi push (true/false) |
| `email_notification`| BOOLEAN | - | Status notifikasi email (true/false) |
| `privacy_1` | BOOLEAN | - | List privacy setting 1 |
| `privacy_2` | BOOLEAN | - | List privacy setting 2 |
| `privacy_3` | BOOLEAN | - | List privacy setting 3 |
| `privacy_4` | BOOLEAN | - | List privacy setting 4 |
| `privacy_5` | BOOLEAN | - | List privacy setting 5 |

---

## 2. Skin Tracking & Diary (21-Day Cycle)

### Table: `skin_cycles`
Sesi tracking 21 hari (1 user bisa memiliki banyak siklus).
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | **PK** | Identifier unik siklus |
| `user_id` | UUID / INT | **FK** -> `users.id` | Pemilik siklus |
| `start_date` | DATE | - | Tanggal mulai (Hari ke-1) |
| `end_date` | DATE | - | Tanggal selesai (Hari ke-21) |
| `status` | ENUM | - | 'ongoing', 'completed' |

### Table: `scan_records`
Menyimpan data hasil scan/foto per siklus (Maks 3 record per `cycle_id`).
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | **PK** | Identifier unik scan |
| `cycle_id` | UUID / INT | **FK** -> `skin_cycles.id`| Masuk di siklus yang mana |
| `week_number` | INT | - | Nilai: 1, 2, atau 3 |
| `scan_image_url` | VARCHAR | - | Link ke gambar hasil scan |
| `acne_count` | INT | - | Jumlah jerawat terdeteksi |
| `acne_severity` | VARCHAR | - | 'mild', 'moderate', 'severe' |
| `scan_date` | TIMESTAMP | - | Waktu scan dilakukan |

### Table: `skin_diary_summaries`
Rangkuman perjalanan kulit setelah menyelesaikan siklus atau evaluasi berkala.
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | **PK** | Identifier unik summary |
| `user_id` | UUID / INT | **FK** -> `users.id` | Pemilik summary |
| `summary_date` | DATE | - | Tanggal rangkuman |
| `content_summary`| TEXT | - | Isi/evaluasi text dari sistem |

---

## 3. Community & Real-time Chat

### Table: `channels`
Kategori besar obrolan komunitas.
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | **PK** | Identifier unik channel |
| `name` | VARCHAR | - | Nama channel (cth: Acne Fighters) |

### Table: `topics`
Thread/Topik diskusi di dalam sebuah channel.
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | **PK** | Identifier unik topik |
| `channel_id` | UUID / INT | **FK** -> `channels.id` | Berada di channel apa |
| `title` | VARCHAR | - | Judul diskusi |
| `created_by` | UUID / INT | **FK** -> `users.id` | User yang membuat topik |

### Table: `chat_messages`
Riwayat chat real-time di dalam sebuah topik.
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | **PK** | Identifier unik pesan |
| `topic_id` | UUID / INT | **FK** -> `topics.id` | Pesan ada di topik mana |
| `user_id` | UUID / INT | **FK** -> `users.id` | Pengirim pesan |
| `message` | TEXT | NULLABLE | Teks pesan (bisa null jika hanya gambar) |
| `image_url` | VARCHAR | NULLABLE | Link gambar (bisa null jika hanya teks) |
| `created_at` | TIMESTAMP | - | Waktu kirim |

### Table: `polls`
Fitur polling yang dikirimkan di dalam chat.
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | **PK** | Identifier unik poll |
| `message_id` | UUID / INT | **FK** -> `chat_messages.id`| Nempel di pesan mana |
| `question` | VARCHAR | - | Pertanyaan polling |

### Table: `poll_options`
Pilihan jawaban dari sebuah polling.
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | **PK** | Identifier unik opsi |
| `poll_id` | UUID / INT | **FK** -> `polls.id` | Bagian dari poll mana |
| `option_text` | VARCHAR | - | Teks pilihan |
| `votes_count` | INT | - | Jumlah suara (default 0) |

---

## 4. Chatbot AI History

### Table: `ai_sessions`
Grup/Sesi obrolan antara User dan AI.
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | **PK** | Identifier unik sesi |
| `user_id` | UUID / INT | **FK** -> `users.id` | Pemilik sesi |
| `session_name` | VARCHAR | - | Judul obrolan (digenerate AI) |
| `created_at` | TIMESTAMP | - | Waktu sesi dibuat |

### Table: `ai_chat_history`
Detail riwayat percakapan per sesi.
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | **PK** | Identifier pesan |
| `session_id` | UUID / INT | **FK** -> `ai_sessions.id`| Bagian dari sesi mana |
| `sender_type` | ENUM | - | 'user' atau 'ai' |
| `message` | TEXT | - | Isi pesan |
| `created_at` | TIMESTAMP | - | Waktu pesan terkirim |

---

## 5. Content Management (Articles & Products)

### Table: `articles`
Data artikel untuk edukasi skincare (disesuaikan dengan dataset dummy).
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR | **PK** | Identifier unik (menggunakan slug, cth: 'retinol-pemula') |
| `title` | VARCHAR | - | Judul artikel (dari field `Title`) |
| `simple_desc` | TEXT | - | Ringkasan pendek untuk preview card (dari field `Simple-desc`) |
| `content` | TEXT | - | Isi lengkap konten artikel (dari field `Description`) |
| `image_url` | VARCHAR | - | Link aman ke gambar (dari field `Link-Image`) |
| `source` | VARCHAR | NULLABLE | Sumber artikel asli untuk credit (dari field `Source`, cth: 'Parapuan.co') |
| `published_at` | TIMESTAMP | - | Waktu rilis artikel |

### Table: `tags`
Master data tag kategori artikel (misal: 'acne', 'dry', 'oily').
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT / UUID | **PK** | Identifier unik master tag |
| `name` | VARCHAR | UNIQUE | Nama tag/kategori (cth: 'acne', 'dry') |

### Table: `article_tags`
Tabel relasi (Pivot/Bridge) untuk menghubungkan Banyak Artikel ke Banyak Tags (Many-to-Many).
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `article_id` | VARCHAR | **FK** -> `articles.id`| ID Artikel yang bersangkutan |
| `tag_id` | INT / UUID | **FK** -> `tags.id` | ID Tag yang nempel di artikel tersebut |

### Table: `skincare_products`
Kumpulan link image produk skincare.
| Field Name | Data Type | Key/Relation | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | **PK** | Identifier unik produk |
| `name` | VARCHAR | - | Nama produk |
| `description` | TEXT | NULLABLE | Deskripsi singkat |
| `image_url` | VARCHAR | - | Link terhubung ke GDrive |
| `product_link` | VARCHAR | NULLABLE | Eksternal link pembelian |