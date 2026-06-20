-- ============================================================================
-- Seed Data: Channels, Topics, Sample Articles
-- Run after 0001_initial_schema.sql
-- ============================================================================

-- Insert channels (matching existing HTML data-channel attributes)
INSERT INTO public.channels (name, icon, sort_order) VALUES
    ('General',   '💬', 1),
    ('Skincare',  '✨', 2),
    ('Review',    '⭐', 3),
    ('Acne',      '🔴', 4)
ON CONFLICT (name) DO NOTHING;

-- Insert topics (matching existing HTML topic-item__name values)
-- Using a subquery to get channel IDs by name
INSERT INTO public.topics (channel_id, title)
SELECT c.id, t.title
FROM public.channels c
JOIN (VALUES
    ('Skincare', '#Acne Fighter'),
    ('Skincare', '#Review Skincare'),
    ('Skincare', '#Skincare'),
    ('General',  '#Welcome'),
    ('Review',   '#Product Reviews'),
    ('Acne',     '#Acne Tips')
) AS t(channel_name, title)
ON c.name = t.channel_name
ON CONFLICT DO NOTHING;

-- Insert sample articles (from existing batch-01.json data)
INSERT INTO public.articles (title, summary, content, image_url, category)
VALUES
    (
        'Jangan Keliru, Begini Cara Tepat Pakai Retinol untuk Pemula',
        'Panduan lengkap cara pakai retinol untuk pemula agar tidak mengalami iritasi.',
        'Retinol merupakan salah satu bahan aktif yang paling sering digunakan dalam berbagai produk perawatan kulit. Produk ini diklaim mampu memberikan beberapa manfaat, mulai dari membuat kulit tampak lebih bercahaya, mengurangi pigmentasi, menyembuhkan jerawat, dan menyamarkan garis halus serta kerutan.',
        'https://d1vbn70lmn1nqe.cloudfront.net/prod/wp-content/uploads/2022/08/04050537/Jangan-Keliru-Begini-Cara-Tepat-Pakai-Retinol-untuk-Pemula.jpg.webp',
        'acne'
    ),
    (
        'Moisturizer Dulu atau Sunscreen Dulu? Urutan Skincare!',
        'Panduan urutan skincare pagi yang benar.',
        'Banyak orang bertanya-tanya, pakai sunscreen dulu atau moisturizer dulu? Urutan pemakaian skincare yang benar sangat penting untuk memastikan produk bekerja efektif.',
        'https://d1vbn70lmn1nqe.cloudfront.net/prod/wp-content/uploads/2026/02/24084301/pakai-sunscreen-dulu-atau-moisturizer-dulu.jpg.webp',
        'combination'
    )
ON CONFLICT DO NOTHING;
