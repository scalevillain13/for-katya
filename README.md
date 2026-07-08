# Для Кати

Романтический одностраничный сайт — подарок с любовью.

**Ссылка:** https://scalevillain13.github.io/for-katya/

---

## Как добавить / заменить фото

1. Положи фото в папку `images/` в формате **WebP** с именами `photo-1.webp` … `photo-7.webp`:

| Файл | Содержание |
|------|------------|
| `photo-1.webp` | Первая встреча (28.08.2025) |
| `photo-2.webp` | Наш Сочи |
| `photo-3.webp` | Совместное |
| `photo-4.webp` | Совместное |
| `photo-5.webp` | Милое фото |
| `photo-6.webp` | Серьёзная |
| `photo-7.webp` | Любимое |

2. **Конвертация в WebP** (если фото в JPG):

```bash
pip install Pillow
python -c "
from PIL import Image
import sys
img = Image.open(sys.argv[1])
if img.mode != 'RGB': img = img.convert('RGB')
w,h = img.size
m = max(w,h)
if m > 1200:
    r = 1200/m; img = img.resize((int(w*r), int(h*r)))
img.save(sys.argv[2], 'WEBP', quality=80)
" photo.jpg photo-1.webp
```

3. Обновить сайт:

```bash
git add images/ content.js
git commit -m "Update photos"
git push
```

---

## Как редактировать тексты

Все тексты — в **`content.js`**: подписи, «Почему скучаю», ритуалы, пожелания, love notes, финал.

После правок: `git add content.js` → `git commit` → `git push`.

---

## Новые секции

- **Наши ритуалы** — сладости, сериалы, переписка
- **Нарисовано для тебя** — анимированное сердечко и цветочки на canvas (как «рисование кодом»)
- **Мои желания для нас** — список мечтаний

Кнопка «Нарисовать ещё раз ♥» перезапускает анимацию рисунка.

---

## Easter eggs

1. 5 тапов по сердечку в hero
2. Konami code (↑↑↓↓←→←→BA)
3. Клик по конфетке 🍬 в галерее
4. Кнопка «Ещё одно сообщение» в конце
